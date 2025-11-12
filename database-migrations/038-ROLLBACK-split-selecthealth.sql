-- ROLLBACK Migration 038: Reverse SelectHealth Medicaid/Commercial Split
-- Purpose: Restore SelectHealth to single unified payer if split causes issues
-- Date: 2025-11-11
-- Author: Claude Code
--
-- ⚠️  WARNING: This rollback assumes migration 038 completed successfully
-- Run verification queries first to understand current state

-- ============================================================================
-- STEP 1: Move Commercial Plans Back to SelectHealth Integrated
-- ============================================================================

DO $$
DECLARE
    v_commercial_id UUID;
    v_moved_count INTEGER;
BEGIN
    -- Get commercial payer ID
    SELECT id INTO v_commercial_id
    FROM payers
    WHERE name = 'SelectHealth' AND payer_type = 'Private';

    IF v_commercial_id IS NULL THEN
        RAISE NOTICE 'Commercial SelectHealth payer not found. Nothing to rollback.';
        RETURN;
    END IF;

    -- Move all plans back to SelectHealth Integrated
    UPDATE payer_plans
    SET payer_id = 'd37d3938-b48d-4bdf-b500-bf5413157ef4',
        updated_at = NOW()
    WHERE payer_id = v_commercial_id;

    GET DIAGNOSTICS v_moved_count = ROW_COUNT;

    RAISE NOTICE '✅ Step 1: Moved % plans back to SelectHealth Integrated', v_moved_count;
END $$;

-- ============================================================================
-- STEP 2: Delete Cloned Provider Contracts
-- ============================================================================

DO $$
DECLARE
    v_commercial_id UUID;
    v_deleted_count INTEGER;
BEGIN
    SELECT id INTO v_commercial_id
    FROM payers
    WHERE name = 'SelectHealth' AND payer_type = 'Private';

    IF v_commercial_id IS NULL THEN
        RAISE NOTICE 'Step 2: Commercial payer not found (skipped)';
        RETURN;
    END IF;

    -- Delete contracts with commercial payer
    DELETE FROM provider_payer_contracts
    WHERE payer_id = v_commercial_id
      AND (notes ILIKE '%cloned%split%' OR notes ILIKE '%AUTO-GENERATED%');

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    RAISE NOTICE '✅ Step 2: Deleted % cloned provider contracts', v_deleted_count;
END $$;

-- ============================================================================
-- STEP 3: Delete Cloned Supervision Relationships
-- ============================================================================

DO $$
DECLARE
    v_commercial_id UUID;
    v_deleted_count INTEGER;
BEGIN
    SELECT id INTO v_commercial_id
    FROM payers
    WHERE name = 'SelectHealth' AND payer_type = 'Private';

    IF v_commercial_id IS NULL THEN
        RAISE NOTICE 'Step 3: Commercial payer not found (skipped)';
        RETURN;
    END IF;

    -- Delete supervision relationships with commercial payer
    DELETE FROM provider_supervisions
    WHERE payer_id = v_commercial_id;

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    RAISE NOTICE '✅ Step 3: Deleted % cloned supervision relationships', v_deleted_count;
END $$;

-- ============================================================================
-- STEP 4: Delete Cloned Credentialing Workflows
-- ============================================================================

DO $$
DECLARE
    v_commercial_id UUID;
    v_deleted_count INTEGER;
BEGIN
    SELECT id INTO v_commercial_id
    FROM payers
    WHERE name = 'SelectHealth' AND payer_type = 'Private';

    IF v_commercial_id IS NULL THEN
        RAISE NOTICE 'Step 4: Commercial payer not found (skipped)';
        RETURN;
    END IF;

    -- Check if table exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'payer_credentialing_workflows'
    ) THEN
        DELETE FROM payer_credentialing_workflows
        WHERE payer_id = v_commercial_id
          AND description ILIKE '%cloned%commercial%';

        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

        RAISE NOTICE '✅ Step 4: Deleted % cloned credentialing workflows', v_deleted_count;
    ELSE
        RAISE NOTICE '✅ Step 4: Credentialing workflows table does not exist (skipped)';
    END IF;
END $$;

-- ============================================================================
-- STEP 5: Delete Office Ally Configuration
-- ============================================================================

DO $$
DECLARE
    v_commercial_id UUID;
    v_deleted_count INTEGER;
BEGIN
    SELECT id INTO v_commercial_id
    FROM payers
    WHERE name = 'SelectHealth' AND payer_type = 'Private';

    IF v_commercial_id IS NULL THEN
        RAISE NOTICE 'Step 5: Commercial payer not found (skipped)';
        RETURN;
    END IF;

    -- Delete Office Ally config for commercial payer
    DELETE FROM payer_office_ally_configs
    WHERE payer_id = v_commercial_id;

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    RAISE NOTICE '✅ Step 5: Deleted % Office Ally configuration(s)', v_deleted_count;
END $$;

