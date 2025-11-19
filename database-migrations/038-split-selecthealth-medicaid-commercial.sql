-- Migration 038: Split SelectHealth into Medicaid and Commercial Payers
-- Purpose: Separate SelectHealth Integrated (Medicaid) from Commercial plans for billing
-- Context: Practice needs to separate private payers from medicaid payers for service and form needs
-- Date: 2025-11-11
-- Author: Claude Code
--
-- DATA ARCHITECTURE DECISION:
-- - SelectHealth Integrated (existing) → Medicaid payer (Select Access only)
-- - SelectHealth (new) → Commercial payer (Choice, Care, Med, Value, Share, Signature)
-- - Signature plan → Included with commercial, remains marked as 'not_in_network'
--
-- ✅ RESEARCH COMPLETE: Office Ally Payer IDs Confirmed
-- ============================================================================
-- 1. Office Ally Payer IDs (CONFIRMED)
--    - SelectHealth Medicaid Office Ally ID: SX107 (verified from IntakeQ)
--    - SelectHealth Commercial Office Ally ID: SX107 (same ID for both)
--    - Note: SelectHealth uses same Office Ally ID for Medicaid and Commercial billing
--
-- 2. Contract Structure (IMPORTANT CLARIFICATION)
--    - Does Moonlit have ONE SelectHealth contract or TWO separate contracts?
--    - If ONE: Both payers share same contracts (modify Step 6)
--    - If TWO: Clone contracts as written (current approach)
--
-- 3. Signature Plan Status (CONFIRMED)
--    - SelectHealth Signature plan exists in database
--    - Already marked as acceptance_status = 'not_in_network' ✅
--    - Will move to Commercial payer with other plans
-- ============================================================================

-- ============================================================================
-- STEP 1: Update Existing Payer (SelectHealth Integrated → Medicaid)
-- ============================================================================
-- Changes the existing "SelectHealth Integrated" payer to be explicitly Medicaid

UPDATE payers
SET
    payer_type = 'Medicaid',
    notes = 'SelectHealth Medicaid/CHIP plans. Only includes Select Access plan. Commercial plans moved to separate "SelectHealth" payer on 2025-11-11.'
WHERE id = 'd37d3938-b48d-4bdf-b500-bf5413157ef4';

-- Verification
DO $$
DECLARE
    v_payer_type TEXT;
BEGIN
    SELECT payer_type INTO v_payer_type
    FROM payers
    WHERE id = 'd37d3938-b48d-4bdf-b500-bf5413157ef4';

    IF v_payer_type = 'Medicaid' THEN
        RAISE NOTICE '✅ Step 1: SelectHealth Integrated updated to Medicaid';
    ELSE
        RAISE EXCEPTION 'Step 1 FAILED: payer_type is %, expected Medicaid', v_payer_type;
    END IF;
END $$;

-- ============================================================================
-- STEP 2: Create New Commercial Payer
-- ============================================================================
-- Creates a separate payer for SelectHealth commercial insurance

DO $$
DECLARE
    v_commercial_id UUID;
    v_count INTEGER;
BEGIN
    -- Check if already exists
    SELECT id INTO v_commercial_id
    FROM payers
    WHERE name = 'SelectHealth' AND payer_type = 'Private';

    IF v_commercial_id IS NOT NULL THEN
        RAISE NOTICE 'Commercial SelectHealth payer already exists: %', v_commercial_id;
    ELSE
        INSERT INTO payers (
            name,
            payer_type,
            state,
            requires_attending,
            requires_individual_contract,
            notes,
            effective_date
        )
        VALUES (
            'SelectHealth',
            'Private',
            'UT',
            FALSE,
            FALSE,
            'SelectHealth commercial insurance plans (Choice, Care, Med, Value, Share). Separated from Medicaid payer on 2025-11-11.',
            CURRENT_DATE
        )
        RETURNING id INTO v_commercial_id;

        RAISE NOTICE '✅ Step 2: Created commercial SelectHealth payer: %', v_commercial_id;
    END IF;

    -- Store for later steps
    CREATE TEMP TABLE IF NOT EXISTS migration_temp_ids (
        commercial_payer_id UUID
    );

    DELETE FROM migration_temp_ids;
    INSERT INTO migration_temp_ids VALUES (v_commercial_id);
