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
-- STEP 2: Check and Add Valid Status Code if Needed
-- ============================================================================

DO $$
DECLARE
    v_has_constraint BOOLEAN;
    v_valid_status TEXT;
BEGIN
    -- Check if there's a foreign key constraint on status_code
    SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
        WHERE tc.table_name = 'payers'
        AND ccu.column_name = 'status_code'
        AND tc.constraint_type = 'FOREIGN KEY'
    ) INTO v_has_constraint;

    IF v_has_constraint THEN
        -- Try to add 'not_in_network' as a valid status if the table exists
        BEGIN
            INSERT INTO payer_credentialing_status_types (code, name, description)
            VALUES ('not_in_network', 'Not In Network', 'Payer we do not have a contract with')
            ON CONFLICT (code) DO NOTHING;
            RAISE NOTICE 'Added not_in_network status type';
        EXCEPTION
            WHEN others THEN
                -- If that fails, use a NULL status or find another valid one
                RAISE NOTICE 'Could not add not_in_network status, will use NULL for status_code';
        END;
    END IF;
END $$;

-- ============================================================================
-- STEP 3: INSERT BEAR RIVER BEHAVIORAL HEALTH PAYER
-- ============================================================================

-- Check if payer already exists, if not insert it
DO $$
DECLARE
    v_status_code TEXT := NULL;  -- Default to NULL which should always work
    v_has_not_in_network BOOLEAN;
BEGIN
    -- Check if 'not_in_network' exists as valid status
    SELECT EXISTS (
        SELECT 1 FROM payer_credentialing_status_types
        WHERE code = 'not_in_network'
    ) INTO v_has_not_in_network;

    -- Use 'not_in_network' if it exists, otherwise NULL
    IF v_has_not_in_network THEN
        v_status_code := 'not_in_network';
    END IF;

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
            v_status_code,     -- Will be NULL or 'not_in_network' depending on what's valid
            FALSE,             -- No attending requirement (not applicable)
            FALSE,             -- No individual contract requirement (we're not in network)
            NULL,              -- No effective date (no contract)
            NULL,              -- No projected effective date
            'Medicaid mental health authority for northern Utah. We are NOT in-network with this payer. This entry exists for search/reference purposes only.'
        );
        RAISE NOTICE 'Bear River Behavioral Health payer inserted with status_code: %', COALESCE(v_status_code, 'NULL');
    ELSE
        -- Update existing record
        UPDATE payers SET
            payer_type = 'medicaid',
            state = 'UT',
            status_code = v_status_code,
            notes = 'Medicaid mental health authority for northern Utah. We are NOT in-network with this payer. This entry exists for search/reference purposes only.'
        WHERE name = 'Bear River Behavioral Health';
        RAISE NOTICE 'Bear River Behavioral Health payer updated with status_code: %', COALESCE(v_status_code, 'NULL');
    END IF;
EXCEPTION
    WHEN others THEN
        -- If all else fails, insert without status_code
        RAISE NOTICE 'Error with status_code, inserting without it: %', SQLERRM;
        IF NOT EXISTS (SELECT 1 FROM payers WHERE name = 'Bear River Behavioral Health') THEN
            INSERT INTO payers (
                name,
                payer_type,
                state,
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
                FALSE,
                FALSE,
                NULL,
                NULL,
                'Medicaid mental health authority for northern Utah. We are NOT in-network with this payer. This entry exists for search/reference purposes only.'
            );
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
