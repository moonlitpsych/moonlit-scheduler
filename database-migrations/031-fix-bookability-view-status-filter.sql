-- Migration 031: Fix Bookability View Status Filter
-- Purpose: Correct status value in WHERE clause - was 'active', should be 'in_network'
-- Context: Rollback accidentally used wrong status value, causing empty view
-- Date: 2025-10-31

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
WHERE ppn.status = 'in_network'  -- FIXED: provider_payer_networks uses 'in_network', not 'active'

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
    AND ppn_supervisor.status = 'in_network'  -- FIXED: was 'active'
WHERE sr.is_active = TRUE;

COMMENT ON VIEW v_bookable_provider_payer IS
'Canonical source of truth for provider-payer bookability.
UNION of direct contracts (in_network) and supervised relationships (supervised).
NOTE: provider_payer_networks.status uses ''in_network'', not ''active''.';

-- Verify
DO $$
DECLARE
    v_row_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_row_count FROM v_bookable_provider_payer;

    RAISE NOTICE '✅ Migration 031 complete: Bookability view fixed';
    RAISE NOTICE '   View row count: %', v_row_count;
    RAISE NOTICE '   Expected: 60+ rows (contracts + supervised relationships)';

    IF v_row_count = 0 THEN
        RAISE WARNING 'View is empty! Check provider_payer_networks.status values';
    END IF;
END $$;
