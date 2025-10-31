-- Migration 025: Update v_bookable_provider_payer with Network and Plan Support
-- Purpose: Extend canonical bookability view to include network/plan filtering
-- Context: Enable plan-specific provider matching for booking flow
-- Date: 2025-10-31

-- ============================================================================
-- DROP AND RECREATE CANONICAL VIEW
-- ============================================================================

DROP VIEW IF EXISTS v_bookable_provider_payer CASCADE;

CREATE OR REPLACE VIEW v_bookable_provider_payer AS

-- ============================================================================
-- PART 1: DIRECT PROVIDER-PAYER CONTRACTS (in_network)
-- ============================================================================
SELECT
    ppn.provider_id,
    ppn.payer_id,
    'in_network'::TEXT AS network_status,
    NULL::UUID AS billing_provider_id,
    NULL::UUID AS rendering_provider_id,
    ppn.effective_date,
    ppn.effective_date AS bookable_from_date,
    ppn.expiration_date,
    ppn.status,
    -- NEW: Network and plan information
    ppn.network_id,
    ppn.plan_id,
    pn.network_name,
    pn.network_code,
    pp.plan_name,
    pp.plan_type,
    -- Helper fields
    CASE
        WHEN ppn.network_id IS NULL THEN 'All networks under this payer'
        ELSE pn.network_name
    END AS network_display_name,
    CASE
        WHEN ppn.plan_id IS NULL THEN 'All plans in network'
        ELSE pp.plan_name
    END AS plan_display_name
FROM provider_payer_networks ppn
LEFT JOIN payer_networks pn ON ppn.network_id = pn.id
LEFT JOIN payer_plans pp ON ppn.plan_id = pp.id
WHERE ppn.status = 'active'

UNION

-- ============================================================================
-- PART 2: SUPERVISED RELATIONSHIPS (supervised)
-- ============================================================================
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
    END AS status,
    -- NEW: Network and plan information (inherited from supervisor's contract)
    ppn_supervisor.network_id,
    ppn_supervisor.plan_id,
    pn.network_name,
    pn.network_code,
    pp.plan_name,
    pp.plan_type,
    -- Helper fields
    CASE
        WHEN ppn_supervisor.network_id IS NULL THEN 'All networks under this payer'
        ELSE pn.network_name
    END AS network_display_name,
    CASE
        WHEN ppn_supervisor.plan_id IS NULL THEN 'All plans in network'
        ELSE pp.plan_name
    END AS plan_display_name
FROM supervision_relationships sr
-- Join to supervisor's provider_payer_network contract (supervisee inherits supervisor's network)
JOIN provider_payer_networks ppn_supervisor
    ON sr.supervisor_provider_id = ppn_supervisor.provider_id
    AND sr.payer_id = ppn_supervisor.payer_id
    AND ppn_supervisor.status = 'active'
LEFT JOIN payer_networks pn ON ppn_supervisor.network_id = pn.id
LEFT JOIN payer_plans pp ON ppn_supervisor.plan_id = pp.id
WHERE sr.is_active = TRUE;

-- ============================================================================
-- VIEW COMMENTS
-- ============================================================================

COMMENT ON VIEW v_bookable_provider_payer IS
'Canonical source of truth for provider-payer bookability. Includes network and plan filtering support.
UNION of:
1. Direct contracts (provider_payer_networks) - network_status = ''in_network''
2. Supervised relationships (supervision_relationships) - network_status = ''supervised''

Network/Plan Filtering:
- network_id IS NULL = provider accepts ALL networks under this payer (backward compatible)
- plan_id IS NULL = provider accepts ALL plans in this network (normal case)
- network_id NOT NULL = provider only accepts specific network
- plan_id NOT NULL = provider only accepts specific plan (rare)

Usage:
- Booking trigger uses this view to validate appointments
- Booking API queries this view to filter available providers
- Admin dashboard uses this view to show provider-payer relationships

See functions:
- resolve_plan_to_network(payer_id, plan_string) - Maps plan string to network
- is_provider_in_network_for_plan() - Checks specific provider eligibility
- get_bookable_providers_for_plan() - Returns all bookable providers for plan';

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Note: Views don't have indexes, but the underlying tables do
-- Ensure provider_payer_networks has necessary indexes (added in migration 023)

-- ============================================================================
-- HELPER VIEW: Providers needing network assignment
-- ============================================================================

CREATE OR REPLACE VIEW v_providers_needing_network_assignment AS
SELECT
    vbpp.provider_id,
    p.first_name || ' ' || p.last_name AS provider_name,
    vbpp.payer_id,
    payer.name AS payer_name,
    vbpp.network_status,
    vbpp.network_id,
    vbpp.network_display_name,
    vbpp.effective_date,
    CASE
        WHEN payer.name ILIKE '%regence%' THEN 'HIGH_PRIORITY'
        WHEN payer.name ILIKE '%selecthealth%' THEN 'HIGH_PRIORITY'
        WHEN payer.name ILIKE '%aetna%' THEN 'HIGH_PRIORITY'
        ELSE 'LOW_PRIORITY'
    END AS assignment_priority
FROM v_bookable_provider_payer vbpp
JOIN providers p ON vbpp.provider_id = p.id
JOIN payers payer ON vbpp.payer_id = payer.id
WHERE vbpp.network_id IS NULL  -- No network assigned
  AND vbpp.status = 'active'
  AND (
      payer.name ILIKE '%regence%'
      OR payer.name ILIKE '%selecthealth%'
      OR payer.name ILIKE '%aetna%'
  );

COMMENT ON VIEW v_providers_needing_network_assignment IS
'Identifies providers with Big 3 payers (Regence, SelectHealth, Aetna) who need network assignment';

-- ============================================================================
-- BACKWARD COMPATIBILITY VERIFICATION
-- ============================================================================

-- Verify the view still returns the same core columns as before
DO $$
DECLARE
    v_col_count INTEGER;
BEGIN
    -- Check that view has expected columns
    SELECT COUNT(*)
    INTO v_col_count
    FROM information_schema.columns
    WHERE table_name = 'v_bookable_provider_payer'
      AND column_name IN ('provider_id', 'payer_id', 'network_status', 'billing_provider_id', 'rendering_provider_id', 'effective_date', 'bookable_from_date', 'expiration_date');

    ASSERT v_col_count >= 8, 'View missing expected core columns';

    RAISE NOTICE '✅ Migration 025 complete: v_bookable_provider_payer view updated with network/plan support';
    RAISE NOTICE '   Core columns preserved for backward compatibility';
    RAISE NOTICE '   New columns: network_id, plan_id, network_name, plan_name, network_display_name, plan_display_name';
END $$;

-- ============================================================================
-- TESTING QUERIES
-- ============================================================================

-- Test 1: Verify backward compatibility (should return same providers as before)
-- SELECT COUNT(*) FROM v_bookable_provider_payer WHERE status = 'active';

-- Test 2: View providers needing network assignment for Big 3 payers
-- SELECT * FROM v_providers_needing_network_assignment ORDER BY assignment_priority, payer_name;

-- Test 3: Check a specific provider-payer relationship with network info
-- SELECT
--   provider_id,
--   payer_id,
--   network_status,
--   network_display_name,
--   plan_display_name
-- FROM v_bookable_provider_payer
-- WHERE provider_id = '504d53c6-54ef-40b0-81d4-80812c2c7bfd'  -- Example provider ID
-- LIMIT 5;
