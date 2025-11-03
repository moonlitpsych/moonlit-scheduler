-- ============================================================================
-- Migration 034: Rollback Plan Validation from Booking Flow
-- Date: November 3, 2025
-- Purpose: Remove provider-level plan validation that was prematurely added
-- ============================================================================
--
-- CONTEXT:
-- Plan validation system (migrations 027, 028, 029, 030) was added on Oct 31
-- but should NOT be enforced in booking flow.
--
-- PROBLEMS IT CAUSED:
-- - provider_payer_accepted_plans table implies provider-level plan restrictions
-- - Booking trigger rejected valid bookings when plan not in junction table
-- - Architecture was wrong: Plans are practice-level, not provider-level
--
-- CORRECT LOGIC:
-- - If provider is bookable with payer (direct OR supervised) → Accept ALL plans
-- - Plan filtering should happen at insurance selection UI (future work)
-- - Booking validation = Provider + Payer relationship ONLY
--
-- WHAT THIS DOES:
-- 1. Restore booking trigger to Oct 7 version (pre-plan-validation)
-- 2. Drop provider_payer_accepted_plans table (conceptually wrong)
-- 3. Drop plan validation functions (not needed for booking)
-- 4. Drop related views
-- 5. Keep payer_plans tables (for future practice-level tracking)
--
-- ============================================================================

-- ----------------------------------------------------------------------------
-- STEP 1: Restore Booking Trigger to Oct 7 Version
-- ----------------------------------------------------------------------------
-- This version only validates provider-payer bookability, no plan checking

CREATE OR REPLACE FUNCTION enforce_bookable_provider_payer()
RETURNS TRIGGER AS $$
DECLARE
    v_row record;
    v_dos date := (NEW.start_time AT TIME ZONE 'America/Denver')::date;
BEGIN
    -- Skip validation if no payer specified
    IF NEW.payer_id IS NULL THEN
        RAISE NOTICE '[TRIGGER] No payer_id specified, skipping validation';
        RETURN NEW;
    END IF;

    -- Use canonical view for provider-payer bookability
    -- Includes both direct contracts and supervised relationships
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
        RAISE EXCEPTION 'Provider not bookable with this payer on the selected date'
        USING HINT = 'Check provider-payer contracts in admin dashboard';
    END IF;

    -- Success: Provider-payer relationship exists and is valid for this date
    RAISE NOTICE '[TRIGGER] ✅ Provider bookable with payer via %', v_row.via;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION enforce_bookable_provider_payer() IS
'Validates provider can see patients with this payer on this date.
Uses v_bookable_provider_payer canonical view.
NO PLAN VALIDATION - accepts all plans if provider is bookable with payer.';

-- ----------------------------------------------------------------------------
-- STEP 2: Drop Provider-Level Plan Junction Table
-- ----------------------------------------------------------------------------
-- This table was architecturally wrong: plans are practice-level, not provider-level

DROP TABLE IF EXISTS provider_payer_accepted_plans CASCADE;

-- ----------------------------------------------------------------------------
-- STEP 3: Drop Plan Validation Functions
-- ----------------------------------------------------------------------------
-- These functions enforced plan-level validation in booking trigger

DROP FUNCTION IF EXISTS does_provider_accept_plan(UUID, UUID, TEXT, DATE) CASCADE;
DROP FUNCTION IF EXISTS is_provider_in_network_for_plan(UUID, UUID, TEXT, DATE) CASCADE;
DROP FUNCTION IF EXISTS get_bookable_providers_for_plan(UUID, TEXT, DATE) CASCADE;

-- Note: Keeping resolve_plan_name_to_id() - may be useful for UI filtering later

-- ----------------------------------------------------------------------------
-- STEP 4: Drop Related Views
-- ----------------------------------------------------------------------------

DROP VIEW IF EXISTS v_provider_contracts_with_plans CASCADE;
DROP VIEW IF EXISTS v_contracts_needing_plan_assignment CASCADE;

-- ----------------------------------------------------------------------------
-- STEP 5: Verification
-- ----------------------------------------------------------------------------

DO $$
DECLARE
    v_trigger_uses_plan_validation BOOLEAN;
    v_junction_table_exists BOOLEAN;
BEGIN
    -- Verify trigger no longer references plan validation
    SELECT
        prosrc LIKE '%does_provider_accept_plan%' OR
        prosrc LIKE '%is_provider_in_network_for_plan%'
    INTO v_trigger_uses_plan_validation
    FROM pg_proc
    WHERE proname = 'enforce_bookable_provider_payer';

    ASSERT v_trigger_uses_plan_validation = FALSE,
        'Trigger still contains plan validation logic!';

    -- Verify junction table is dropped
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'provider_payer_accepted_plans'
    ) INTO v_junction_table_exists;

    ASSERT v_junction_table_exists = FALSE,
        'Junction table still exists!';

    RAISE NOTICE '';
    RAISE NOTICE '✅ Migration 034 complete: Plan validation removed from booking flow';
    RAISE NOTICE '';
    RAISE NOTICE 'What was removed:';
    RAISE NOTICE '  - provider_payer_accepted_plans table (wrong architecture)';
    RAISE NOTICE '  - Plan validation functions (premature enforcement)';
    RAISE NOTICE '  - Plan validation logic from booking trigger';
    RAISE NOTICE '';
    RAISE NOTICE 'What was kept:';
    RAISE NOTICE '  - payer_plans table (for future practice-level plan tracking)';
    RAISE NOTICE '  - payer_plan_aliases (for plan name resolution)';
    RAISE NOTICE '  - payer_networks (for network tracking)';
    RAISE NOTICE '  - resolve_plan_name_to_id() function (may be useful later)';
    RAISE NOTICE '';
    RAISE NOTICE 'Booking trigger now uses:';
    RAISE NOTICE '  - v_bookable_provider_payer view ONLY';
    RAISE NOTICE '  - Validates provider-payer bookability';
    RAISE NOTICE '  - NO plan-level validation';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Bookings will now work correctly!';
END $$;
