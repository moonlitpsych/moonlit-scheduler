-- Migration 032: Rollback Mock Plan Data
-- Purpose: DELETE all mock/inferred plan data from migration 026
-- Context: Migration 026 created generic plan names without verifying actual contracts
--          This violates data integrity policy for healthcare application
-- Date: 2025-10-31
--
-- CRITICAL: This system is a healthcare application. Mock data is NEVER acceptable.
--           Only real contract data should be in production database.

-- ============================================================================
-- SAFETY CHECK: Verify junction table is empty before deleting plans
-- ============================================================================

DO $$
DECLARE
    v_junction_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_junction_count FROM provider_payer_accepted_plans;

    IF v_junction_count > 0 THEN
        RAISE EXCEPTION 'Cannot rollback: % rows exist in provider_payer_accepted_plans junction table. Delete those first.', v_junction_count;
    END IF;

    RAISE NOTICE '✅ Junction table is empty, safe to proceed';
END $$;

-- ============================================================================
-- DELETE MOCK DATA (in reverse dependency order)
-- ============================================================================

-- Step 1: Delete plan aliases (references payer_plans)
DELETE FROM payer_plan_aliases
WHERE plan_id IN (
    SELECT id FROM payer_plans
    WHERE payer_id IN (
        SELECT id FROM payers
        WHERE name ILIKE '%regence%'
           OR name ILIKE '%selecthealth%'
           OR name ILIKE '%aetna%'
    )
);

-- Step 2: Delete payer_plans
DELETE FROM payer_plans
WHERE payer_id IN (
    SELECT id FROM payers
    WHERE name ILIKE '%regence%'
       OR name ILIKE '%selecthealth%'
       OR name ILIKE '%aetna%'
);

-- Step 3: Delete payer_networks
DELETE FROM payer_networks
WHERE payer_id IN (
    SELECT id FROM payers
    WHERE name ILIKE '%regence%'
       OR name ILIKE '%selecthealth%'
       OR name ILIKE '%aetna%'
);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
    v_network_count INTEGER;
    v_plan_count INTEGER;
    v_alias_count INTEGER;
BEGIN
    -- Count remaining rows for Big 3 payers
    SELECT COUNT(*) INTO v_network_count FROM payer_networks WHERE payer_id IN (
        SELECT id FROM payers WHERE name ILIKE '%regence%' OR name ILIKE '%selecthealth%' OR name ILIKE '%aetna%'
    );

    SELECT COUNT(*) INTO v_plan_count FROM payer_plans WHERE payer_id IN (
        SELECT id FROM payers WHERE name ILIKE '%regence%' OR name ILIKE '%selecthealth%' OR name ILIKE '%aetna%'
    );

    SELECT COUNT(*) INTO v_alias_count FROM payer_plan_aliases WHERE plan_id IN (
        SELECT id FROM payer_plans WHERE payer_id IN (
            SELECT id FROM payers WHERE name ILIKE '%regence%' OR name ILIKE '%selecthealth%' OR name ILIKE '%aetna%'
        )
    );

    RAISE NOTICE '';
    RAISE NOTICE '✅ Migration 032 complete: Mock plan data deleted';
    RAISE NOTICE '   Networks remaining (should be 0): %', v_network_count;
    RAISE NOTICE '   Plans remaining (should be 0): %', v_plan_count;
    RAISE NOTICE '   Aliases remaining (should be 0): %', v_alias_count;
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  IMPORTANT: Migration 026 has been rolled back.';
    RAISE NOTICE '   DO NOT run migration 026 again - it contains mock data.';
    RAISE NOTICE '   Next: Add ONLY real contract data from actual provider contracts.';
END $$;