END $$;

-- ============================================================================
-- STEP 3: Configure Office Ally Payer IDs
-- ============================================================================
-- SelectHealth uses SX107 for both Medicaid and Commercial (verified from IntakeQ)

DO $$
DECLARE
    v_commercial_id UUID;
    v_medicaid_office_ally_id TEXT := 'SX107';
    v_commercial_office_ally_id TEXT := 'SX107';
BEGIN
    SELECT commercial_payer_id INTO v_commercial_id FROM migration_temp_ids;

    -- Configure Medicaid Office Ally ID
    INSERT INTO payer_office_ally_configs (
        payer_id,
        office_ally_payer_id,
        payer_display_name,
        created_at,
        updated_at
    )
    VALUES (
        'd37d3938-b48d-4bdf-b500-bf5413157ef4',
        v_medicaid_office_ally_id,
        'SelectHealth Medicaid',
        NOW(),
        NOW()
    )
    ON CONFLICT (payer_id) DO UPDATE
    SET office_ally_payer_id = EXCLUDED.office_ally_payer_id,
        payer_display_name = EXCLUDED.payer_display_name,
        updated_at = NOW();

    RAISE NOTICE '✅ Step 3a: Configured Medicaid Office Ally ID: %', v_medicaid_office_ally_id;

    -- Configure Commercial Office Ally ID
    INSERT INTO payer_office_ally_configs (
        payer_id,
        office_ally_payer_id,
        payer_display_name,
        created_at,
        updated_at
    )
    VALUES (
        v_commercial_id,
        v_commercial_office_ally_id,
        'SelectHealth Commercial',
        NOW(),
        NOW()
    )
    ON CONFLICT (payer_id) DO UPDATE
    SET office_ally_payer_id = EXCLUDED.office_ally_payer_id,
        payer_display_name = EXCLUDED.payer_display_name,
        updated_at = NOW();

    RAISE NOTICE '✅ Step 3b: Configured Commercial Office Ally ID: %', v_commercial_office_ally_id;
END $$;

-- ============================================================================
-- STEP 4: Move Commercial Plans to New Payer
-- ============================================================================
-- Moves 6 commercial plans from SelectHealth Integrated to new SelectHealth payer
-- Leaves Select Access (Medicaid) with SelectHealth Integrated
-- Note: Signature plan moves with commercial plans, remains marked as 'not_in_network'

DO $$
DECLARE
    v_commercial_id UUID;
    v_moved_count INTEGER;
    v_remaining_count INTEGER;
BEGIN
    SELECT commercial_payer_id INTO v_commercial_id FROM migration_temp_ids;

    -- Move commercial plans (including Signature - not accepted)
    UPDATE payer_plans
    SET payer_id = v_commercial_id,
        updated_at = NOW()
    WHERE payer_id = 'd37d3938-b48d-4bdf-b500-bf5413157ef4'
      AND plan_name IN (
        'Select Choice',
        'Select Care',
        'Select Med',
        'Select Value',
        'SelectHealth Share',
        'SelectHealth Signature'
      );

    GET DIAGNOSTICS v_moved_count = ROW_COUNT;

    -- Verify Select Access stayed with Medicaid payer
    SELECT COUNT(*) INTO v_remaining_count
    FROM payer_plans
    WHERE payer_id = 'd37d3938-b48d-4bdf-b500-bf5413157ef4'
      AND plan_name = 'Select Access';

    IF v_moved_count = 6 THEN
        RAISE NOTICE '✅ Step 4a: Moved 6 commercial plans to new payer (5 accepted + 1 not accepted)';
    ELSE
        RAISE EXCEPTION 'Step 4a FAILED: Expected to move 6 plans, moved %', v_moved_count;
    END IF;

    IF v_remaining_count = 1 THEN
        RAISE NOTICE '✅ Step 4b: Select Access remains with Medicaid payer';
    ELSE
        RAISE EXCEPTION 'Step 4b FAILED: Expected 1 Select Access plan with Medicaid payer, found %', v_remaining_count;
    END IF;
END $$;

