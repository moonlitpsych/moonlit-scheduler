-- Migration 028: Create Junction Table for Contract-Accepted Plans
-- Purpose: Link provider contracts to specific plans they accept
-- Context: One contract can accept multiple plans (e.g., "Select Choice, Select Care, Select Med")
-- Date: 2025-10-31

-- ============================================================================
-- CREATE JUNCTION TABLE
-- ============================================================================

CREATE TABLE provider_payer_accepted_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_payer_network_id UUID NOT NULL REFERENCES provider_payer_networks(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES payer_plans(id) ON DELETE CASCADE,
    notes TEXT,  -- Optional notes about this specific plan acceptance
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Prevent duplicate plan assignments
    CONSTRAINT unique_contract_plan UNIQUE (provider_payer_network_id, plan_id)
);

COMMENT ON TABLE provider_payer_accepted_plans IS
'Junction table linking provider contracts to specific plans they accept.
One contract (provider_payer_networks row) can accept multiple plans.
Example: Dr. Smith''s SelectHealth contract accepts "Choice", "Care", "Med" but NOT "Signature".';

COMMENT ON COLUMN provider_payer_accepted_plans.provider_payer_network_id IS
'FK to the provider''s contract with the payer (ONE row in provider_payer_networks)';

COMMENT ON COLUMN provider_payer_accepted_plans.plan_id IS
'FK to specific plan accepted under this contract (from payer_plans table)';

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX idx_ppap_contract_id ON provider_payer_accepted_plans(provider_payer_network_id);
CREATE INDEX idx_ppap_plan_id ON provider_payer_accepted_plans(plan_id);

-- Composite index for common query: "Does this contract accept this plan?"
CREATE INDEX idx_ppap_contract_plan_lookup ON provider_payer_accepted_plans(provider_payer_network_id, plan_id);

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================

CREATE TRIGGER update_provider_payer_accepted_plans_updated_at
    BEFORE UPDATE ON provider_payer_accepted_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE provider_payer_accepted_plans ENABLE ROW LEVEL SECURITY;

-- Read: authenticated users can read
CREATE POLICY "Allow read access to authenticated users"
ON provider_payer_accepted_plans FOR SELECT
USING (auth.role() = 'authenticated');

-- Write: service role only (admin operations)
CREATE POLICY "Allow service role full access"
ON provider_payer_accepted_plans FOR ALL
USING (auth.role() = 'service_role');

-- ============================================================================
-- HELPER VIEW: Contracts with Accepted Plans
-- ============================================================================

CREATE OR REPLACE VIEW v_provider_contracts_with_plans AS
SELECT
    ppn.id AS contract_id,
    ppn.provider_id,
    p.first_name || ' ' || p.last_name AS provider_name,
    ppn.payer_id,
    payer.name AS payer_name,
    ppn.effective_date,
    ppn.expiration_date,
    ppn.status,
    COUNT(ppap.id) AS accepted_plans_count,
    ARRAY_AGG(pp.plan_name ORDER BY pp.plan_name) FILTER (WHERE pp.plan_name IS NOT NULL) AS accepted_plan_names,
    ARRAY_AGG(pp.id) FILTER (WHERE pp.id IS NOT NULL) AS accepted_plan_ids
FROM provider_payer_networks ppn
JOIN providers p ON ppn.provider_id = p.id
JOIN payers payer ON ppn.payer_id = payer.id
LEFT JOIN provider_payer_accepted_plans ppap ON ppn.id = ppap.provider_payer_network_id
LEFT JOIN payer_plans pp ON ppap.plan_id = pp.id
WHERE ppn.status = 'active'
GROUP BY
    ppn.id,
    ppn.provider_id,
    p.first_name,
    p.last_name,
    ppn.payer_id,
    payer.name,
    ppn.effective_date,
    ppn.expiration_date,
    ppn.status;

COMMENT ON VIEW v_provider_contracts_with_plans IS
'Shows each provider contract with count and list of accepted plans.
Use this to see which plans each provider can accept under their contracts.';

-- ============================================================================
-- HELPER VIEW: Contracts Needing Plan Assignment
-- ============================================================================

CREATE OR REPLACE VIEW v_contracts_needing_plan_assignment AS
SELECT
    ppn.id AS contract_id,
    p.first_name || ' ' || p.last_name AS provider_name,
    payer.name AS payer_name,
    ppn.effective_date,
    CASE
        WHEN payer.name ILIKE '%regence%' THEN 'HIGH_PRIORITY'
        WHEN payer.name ILIKE '%selecthealth%' THEN 'HIGH_PRIORITY'
        WHEN payer.name ILIKE '%aetna%' THEN 'HIGH_PRIORITY'
        ELSE 'NORMAL'
    END AS priority,
    COUNT(pp.id) AS available_plans_for_payer
FROM provider_payer_networks ppn
JOIN providers p ON ppn.provider_id = p.id
JOIN payers payer ON ppn.payer_id = payer.id
LEFT JOIN provider_payer_accepted_plans ppap ON ppn.id = ppap.provider_payer_network_id
LEFT JOIN payer_plans pp ON payer.id = pp.payer_id AND pp.is_active = TRUE
WHERE ppn.status = 'active'
  AND ppap.id IS NULL  -- No plans assigned yet
GROUP BY
    ppn.id,
    p.first_name,
    p.last_name,
    payer.name,
    ppn.effective_date
ORDER BY
    CASE
        WHEN payer.name ILIKE '%regence%' THEN 1
        WHEN payer.name ILIKE '%selecthealth%' THEN 1
        WHEN payer.name ILIKE '%aetna%' THEN 1
        ELSE 2
    END,
    payer.name;

COMMENT ON VIEW v_contracts_needing_plan_assignment IS
'Identifies contracts that have NO plans assigned yet.
Prioritizes Big 3 payers (Regence, SelectHealth, Aetna).
Use this to identify which contracts need plan documentation.';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
    v_table_exists BOOLEAN;
    v_view1_exists BOOLEAN;
    v_view2_exists BOOLEAN;
BEGIN
    -- Check table created
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'provider_payer_accepted_plans'
    ) INTO v_table_exists;

    -- Check views created
    SELECT EXISTS (
        SELECT 1 FROM information_schema.views
        WHERE table_name = 'v_provider_contracts_with_plans'
    ) INTO v_view1_exists;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.views
        WHERE table_name = 'v_contracts_needing_plan_assignment'
    ) INTO v_view2_exists;

    ASSERT v_table_exists, 'provider_payer_accepted_plans table not created';
    ASSERT v_view1_exists, 'v_provider_contracts_with_plans view not created';
    ASSERT v_view2_exists, 'v_contracts_needing_plan_assignment view not created';

    RAISE NOTICE '';
    RAISE NOTICE '✅ Migration 028 complete: Junction table created';
    RAISE NOTICE '   Table: provider_payer_accepted_plans';
    RAISE NOTICE '   View: v_provider_contracts_with_plans (shows accepted plans per contract)';
    RAISE NOTICE '   View: v_contracts_needing_plan_assignment (identifies contracts needing plans)';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '   1. Query: SELECT * FROM v_contracts_needing_plan_assignment;';
    RAISE NOTICE '   2. For each contract, add accepted plans to junction table';
    RAISE NOTICE '   3. Example: INSERT INTO provider_payer_accepted_plans (provider_payer_network_id, plan_id)';
    RAISE NOTICE '      VALUES ([contract-id], [plan-id]);';
END $$;