-- ============================================================================
-- STEP 6: Delete Commercial Payer (Cascades to Related Tables)
-- ============================================================================

DO $$
DECLARE
    v_commercial_id UUID;
    v_payer_name TEXT;
BEGIN
    SELECT id, name INTO v_commercial_id, v_payer_name
    FROM payers
    WHERE name = 'SelectHealth' AND payer_type = 'Private';

    IF v_commercial_id IS NULL THEN
        RAISE NOTICE 'Step 6: Commercial payer not found (already deleted or never created)';
        RETURN;
    END IF;

    -- Delete the payer (cascades to payer_networks, payer_plans via FK)
    DELETE FROM payers
    WHERE id = v_commercial_id;

    RAISE NOTICE '✅ Step 6: Deleted commercial SelectHealth payer: %', v_commercial_id;
END $$;

-- ============================================================================
-- STEP 7: Reset SelectHealth Integrated Metadata
-- ============================================================================

UPDATE payers
SET
    payer_type = NULL,
    notes = 'SelectHealth insurance payer (all plans). [RESTORED from Medicaid/Commercial split on ' || CURRENT_DATE || ']'
WHERE id = 'd37d3938-b48d-4bdf-b500-bf5413157ef4';

DO $$
BEGIN
    RAISE NOTICE '✅ Step 7: Reset SelectHealth Integrated payer metadata';
END $$;

-- ============================================================================
-- STEP 8: Reset Medicaid Office Ally Config (Optional)
-- ============================================================================
-- You may want to restore the original Office Ally payer ID if it was changed

DO $$
BEGIN
    -- Only run this if you know the original Office Ally ID
    -- UPDATE payer_office_ally_configs
    -- SET office_ally_payer_id = 'ORIGINAL_ID',
    --     payer_display_name = 'SelectHealth',
    --     updated_at = NOW()
    -- WHERE payer_id = 'd37d3938-b48d-4bdf-b500-bf5413157ef4';

    RAISE NOTICE '⚠️  Step 8: Manual action required - verify Office Ally config for SelectHealth Integrated';
    RAISE NOTICE '   Check if office_ally_payer_id needs to be restored to original value';
END $$;

-- ============================================================================
-- FINAL VERIFICATION
-- ============================================================================

DO $$
DECLARE
    v_plan_count INTEGER;
    v_contract_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_plan_count
    FROM payer_plans
    WHERE payer_id = 'd37d3938-b48d-4bdf-b500-bf5413157ef4';

    SELECT COUNT(*) INTO v_contract_count
    FROM provider_payer_contracts
    WHERE payer_id = 'd37d3938-b48d-4bdf-b500-bf5413157ef4';

    RAISE NOTICE '';
    RAISE NOTICE '╔════════════════════════════════════════════════════════════════════════╗';
    RAISE NOTICE '║  ROLLBACK COMPLETE: SelectHealth Restored to Single Payer              ║';
    RAISE NOTICE '╚════════════════════════════════════════════════════════════════════════╝';
    RAISE NOTICE '';
    RAISE NOTICE '📊 RESULTS:';
    RAISE NOTICE '   • SelectHealth Integrated: % plan(s)', v_plan_count;
    RAISE NOTICE '   • Provider contracts: %', v_contract_count;
    RAISE NOTICE '';
    RAISE NOTICE '✅ NEXT STEPS:';
    RAISE NOTICE '   1. Verify all 6 plans are back with SelectHealth Integrated';
    RAISE NOTICE '   2. Test booking flow';
    RAISE NOTICE '   3. Verify Office Ally eligibility checks work';
    RAISE NOTICE '   4. Check /ways-to-pay page shows single SelectHealth payer';
    RAISE NOTICE '   5. Clear any session caches in application';
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- VERIFICATION QUERIES (Run After Rollback)
-- ============================================================================

-- 1. Verify all plans are back with SelectHealth Integrated
SELECT
    p.name as payer_name,
    p.payer_type,
    pp.plan_name,
    pp.acceptance_status
FROM payer_plans pp
JOIN payers p ON pp.payer_id = p.id
WHERE p.name ILIKE '%selecthealth%'
ORDER BY pp.plan_name;

-- Expected: 6 plans (Choice, Care, Med, Value, Share, Access) all under SelectHealth Integrated

-- 2. Verify no commercial payer exists
SELECT id, name, payer_type
FROM payers
WHERE name = 'SelectHealth' AND payer_type = 'Private';

-- Expected: 0 rows

-- 3. Verify provider contracts
SELECT
    p.name as payer_name,
    pr.first_name,
    pr.last_name,
    ppc.network_status,
    ppc.is_active
FROM provider_payer_contracts ppc
JOIN payers p ON ppc.payer_id = p.id
JOIN providers pr ON ppc.provider_id = pr.id
WHERE p.name ILIKE '%selecthealth%'
ORDER BY pr.last_name;

-- Expected: All contracts back with SelectHealth Integrated