-- ============================================================================
-- STEP 5: Update Acceptance Status (UI Display)
-- ============================================================================
-- Ensures all plans have correct acceptance_status for UI display

DO $$
DECLARE
    v_commercial_id UUID;
BEGIN
    SELECT commercial_payer_id INTO v_commercial_id FROM migration_temp_ids;

    -- Mark accepted commercial plans as in-network
    UPDATE payer_plans
    SET acceptance_status = 'in_network',
        updated_at = NOW()
    WHERE payer_id = v_commercial_id
      AND plan_name IN ('Select Choice', 'Select Care', 'Select Med', 'Select Value', 'SelectHealth Share')
      AND (acceptance_status IS NULL OR acceptance_status = 'unknown');

    -- Mark Select Access (Medicaid) as in-network
    UPDATE payer_plans
    SET acceptance_status = 'in_network',
        updated_at = NOW()
    WHERE payer_id = 'd37d3938-b48d-4bdf-b500-bf5413157ef4'
      AND plan_name = 'Select Access'
      AND (acceptance_status IS NULL OR acceptance_status = 'unknown');

    -- Note: SelectHealth Signature already marked as 'not_in_network' (no update needed)

    RAISE NOTICE '✅ Step 5: Updated acceptance_status for all plans';
END $$;

-- ============================================================================
-- STEP 6: Clone Provider Contracts
-- ============================================================================
-- Clones existing provider contracts from SelectHealth Integrated to Commercial
-- ⚠️  ASSUMPTION: Moonlit has ONE umbrella contract covering both Medicaid and Commercial
-- If you have TWO separate contracts, modify this step or run manually

DO $$
DECLARE
    v_commercial_id UUID;
    v_cloned_count INTEGER;
BEGIN
    SELECT commercial_payer_id INTO v_commercial_id FROM migration_temp_ids;

    INSERT INTO provider_payer_contracts (
        provider_id,
        payer_id,
        effective_date,
        expiration_date,
        contract_type,
        network_status,
        is_active,
        notes,
        created_at,
        updated_at
    )
    SELECT
        provider_id,
        v_commercial_id, -- New commercial payer
        effective_date,
        expiration_date,
        contract_type,
        network_status,
        is_active,
        COALESCE(notes, '') || E'\n\n[AUTO-GENERATED] Cloned from SelectHealth Integrated for commercial plans split on 2025-11-11. Original contract covers both Medicaid and Commercial plans.',
        NOW(),
        NOW()
    FROM provider_payer_contracts
    WHERE payer_id = 'd37d3938-b48d-4bdf-b500-bf5413157ef4'
      AND is_active = TRUE;

    GET DIAGNOSTICS v_cloned_count = ROW_COUNT;

    RAISE NOTICE '✅ Step 6: Cloned % provider contracts to commercial payer', v_cloned_count;

    IF v_cloned_count = 0 THEN
        RAISE WARNING 'No contracts found to clone. Verify provider_payer_contracts table has SelectHealth Integrated contracts.';
    END IF;
END $$;

-- ============================================================================
-- STEP 7: Clone Supervision Relationships (If Applicable)
-- ============================================================================
-- Clones supervision relationships for providers who need supervision with SelectHealth

DO $$
DECLARE
    v_commercial_id UUID;
    v_cloned_count INTEGER;
BEGIN
    SELECT commercial_payer_id INTO v_commercial_id FROM migration_temp_ids;

    -- Check if any supervision relationships exist
    IF EXISTS (
        SELECT 1 FROM provider_supervisions
        WHERE payer_id = 'd37d3938-b48d-4bdf-b500-bf5413157ef4'
    ) THEN
        INSERT INTO provider_supervisions (
            supervised_provider_id,
            supervising_provider_id,
            payer_id,
            effective_date,
            expiration_date,
            supervision_type,
            is_active,
            created_at,
            updated_at
        )
        SELECT
            supervised_provider_id,
            supervising_provider_id,
            v_commercial_id,
            effective_date,
            expiration_date,
            supervision_type,
            is_active,
            NOW(),
            NOW()
        FROM provider_supervisions
        WHERE payer_id = 'd37d3938-b48d-4bdf-b500-bf5413157ef4'
          AND is_active = TRUE;

        GET DIAGNOSTICS v_cloned_count = ROW_COUNT;

        RAISE NOTICE '✅ Step 7: Cloned % supervision relationships to commercial payer', v_cloned_count;
    ELSE
        RAISE NOTICE '✅ Step 7: No supervision relationships to clone (skipped)';
    END IF;
