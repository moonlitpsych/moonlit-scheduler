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
        RAISE NOTICE '✅ Step 3: Moved 6 commercial plans to new payer (5 accepted + 1 not accepted)';
    ELSE
        RAISE EXCEPTION 'Step 3 FAILED: Expected to move 6 plans, moved %', v_moved_count;
    END IF;

    IF v_remaining_count = 1 THEN
        RAISE NOTICE '✅ Step 3: Select Access remains with Medicaid payer';
    ELSE
        RAISE EXCEPTION 'Step 3 FAILED: Expected 1 Select Access plan with Medicaid payer, found %', v_remaining_count;
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

    RAISE NOTICE '✅ Step 4: Updated acceptance_status for all plans';
END $$;

DO $$
DECLARE
    v_commercial_id UUID;
    v_cloned_count INTEGER;
BEGIN
    SELECT commercial_payer_id INTO v_commercial_id FROM migration_temp_ids;

    INSERT INTO provider_payer_networks (
        provider_id,
        payer_id,
        effective_date,
        expiration_date,
        status,
        notes,
        created_at,
        updated_at
    )
    SELECT
        provider_id,
        v_commercial_id,
        effective_date,
        expiration_date,
        status,
        notes,
        NOW(),
        NOW()
    FROM provider_payer_networks
    WHERE payer_id = 'd37d3938-b48d-4bdf-b500-bf5413157ef4'
      AND status = 'in_network';

    GET DIAGNOSTICS v_cloned_count = ROW_COUNT;

    RAISE NOTICE '✅ Step 5: Cloned % provider contracts to commercial payer', v_cloned_count;

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
        SELECT 1 FROM supervision_relationships
        WHERE payer_id = 'd37d3938-b48d-4bdf-b500-bf5413157ef4'
    ) THEN
        INSERT INTO supervision_relationships (
            supervisee_provider_id,
            supervisor_provider_id,
            payer_id,
            start_date,
            end_date,
            is_active,
            created_at,
            updated_at
        )
        SELECT
            supervisee_provider_id,
            supervisor_provider_id,
            v_commercial_id,
            start_date,
            end_date,
            is_active,
            NOW(),
            NOW()
        FROM supervision_relationships
        WHERE payer_id = 'd37d3938-b48d-4bdf-b500-bf5413157ef4'
          AND is_active = TRUE;

        GET DIAGNOSTICS v_cloned_count = ROW_COUNT;

        RAISE NOTICE '✅ Step 6: Cloned % supervision relationships to commercial payer', v_cloned_count;
    ELSE
        RAISE NOTICE '✅ Step 6: No supervision relationships to clone (skipped)';
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
    RAISE NOTICE '✅ SHARED RESOURCES:';
    RAISE NOTICE '   • Office Ally Config: Both payers share existing SX107 configuration';
    RAISE NOTICE '   • Credentialing Workflows: Kept with original payer (unique constraint)';
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
