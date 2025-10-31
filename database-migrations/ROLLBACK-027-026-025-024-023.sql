-- ROLLBACK SCRIPT: Undo migrations 023-027
-- Run this to remove incorrect network_id implementation
-- Date: 2025-10-31

-- ============================================================================
-- ROLLBACK 027: Remove plan-aware trigger (we'll recreate correctly)
-- ============================================================================

-- Restore original trigger function (without plan validation)
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

    -- Simple payer-level validation (original logic)
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
        AND v_dos >= COALESCE(b.bookable_from_date, b.effective_date)
        AND (b.expiration_date IS NULL OR v_dos <= b.expiration_date)
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Not bookable for this payer on the selected date';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
    RAISE NOTICE '✅ Rolled back migration 027: Trigger restored to payer-level validation';
END $$;

-- ============================================================================
-- ROLLBACK 025: Restore original v_bookable_provider_payer view
-- ============================================================================

DROP VIEW IF EXISTS v_bookable_provider_payer CASCADE;

CREATE OR REPLACE VIEW v_bookable_provider_payer AS

-- Direct contracts
SELECT
    ppn.provider_id,
    ppn.payer_id,
    'in_network'::TEXT AS network_status,
    NULL::UUID AS billing_provider_id,
    NULL::UUID AS rendering_provider_id,
    ppn.effective_date,
    ppn.effective_date AS bookable_from_date,
    ppn.expiration_date,
    ppn.status
FROM provider_payer_networks ppn
WHERE ppn.status = 'active'

UNION

-- Supervised relationships
SELECT
    sr.supervisee_provider_id AS provider_id,
    sr.payer_id,
    'supervised'::TEXT AS network_status,
    sr.supervisor_provider_id AS billing_provider_id,
    sr.supervisee_provider_id AS rendering_provider_id,
    sr.start_date AS effective_date,
    sr.start_date AS bookable_from_date,
    sr.end_date AS expiration_date,
    CASE
        WHEN sr.is_active THEN 'active'::TEXT
        ELSE 'inactive'::TEXT
    END AS status
FROM supervision_relationships sr
JOIN provider_payer_networks ppn_supervisor
    ON sr.supervisor_provider_id = ppn_supervisor.provider_id
    AND sr.payer_id = ppn_supervisor.payer_id
    AND ppn_supervisor.status = 'active'
WHERE sr.is_active = TRUE;

DO $$ BEGIN
    RAISE NOTICE '✅ Rolled back migration 025: View restored to original structure';
END $$;

-- ============================================================================
-- ROLLBACK 024: Drop plan resolution functions
-- ============================================================================

DROP FUNCTION IF EXISTS get_bookable_providers_for_plan(UUID, TEXT, DATE);
DROP FUNCTION IF EXISTS is_provider_in_network_for_plan(UUID, UUID, TEXT, DATE);
DROP FUNCTION IF EXISTS resolve_plan_to_network(UUID, TEXT);

DO $$ BEGIN
    RAISE NOTICE '✅ Rolled back migration 024: Dropped plan resolution functions';
END $$;

-- ============================================================================
-- ROLLBACK 023: Remove network_id and plan_id from provider_payer_networks
-- ============================================================================

-- Drop helper views FIRST (they depend on the columns)
DROP VIEW IF EXISTS v_provider_payer_networks_needing_network CASCADE;
DROP VIEW IF EXISTS v_providers_needing_network_assignment CASCADE;

-- Now safe to drop columns
ALTER TABLE provider_payer_networks DROP COLUMN IF EXISTS network_id;
ALTER TABLE provider_payer_networks DROP COLUMN IF EXISTS plan_id;
ALTER TABLE provider_payer_networks DROP COLUMN IF EXISTS network_notes;

DO $$ BEGIN
    RAISE NOTICE '✅ Rolled back migration 023: Removed network_id and plan_id columns';
END $$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅ ROLLBACK COMPLETE';
    RAISE NOTICE '';
    RAISE NOTICE 'What was kept:';
    RAISE NOTICE '  ✅ Migration 022: payer_networks, payer_plans, payer_plan_aliases, payer_plan_routing_ids tables';
    RAISE NOTICE '  ✅ Migration 026: Big 3 payer seed data';
    RAISE NOTICE '';
    RAISE NOTICE 'What was rolled back:';
    RAISE NOTICE '  ❌ Migration 027: Plan-aware trigger (will recreate with junction table)';
    RAISE NOTICE '  ❌ Migration 025: View with network columns';
    RAISE NOTICE '  ❌ Migration 024: Plan resolution functions (will recreate with junction table)';
    RAISE NOTICE '  ❌ Migration 023: network_id/plan_id on provider_payer_networks';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '  1. Create provider_payer_accepted_plans junction table';
    RAISE NOTICE '  2. Recreate plan resolution functions with junction table logic';
    RAISE NOTICE '  3. Recreate booking trigger with junction table validation';
END $$;
