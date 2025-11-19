-- Migration 065: Add Bear River Behavioral Health (NOT IN-NETWORK)
-- Purpose: Add Bear River as searchable payer to show "not in-network" in booking flow
-- Context: Patients need to see that we don't accept this Medicaid payer
-- Date: 2025-11-19

-- ============================================================================
-- INSERT BEAR RIVER BEHAVIORAL HEALTH PAYER
-- ============================================================================

INSERT INTO payers (
    name,
    payer_type,
    state,
    status_code,
    requires_attending,
    requires_individual_contract,
    effective_date,
    projected_effective_date,
    notes
)
VALUES (
    'Bear River Behavioral Health',
    'medicaid',
    'UT',
    'not_in_network',  -- Indicates we don't have a contract
    FALSE,             -- No attending requirement (not applicable)
    FALSE,             -- No individual contract requirement (we're not in network)
    NULL,              -- No effective date (no contract)
    NULL,              -- No projected effective date
    'Medicaid mental health authority for northern Utah. We are NOT in-network with this payer. This entry exists for search/reference purposes only.'
)
ON CONFLICT (name) DO UPDATE SET
    payer_type = EXCLUDED.payer_type,
    state = EXCLUDED.state,
    status_code = EXCLUDED.status_code,
    notes = EXCLUDED.notes;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
    v_payer_id UUID;
    v_payer_name TEXT;
BEGIN
    SELECT id, name INTO v_payer_id, v_payer_name
    FROM payers
    WHERE name = 'Bear River Behavioral Health';

    IF v_payer_id IS NOT NULL THEN
        RAISE NOTICE '✅ Migration 065 complete: Bear River Behavioral Health added';
        RAISE NOTICE '   Payer ID: %', v_payer_id;
        RAISE NOTICE '   Payer Name: %', v_payer_name;
        RAISE NOTICE '   Status: NOT IN-NETWORK';
        RAISE NOTICE '';
        RAISE NOTICE 'This payer will appear in booking search results but show as not accepted.';
        RAISE NOTICE 'No provider contracts will be created for this payer.';
    ELSE
        RAISE EXCEPTION 'Migration failed: Bear River Behavioral Health not found after insert';
    END IF;
END $$;
