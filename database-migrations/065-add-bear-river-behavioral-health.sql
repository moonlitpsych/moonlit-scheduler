-- Migration 065: Add Bear River Behavioral Health (NOT IN-NETWORK)
-- Purpose: Add Bear River as searchable payer to show "not in-network" in booking flow
-- Context: Patients need to see that we don't accept this Medicaid payer
-- Date: 2025-11-19

-- ============================================================================
-- STEP 1: Ensure notes column exists (may not be in production yet)
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'payers' AND column_name = 'notes'
    ) THEN
        ALTER TABLE payers ADD COLUMN notes TEXT;
        RAISE NOTICE 'Added notes column to payers table';
    END IF;
END $$;

-- ============================================================================
-- STEP 2: INSERT BEAR RIVER BEHAVIORAL HEALTH PAYER
-- ============================================================================

-- Check if payer already exists, if not insert it
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM payers WHERE name = 'Bear River Behavioral Health') THEN
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
        );
        RAISE NOTICE 'Bear River Behavioral Health payer inserted';
    ELSE
        -- Update existing record
        UPDATE payers SET
            payer_type = 'medicaid',
            state = 'UT',
            status_code = 'not_in_network',
            notes = 'Medicaid mental health authority for northern Utah. We are NOT in-network with this payer. This entry exists for search/reference purposes only.'
        WHERE name = 'Bear River Behavioral Health';
        RAISE NOTICE 'Bear River Behavioral Health payer updated';
    END IF;
END $$;

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
