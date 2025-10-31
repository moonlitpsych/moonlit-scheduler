-- Migration 022: Add Multi-Plan Network Architecture
-- Purpose: Enable plan-level insurance verification to prevent booking errors
-- Context: Addresses production issues with Regence, SelectHealth, and Aetna sub-plans
-- Date: 2025-10-31

-- ============================================================================
-- TABLE 1: PAYER_NETWORKS
-- ============================================================================
-- Represents distinct networks within a payer (e.g., Regence BHPN, SelectHealth Traditional)
-- Providers participate in specific networks, not just payers

CREATE TABLE payer_networks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payer_id UUID NOT NULL REFERENCES payers(id) ON DELETE CASCADE,
    network_name TEXT NOT NULL,
    network_code TEXT,  -- Short code for internal use (e.g., "BHPN", "TRAD")
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_network_per_payer UNIQUE (payer_id, network_code)
);

CREATE INDEX idx_payer_networks_payer_id ON payer_networks(payer_id);
CREATE INDEX idx_payer_networks_active ON payer_networks(is_active) WHERE is_active = TRUE;

COMMENT ON TABLE payer_networks IS 'Provider networks within each payer (e.g., Regence BHPN vs Traditional)';
COMMENT ON COLUMN payer_networks.network_code IS 'Short code for network identification (e.g., BHPN, TRAD, ADV)';

-- ============================================================================
-- TABLE 2: PAYER_PLANS
-- ============================================================================
-- Represents actual health plans that members carry
-- Links to networks (many plans can belong to one network)

CREATE TABLE payer_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payer_id UUID NOT NULL REFERENCES payers(id) ON DELETE CASCADE,
    network_id UUID REFERENCES payer_networks(id) ON DELETE SET NULL,  -- NULL = network unknown/ambiguous
    plan_name TEXT NOT NULL,
    plan_type TEXT CHECK (plan_type IN ('HMO', 'PPO', 'EPO', 'POS', 'HDHP', 'OTHER')),
    is_default BOOLEAN NOT NULL DEFAULT FALSE,  -- Fallback if specific plan can't be resolved
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    effective_date DATE,
    expiration_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_plan_per_payer UNIQUE (payer_id, plan_name),
    CONSTRAINT valid_date_range CHECK (expiration_date IS NULL OR expiration_date >= effective_date)
);

CREATE INDEX idx_payer_plans_payer_id ON payer_plans(payer_id);
CREATE INDEX idx_payer_plans_network_id ON payer_plans(network_id);
CREATE INDEX idx_payer_plans_default ON payer_plans(is_default) WHERE is_default = TRUE;
CREATE INDEX idx_payer_plans_active ON payer_plans(is_active) WHERE is_active = TRUE;

COMMENT ON TABLE payer_plans IS 'Specific health plans that patients carry (e.g., Regence PPO, SelectHealth Advantage)';
COMMENT ON COLUMN payer_plans.is_default IS 'Use this plan as fallback if we cannot resolve the specific plan from 271/card';
COMMENT ON COLUMN payer_plans.network_id IS 'Optional link to network; NULL means network is ambiguous or plan-agnostic';

-- ============================================================================
-- TABLE 3: PAYER_PLAN_ALIASES
-- ============================================================================
-- Maps messy strings from 271 responses and insurance cards to canonical plans
-- Handles variations like "REGENCE BCBS", "Regence BlueShield", "BCBS of UT"

CREATE TABLE payer_plan_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES payer_plans(id) ON DELETE CASCADE,
    alias_string TEXT NOT NULL,  -- Exact string as it appears in 271/card
    source TEXT NOT NULL CHECK (source IN ('271_response', 'insurance_card', 'clearinghouse', 'manual', 'other')),
    priority INTEGER NOT NULL DEFAULT 50,  -- Higher = preferred match (useful when multiple aliases match)
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_alias_string UNIQUE (alias_string)
);