END $$;

-- ============================================================================
-- STEP 8: Clone Credentialing Workflows (If Applicable)
-- ============================================================================
-- Clones any credentialing workflows from SelectHealth Integrated

DO $$
DECLARE
    v_commercial_id UUID;
    v_cloned_count INTEGER;
BEGIN
    SELECT commercial_payer_id INTO v_commercial_id FROM migration_temp_ids;

    -- Check if credentialing workflows table exists and has data
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'payer_credentialing_workflows'
    ) THEN
        IF EXISTS (
            SELECT 1 FROM payer_credentialing_workflows
            WHERE payer_id = 'd37d3938-b48d-4bdf-b500-bf5413157ef4'
        ) THEN
            INSERT INTO payer_credentialing_workflows (
                payer_id,
                workflow_name,
                description,
                steps,
                estimated_duration_days,
                is_active,
                created_at,
                updated_at
            )
            SELECT
                v_commercial_id,
                workflow_name,
                description || ' [Cloned for commercial payer split 2025-11-11]',
                steps,
                estimated_duration_days,
                is_active,
                NOW(),
                NOW()
            FROM payer_credentialing_workflows
            WHERE payer_id = 'd37d3938-b48d-4bdf-b500-bf5413157ef4';

            GET DIAGNOSTICS v_cloned_count = ROW_COUNT;

            RAISE NOTICE '✅ Step 8: Cloned % credentialing workflows to commercial payer', v_cloned_count;
        ELSE
            RAISE NOTICE '✅ Step 8: No credentialing workflows to clone (skipped)';
        END IF;
    ELSE
        RAISE NOTICE '✅ Step 8: Credentialing workflows table does not exist (skipped)';
    END IF;
END $$;

-- ============================================================================
-- CLEANUP: Drop Temporary Table
-- ============================================================================

DROP TABLE IF EXISTS migration_temp_ids;

-- ============================================================================
-- FINAL VERIFICATION SUMMARY
-- ============================================================================

DO $$
DECLARE
    v_commercial_id UUID;
    v_medicaid_plans INTEGER;
    v_commercial_plans INTEGER;
BEGIN
    SELECT id INTO v_commercial_id
    FROM payers
    WHERE name = 'SelectHealth' AND payer_type = 'Private';

    SELECT COUNT(*) INTO v_medicaid_plans
    FROM payer_plans
    WHERE payer_id = 'd37d3938-b48d-4bdf-b500-bf5413157ef4';

    SELECT COUNT(*) INTO v_commercial_plans
    FROM payer_plans
    WHERE payer_id = v_commercial_id;

    RAISE NOTICE '';
    RAISE NOTICE '╔════════════════════════════════════════════════════════════════════════╗';
    RAISE NOTICE '║  Migration 038: SelectHealth Payer Split COMPLETE                     ║';
    RAISE NOTICE '╚════════════════════════════════════════════════════════════════════════╝';
    RAISE NOTICE '';
    RAISE NOTICE '📊 RESULTS:';
    RAISE NOTICE '   • SelectHealth Integrated (Medicaid): % plan(s)', v_medicaid_plans;
    RAISE NOTICE '   • SelectHealth (Commercial): % plan(s)', v_commercial_plans;
    RAISE NOTICE '   • New Commercial Payer ID: %', v_commercial_id;
    RAISE NOTICE '';
    RAISE NOTICE '✅ NEXT STEPS:';
    RAISE NOTICE '   1. Run verification queries (see verification script)';
    RAISE NOTICE '   2. Test booking flow for both payers';
    RAISE NOTICE '   3. Test eligibility checks with Office Ally';
    RAISE NOTICE '   4. Verify plan display on /ways-to-pay page';
    RAISE NOTICE '   5. Update any hardcoded payer ID references in application code';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  ROLLBACK: If issues occur, run 038-ROLLBACK script';
    RAISE NOTICE '';
END $$;
