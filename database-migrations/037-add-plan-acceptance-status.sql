-- Migration 037: Add Plan Acceptance Status and Provider Overrides
-- Created: 2025-11-11
-- Purpose: Track which insurance plans are accepted (in-network) or not accepted (out-of-network)
--          at the practice level, with optional provider-specific overrides.
--
-- Context: This is for INFORMATIONAL/UI purposes only - does NOT affect booking validation.
--          Booking validation only checks provider-payer relationships via v_bookable_provider_payer.
--          See CLAUDE.md section "Payer Plan Tracking Infrastructure" for full context.

-- =============================================
-- STEP 1: Create acceptance_status enum type
-- =============================================
-- Values:
--   - in_network: Moonlit practice accepts this plan
--   - not_in_network: Moonlit does not accept this plan
--   - unknown: Status not yet determined (triggers "needs review" in UI)

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'acceptance_status') THEN
        CREATE TYPE acceptance_status AS ENUM ('in_network', 'not_in_network', 'unknown');
    END IF;
END $$;

-- =============================================
-- STEP 2: Add acceptance_status column to payer_plans
-- =============================================
-- This tracks the DEFAULT acceptance status for each plan at the practice level.
-- If a provider has an override (via provider_plan_overrides), that takes precedence.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'payer_plans'
          AND column_name = 'acceptance_status'
    ) THEN
        ALTER TABLE payer_plans
        ADD COLUMN acceptance_status acceptance_status DEFAULT 'unknown' NOT NULL;

        -- Create index for faster filtering
        CREATE INDEX idx_payer_plans_acceptance_status
        ON payer_plans(acceptance_status)
        WHERE is_active = TRUE;
    END IF;
END $$;

-- =============================================
-- STEP 3: Create provider_plan_overrides table
-- =============================================
-- Allows individual providers to override the practice-level acceptance_status
-- for specific plans. Example: Dr. Smith might not accept a plan that the
-- practice generally accepts.
--
-- NOTE: Currently not used in production. Practice-level acceptance is sufficient
--       for MVP. This table exists for future flexibility.

CREATE TABLE IF NOT EXISTS provider_plan_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Provider applying the override
    provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,

    -- Plan being overridden
    plan_id UUID NOT NULL REFERENCES payer_plans(id) ON DELETE CASCADE,

    -- Override value (takes precedence over payer_plans.acceptance_status)
    acceptance_status acceptance_status NOT NULL,

    -- Reason for override (e.g., "Dr. Smith not credentialed for this network")
    notes TEXT,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    -- Ensure one override per provider-plan pair
    UNIQUE(provider_id, plan_id)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_provider_plan_overrides_provider
ON provider_plan_overrides(provider_id);

CREATE INDEX IF NOT EXISTS idx_provider_plan_overrides_plan
ON provider_plan_overrides(plan_id);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_provider_plan_overrides_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_provider_plan_overrides_updated_at ON provider_plan_overrides;
CREATE TRIGGER update_provider_plan_overrides_updated_at
    BEFORE UPDATE ON provider_plan_overrides
    FOR EACH ROW
    EXECUTE FUNCTION update_provider_plan_overrides_updated_at();

-- =============================================
-- STEP 4: Create get_payer_plans_for_ui function
-- =============================================
-- Returns all plans for a given payer, optionally filtered by provider.
-- If provider_id is provided, applies provider-specific overrides.
--
-- Returns:
--   - payer_id, payer_name
--   - plan_id, plan_name, plan_type
--   - is_active, effective_date, expiration_date
--   - acceptance_status (from override if exists, else from plan default)
--   - status_source ('provider_override' or 'plan_default')
--   - notes (from override if exists, else from plan)
--   - provider_has_contract (true if provider has direct contract with payer)

CREATE OR REPLACE FUNCTION get_payer_plans_for_ui(
    in_payer_id UUID,
    in_provider_id UUID DEFAULT NULL
)
RETURNS TABLE (
    payer_id UUID,
    payer_name TEXT,
    plan_id UUID,
    plan_name TEXT,
    plan_type TEXT,
    is_active BOOLEAN,
    effective_date DATE,
    expiration_date DATE,
    acceptance_status acceptance_status,
    status_source TEXT,
    notes TEXT,
    provider_has_contract BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id AS payer_id,
        p.payer_name,
        pp.id AS plan_id,
        pp.plan_name,
        pp.plan_type,
        pp.is_active,
        pp.effective_date,
        pp.expiration_date,
        -- Use override if exists, else plan default
        COALESCE(ppo.acceptance_status, pp.acceptance_status) AS acceptance_status,
        -- Indicate source of acceptance_status
        CASE
            WHEN ppo.id IS NOT NULL THEN 'provider_override'::TEXT
            ELSE 'plan_default'::TEXT
        END AS status_source,
        -- Use override notes if exists, else plan notes
        COALESCE(ppo.notes, pp.notes) AS notes,
        -- Check if provider has contract with this payer
        CASE
            WHEN in_provider_id IS NULL THEN NULL
            ELSE EXISTS (
                SELECT 1
                FROM v_bookable_provider_payer vbpp
                WHERE vbpp.provider_id = in_provider_id
                  AND vbpp.payer_id = p.id
            )
        END AS provider_has_contract
    FROM payers p
    INNER JOIN payer_plans pp ON pp.payer_id = p.id
    LEFT JOIN provider_plan_overrides ppo
        ON ppo.plan_id = pp.id
        AND ppo.provider_id = in_provider_id
    WHERE p.id = in_payer_id
      AND pp.is_active = TRUE
      AND (pp.effective_date IS NULL OR pp.effective_date <= CURRENT_DATE)
      AND (pp.expiration_date IS NULL OR pp.expiration_date > CURRENT_DATE)
    ORDER BY
        -- Sort by acceptance status (accepted first, then not accepted, then unknown)
        CASE COALESCE(ppo.acceptance_status, pp.acceptance_status)
            WHEN 'in_network'::acceptance_status THEN 1
            WHEN 'not_in_network'::acceptance_status THEN 2
            WHEN 'unknown'::acceptance_status THEN 3
        END,
        -- Then alphabetically by plan name
        pp.plan_name ASC;
END;
$$;

-- =============================================
-- STEP 5: Add helpful comments
-- =============================================

COMMENT ON COLUMN payer_plans.acceptance_status IS
'Default acceptance status for this plan at the practice level. Can be overridden per-provider via provider_plan_overrides. Values: in_network (accepted), not_in_network (not accepted), unknown (needs review). For UI display only - does NOT affect booking validation.';

COMMENT ON TABLE provider_plan_overrides IS
'Provider-specific overrides for plan acceptance status. Allows individual providers to accept/reject plans differently from practice default. Currently unused in production.';

COMMENT ON FUNCTION get_payer_plans_for_ui(UUID, UUID) IS
'Returns all plans for a payer with acceptance status (optionally provider-specific). Used by booking UI to show which plans are accepted. Does NOT affect booking validation logic.';

-- =============================================
-- VERIFICATION QUERIES (for testing)
-- =============================================

-- Test the function with SelectHealth
-- SELECT * FROM get_payer_plans_for_ui('d37d3938-b48d-4bdf-b500-bf5413157ef4');

-- Check acceptance status distribution
-- SELECT acceptance_status, COUNT(*)
-- FROM payer_plans
-- WHERE is_active = TRUE
-- GROUP BY acceptance_status;
