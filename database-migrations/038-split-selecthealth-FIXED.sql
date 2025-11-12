UPDATE payers
SET payer_type = 'Medicaid'
WHERE id = 'd37d3938-b48d-4bdf-b500-bf5413157ef4';

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

DO $$
DECLARE
    v_commercial_id UUID;
    v_count INTEGER;
BEGIN
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
            effective_date
        )
        VALUES (
            'SelectHealth',
            'Private',
            'UT',
            FALSE,
            FALSE,
            CURRENT_DATE
        )
        RETURNING id INTO v_commercial_id;

        RAISE NOTICE '✅ Step 2: Created commercial SelectHealth payer: %', v_commercial_id;
    END IF;

    CREATE TEMP TABLE IF NOT EXISTS migration_temp_ids (
        commercial_payer_id UUID
    );

    DELETE FROM migration_temp_ids;
    INSERT INTO migration_temp_ids VALUES (v_commercial_id);
END $$;

DO $$
DECLARE
    v_commercial_id UUID;
    v_medicaid_office_ally_id TEXT := 'SX107';
    v_commercial_office_ally_id TEXT := 'SX107';
BEGIN
    SELECT commercial_payer_id INTO v_commercial_id FROM migration_temp_ids;

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

DO $$
DECLARE
    v_commercial_id UUID;
    v_moved_count INTEGER;
    v_remaining_count INTEGER;
BEGIN
    SELECT commercial_payer_id INTO v_commercial_id FROM migration_temp_ids;

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

DO $$
DECLARE
    v_commercial_id UUID;
BEGIN
    SELECT commercial_payer_id INTO v_commercial_id FROM migration_temp_ids;

    UPDATE payer_plans
    SET acceptance_status = 'in_network',
        updated_at = NOW()
    WHERE payer_id = v_commercial_id
      AND plan_name IN ('Select Choice', 'Select Care', 'Select Med', 'Select Value', 'SelectHealth Share')
      AND (acceptance_status IS NULL OR acceptance_status = 'unknown');

    UPDATE payer_plans
    SET acceptance_status = 'in_network',
        updated_at = NOW()
    WHERE payer_id = 'd37d3938-b48d-4bdf-b500-bf5413157ef4'
      AND plan_name = 'Select Access'
      AND (acceptance_status IS NULL OR acceptance_status = 'unknown');

    RAISE NOTICE '✅ Step 5: Updated acceptance_status for all plans';
END $$;

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
        created_at,
        updated_at
    )
    SELECT
        provider_id,
        v_commercial_id,
        effective_date,
        expiration_date,
        contract_type,
        network_status,
        is_active,
        NOW(),
        NOW()
    FROM provider_payer_contracts
    WHERE payer_id = 'd37d3938-b48d-4bdf-b500-bf5413157ef4'
      AND is_active = TRUE;

    GET DIAGNOSTICS v_cloned_count = ROW_COUNT;

    RAISE NOTICE '✅ Step 6: Cloned % provider contracts to commercial payer', v_cloned_count;

    IF v_cloned_count = 0 THEN
        RAISE WARNING 'No contracts found to clone';
    END IF;
END $$;

DO $$
DECLARE
    v_commercial_id UUID;
    v_cloned_count INTEGER;
BEGIN
    SELECT commercial_payer_id INTO v_commercial_id FROM migration_temp_ids;

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

DO $$
DECLARE
    v_commercial_id UUID;
    v_cloned_count INTEGER;
BEGIN
    SELECT commercial_payer_id INTO v_commercial_id FROM migration_temp_ids;

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

DROP TABLE IF EXISTS migration_temp_ids;

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
    RAISE NOTICE '   1. Run verification queries';
    RAISE NOTICE '   2. Test booking flow for both payers';
    RAISE NOTICE '   3. Test eligibility checks with Office Ally';
    RAISE NOTICE '   4. Verify plan display on /ways-to-pay page';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  ROLLBACK: If issues occur, run 038-ROLLBACK script';
    RAISE NOTICE '';
END $$;
