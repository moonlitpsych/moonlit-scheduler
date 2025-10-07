-- ============================================================================
-- CONSOLIDATED MIGRATION: Fix Bookability System
-- Date: October 7, 2025
-- Author: Claude + Miriam
-- Confidence: HIGH (Verified canonical view has 5 Molina rows, v2 has 0)
-- ============================================================================
--
-- WHAT THIS DOES:
-- 1. Updates booking trigger to use v_bookable_provider_payer (canonical)
-- 2. Removes reference to incomplete bookable_provider_payers_v2 table
-- 3. Fixes "Not bookable for this payer" errors
--
-- SAFETY:
-- - Canonical view has MORE data than v2 (5 vs 0 rows for Molina)
-- - All production code already uses canonical view
-- - This aligns trigger with existing behavior
--
-- ROLLBACK:
-- If needed, save current function first with:
-- CREATE FUNCTION enforce_bookable_provider_payer_BACKUP_20251007() AS $$
--   [copy current function body]
-- $$ LANGUAGE plpgsql;
--
-- ============================================================================

-- ----------------------------------------------------------------------------
-- STEP 1: Update trigger function to use canonical view
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION enforce_bookable_provider_payer()
RETURNS TRIGGER AS $$
  DECLARE
    v_row record;
    v_dos date := (NEW.start_time AT TIME ZONE 'America/Denver')::date;
  BEGIN
    -- Skip validation if no payer specified
    IF NEW.payer_id IS NULL THEN
      RETURN NEW;
    END IF;

    -- FIXED: Use canonical view v_bookable_provider_payer
    -- Previously used bookable_provider_payers_v2 which had incomplete data
    SELECT
      b.*,
      CASE
        WHEN b.network_status = 'in_network' THEN 'direct'
        WHEN b.network_status = 'supervised' THEN 'supervised'
        ELSE 'direct'
      END as via
    INTO v_row
    FROM public.v_bookable_provider_payer b
    WHERE b.payer_id = NEW.payer_id
      AND b.provider_id = NEW.provider_id
      -- Check date is within effective range
      AND v_dos >= COALESCE(b.bookable_from_date, b.effective_date)
      AND (b.expiration_date IS NULL OR v_dos <= b.expiration_date)
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Not bookable for this payer on the selected date';
    END IF;

    -- Success: Provider-payer relationship exists and is valid for this date
    RETURN NEW;
  END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- STEP 2: Verify the update was successful
-- ----------------------------------------------------------------------------

SELECT
  proname AS function_name,
  prosrc LIKE '%v_bookable_provider_payer%' AS now_uses_canonical_view,
  prosrc LIKE '%bookable_provider_payers_v2%' AS still_uses_v2
FROM pg_proc
WHERE proname = 'enforce_bookable_provider_payer';

-- Expected result:
-- function_name                     | now_uses_canonical_view | still_uses_v2
-- ----------------------------------+-------------------------+--------------
-- enforce_bookable_provider_payer  | t                       | f

-- ----------------------------------------------------------------------------
-- STEP 3: Test that trigger will accept Molina bookings
-- ----------------------------------------------------------------------------

SELECT
  'Trigger will now ACCEPT this booking' AS status,
  provider_id,
  payer_id,
  network_status,
  effective_date,
  bookable_from_date,
  expiration_date
FROM public.v_bookable_provider_payer
WHERE payer_id = '8b48c3e2-f555-4d67-8122-c086466ba97d'  -- Molina
  AND provider_id = '504d53c6-54ef-40b0-81d4-80812c2c7bfd'  -- Dr. Privratsky
  AND '2025-10-15'::date >= COALESCE(bookable_from_date, effective_date)
  AND (expiration_date IS NULL OR '2025-10-15'::date <= expiration_date);

-- Should return 1 row showing the valid relationship

-- ============================================================================
-- MIGRATION COMPLETE!
-- ============================================================================
--
-- NEXT STEPS:
-- 1. Try booking again in the UI (should work now!)
-- 2. If booking succeeds, run the cleanup migration below
-- 3. If booking fails, investigate trigger attachment and view contents
--
-- ============================================================================


-- ============================================================================
-- OPTIONAL CLEANUP (Run ONLY after confirming booking works)
-- ============================================================================
--
-- Uncomment and run these ONLY after verifying booking is working:
--
-- -- Drop deprecated v2 variants
-- DROP MATERIALIZED VIEW IF EXISTS bookable_provider_payers_v2_mv CASCADE;
-- DROP VIEW IF EXISTS bookable_provider_payers_v2 CASCADE;
-- DROP TABLE IF EXISTS bookable_provider_payers_v2_src CASCADE;
-- DROP FUNCTION IF EXISTS refresh_bookable_provider_payers_v2(boolean);
--
-- -- Drop explicitly deprecated views
-- DROP VIEW IF EXISTS v_bookable_provider_payers_v3_deprecated CASCADE;
-- DROP VIEW IF EXISTS v_bookable_provider_payer_v3 CASCADE;
--
-- -- Verify cleanup
-- SELECT viewname FROM pg_views
-- WHERE viewname LIKE '%bookable%'
-- ORDER BY viewname;
--
-- ============================================================================