CREATE INDEX idx_payer_plan_aliases_plan_id ON payer_plan_aliases(plan_id);
CREATE INDEX idx_payer_plan_aliases_string ON payer_plan_aliases(alias_string);
CREATE INDEX idx_payer_plan_aliases_active ON payer_plan_aliases(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_payer_plan_aliases_priority ON payer_plan_aliases(priority DESC);

COMMENT ON TABLE payer_plan_aliases IS 'Maps messy real-world plan strings to canonical payer_plans';
COMMENT ON COLUMN payer_plan_aliases.priority IS 'When multiple aliases match, use highest priority (default 50)';
COMMENT ON COLUMN payer_plan_aliases.source IS 'Where this alias was observed (271 response, insurance card, etc.)';

-- ============================================================================
-- TABLE 4: PAYER_PLAN_ROUTING_IDS
-- ============================================================================
-- Clearinghouse-specific routing IDs for claims submission and eligibility checks
-- Different clearinghouses use different IDs for the same plan

CREATE TABLE payer_plan_routing_ids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES payer_plans(id) ON DELETE CASCADE,
    clearinghouse TEXT NOT NULL,  -- e.g., "Office Ally", "Change Healthcare", "Availity"
    routing_id TEXT NOT NULL,  -- Clearinghouse-specific identifier
    id_type TEXT NOT NULL CHECK (id_type IN ('payer_id', 'submitter_id', 'receiver_id', 'plan_id', 'other')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_routing_per_clearinghouse UNIQUE (plan_id, clearinghouse, id_type)
);

CREATE INDEX idx_payer_plan_routing_clearinghouse ON payer_plan_routing_ids(clearinghouse);
CREATE INDEX idx_payer_plan_routing_plan_id ON payer_plan_routing_ids(plan_id);
CREATE INDEX idx_payer_plan_routing_active ON payer_plan_routing_ids(is_active) WHERE is_active = TRUE;

COMMENT ON TABLE payer_plan_routing_ids IS 'Clearinghouse-specific routing IDs for claims and eligibility';
COMMENT ON COLUMN payer_plan_routing_ids.routing_id IS 'The actual ID used by the clearinghouse for this plan';
COMMENT ON COLUMN payer_plan_routing_ids.id_type IS 'Type of identifier (payer_id, submitter_id, etc.)';

-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_payer_networks_updated_at
    BEFORE UPDATE ON payer_networks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payer_plans_updated_at
    BEFORE UPDATE ON payer_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payer_plan_routing_ids_updated_at
    BEFORE UPDATE ON payer_plan_routing_ids
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
-- All tables are reference data, readable by authenticated users
-- Only admins can modify

ALTER TABLE payer_networks ENABLE ROW LEVEL SECURITY;
ALTER TABLE payer_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE payer_plan_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE payer_plan_routing_ids ENABLE ROW LEVEL SECURITY;

-- Read policies: authenticated users can read
CREATE POLICY "Allow read access to authenticated users" ON payer_networks FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow read access to authenticated users" ON payer_plans FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow read access to authenticated users" ON payer_plan_aliases FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow read access to authenticated users" ON payer_plan_routing_ids FOR SELECT USING (auth.role() = 'authenticated');

-- Write policies: service role only (admin operations)
CREATE POLICY "Allow service role full access" ON payer_networks FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service role full access" ON payer_plans FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service role full access" ON payer_plan_aliases FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service role full access" ON payer_plan_routing_ids FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify tables created
DO $$
BEGIN
    ASSERT (SELECT COUNT(*) FROM information_schema.tables WHERE table_name IN ('payer_networks', 'payer_plans', 'payer_plan_aliases', 'payer_plan_routing_ids')) = 4,
        'Expected 4 new tables to be created';

    RAISE NOTICE '✅ Migration 022 complete: 4 new tables created for multi-plan network architecture';
END $$;
