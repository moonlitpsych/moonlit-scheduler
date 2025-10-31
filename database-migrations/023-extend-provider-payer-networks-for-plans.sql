-- Migration 023: Extend provider_payer_networks for Plan-Level Contracts
-- Purpose: Link provider contracts to specific networks and plans
-- Context: Providers may participate in some networks/plans but not others under same payer
-- Date: 2025-10-31

-- ============================================================================
-- ADD NETWORK AND PLAN COLUMNS
-- ============================================================================

-- Add network_id: Links provider contract to specific network within payer
-- NULL = provider is in network for ALL networks under this payer (legacy behavior)
ALTER TABLE provider_payer_networks
ADD COLUMN network_id UUID REFERENCES payer_networks(id) ON DELETE SET NULL;

-- Add plan_id: For rare cases where provider contract is plan-specific
-- NULL = provider accepts all plans within the network (normal behavior)
ALTER TABLE provider_payer_networks
ADD COLUMN plan_id UUID REFERENCES payer_plans(id) ON DELETE SET NULL;

-- Add notes about network participation
ALTER TABLE provider_payer_networks
ADD COLUMN network_notes TEXT;

COMMENT ON COLUMN provider_payer_networks.network_id IS 'Specific network within payer (NULL = all networks)';
COMMENT ON COLUMN provider_payer_networks.plan_id IS 'Specific plan within payer (NULL = all plans in network)';
COMMENT ON COLUMN provider_payer_networks.network_notes IS 'Notes about network participation (e.g., limitations, special requirements)';

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX idx_provider_payer_networks_network_id ON provider_payer_networks(network_id);
CREATE INDEX idx_provider_payer_networks_plan_id ON provider_payer_networks(plan_id);

-- Composite index for common query pattern: find providers in specific payer+network
CREATE INDEX idx_provider_payer_networks_payer_network ON provider_payer_networks(payer_id, network_id)
WHERE status = 'active';

-- ============================================================================
-- VALIDATION CONSTRAINTS
-- ============================================================================

-- If plan_id is specified, network_id should also be specified (plans belong to networks)
-- Exception: some plans may not have a specific network (legacy/ambiguous plans)
-- So we'll just add a helpful comment rather than a hard constraint

COMMENT ON CONSTRAINT provider_payer_networks_pkey ON provider_payer_networks IS
'Primary key. Note: plan_id typically requires network_id to be set as well';

-- ============================================================================
-- DATA MIGRATION HELPER VIEW
-- ============================================================================

-- View to help identify which existing contracts need network assignment
CREATE OR REPLACE VIEW v_provider_payer_networks_needing_network AS
SELECT
    ppn.id,
    ppn.provider_id,
    p.first_name || ' ' || p.last_name AS provider_name,
    ppn.payer_id,
    payer.name AS payer_name,
    ppn.network_id,
    ppn.status,
    ppn.effective_date,
    ppn.expiration_date,
    CASE
        WHEN payer.name ILIKE '%regence%' THEN 'NEEDS_NETWORK_ASSIGNMENT'
        WHEN payer.name ILIKE '%selecthealth%' THEN 'NEEDS_NETWORK_ASSIGNMENT'
        WHEN payer.name ILIKE '%aetna%' THEN 'NEEDS_NETWORK_ASSIGNMENT'
        ELSE 'SINGLE_NETWORK_PAYER'
    END AS network_assignment_status
FROM provider_payer_networks ppn
JOIN providers p ON ppn.provider_id = p.id
JOIN payers payer ON ppn.payer_id = payer.id
WHERE ppn.network_id IS NULL
  AND ppn.status = 'active';

COMMENT ON VIEW v_provider_payer_networks_needing_network IS
'Identifies provider-payer contracts that should be assigned to specific networks';

-- ============================================================================
-- BACKWARD COMPATIBILITY NOTES
-- ============================================================================

-- Existing behavior preserved:
-- - provider_payer_networks.network_id = NULL means "all networks" (backward compatible)
-- - provider_payer_networks.plan_id = NULL means "all plans" (backward compatible)
-- - Existing v_bookable_provider_payer view will still work (will be updated in next migration)

-- Migration strategy for existing contracts:
-- 1. All existing contracts remain NULL for network_id/plan_id (work as before)
-- 2. Gradually assign network_id for Big 3 payers (Regence, SelectHealth, Aetna)
-- 3. Most contracts will never need plan_id (network-level is sufficient)

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

DO $$
DECLARE
    v_network_col_exists BOOLEAN;
    v_plan_col_exists BOOLEAN;
BEGIN
    -- Check if columns were added
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'provider_payer_networks' AND column_name = 'network_id'
    ) INTO v_network_col_exists;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'provider_payer_networks' AND column_name = 'plan_id'
    ) INTO v_plan_col_exists;

    ASSERT v_network_col_exists, 'network_id column not created';
    ASSERT v_plan_col_exists, 'plan_id column not created';

    RAISE NOTICE '✅ Migration 023 complete: provider_payer_networks extended with network_id and plan_id';
    RAISE NOTICE '   Existing contracts remain backward compatible (NULL = all networks/plans)';
END $$;
