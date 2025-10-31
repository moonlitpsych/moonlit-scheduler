-- Moonlit Scheduler - Payer Database Cleanup
-- Date: 2025-10-31
-- Purpose: Remove duplicate payer entries and consolidate fragmented records
--
-- Verification: All duplicates verified as unused (no contracts, no plans, no references)
-- Safe to delete without reassignment.
--
-- Expected result: 37 payers → 29 payers (8 duplicates removed)

BEGIN;

-- =============================================================================
-- PHASE 1: Pre-deletion verification
-- =============================================================================

DO $$
DECLARE
  initial_count INT;
  tricare_count INT;
  payment_count INT;
  selecthealth_count INT;
BEGIN
  -- Record initial state
  SELECT COUNT(*) INTO initial_count FROM payers;
  RAISE NOTICE '📊 Initial payer count: %', initial_count;

  -- Verify duplicates exist
  SELECT COUNT(*) INTO tricare_count FROM payers
  WHERE id IN (
    '0ff47595-9927-44f6-9d18-d2e779c802a7', -- TriCare West
    '08fcf2d8-8f4a-48ed-af1b-f29842b1dbdb'  -- TriWest
  );

  SELECT COUNT(*) INTO payment_count FROM payers
  WHERE id IN (
    '8c22d4d0-54a9-498c-be2d-79c2213b83a2', -- ACH pay #2
    'e8e573ef-f66c-4392-a4d4-309376d25d3d', -- Cash pay #2
    '637f0593-b609-4415-8e49-bb0915fe0f19'  -- Credit card pay #2
  );

  SELECT COUNT(*) INTO selecthealth_count FROM payers
  WHERE id IN (
    '9b0c0548-4f03-4173-b893-c18d473f8f03', -- SelectHealth Care
    '5f5c8b81-c34b-4454-9cc6-f57abf968a8e', -- SelectHealth Med
    'e964aa50-8b7a-4780-a570-8a035eebd415'  -- SelectHealth Value
  );

  RAISE NOTICE '🔍 Found duplicates:';
  RAISE NOTICE '   - TRICARE: % duplicates', tricare_count;
  RAISE NOTICE '   - Payment types: % duplicates', payment_count;
  RAISE NOTICE '   - SelectHealth: % duplicates', selecthealth_count;
  RAISE NOTICE '';

  IF (tricare_count + payment_count + selecthealth_count) != 8 THEN
    RAISE EXCEPTION 'Expected 8 duplicates but found %. Aborting.', (tricare_count + payment_count + selecthealth_count);
  END IF;
END $$;

-- =============================================================================
-- PHASE 2: Delete TRICARE duplicates
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '🗑️  Deleting TRICARE duplicates...';
END $$;

-- Delete "TriCare West" (incorrect spelling)
DELETE FROM payers
WHERE id = '0ff47595-9927-44f6-9d18-d2e779c802a7' AND name = 'TriCare West';

-- Delete "TriWest" (administrator name, not payer name)
DELETE FROM payers
WHERE id = '08fcf2d8-8f4a-48ed-af1b-f29842b1dbdb' AND name = 'TriWest';

-- Verify TRICARE West (correct name) still exists
DO $$
DECLARE
  tricare_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM payers
    WHERE id = '677e91d3-d6a9-4f72-b8ee-e9b673d2ccfc'
    AND name = 'TRICARE West'
  ) INTO tricare_exists;

  IF tricare_exists THEN
    RAISE NOTICE '   ✅ Kept: TRICARE West (677e91d3-d6a9-4f72-b8ee-e9b673d2ccfc)';
  ELSE
    RAISE EXCEPTION '   ❌ TRICARE West canonical payer not found!';
  END IF;
END $$;

-- =============================================================================
-- PHASE 3: Delete payment type duplicates
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '🗑️  Deleting payment type duplicates...';
END $$;

-- Delete ACH pay duplicate
DELETE FROM payers
WHERE id = '8c22d4d0-54a9-498c-be2d-79c2213b83a2' AND name = 'ACH pay';

-- Delete Cash pay duplicate
DELETE FROM payers
WHERE id = 'e8e573ef-f66c-4392-a4d4-309376d25d3d' AND name = 'Cash pay';

-- Delete Credit card pay duplicate
DELETE FROM payers
WHERE id = '637f0593-b609-4415-8e49-bb0915fe0f19' AND name = 'Credit card pay';

-- Verify canonical payment types still exist
DO $$
DECLARE
  ach_exists BOOLEAN;
  cash_exists BOOLEAN;
  cc_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM payers WHERE id = '0a71c8bb-8520-415f-91c7-e265d4e7336f') INTO ach_exists;
  SELECT EXISTS(SELECT 1 FROM payers WHERE id = '6317e5c7-e3fb-48ed-a394-db7a8b94b206') INTO cash_exists;
  SELECT EXISTS(SELECT 1 FROM payers WHERE id = '3d655839-33b3-49d0-8df2-780a13430dcb') INTO cc_exists;

  IF ach_exists AND cash_exists AND cc_exists THEN
    RAISE NOTICE '   ✅ Kept: ACH pay, Cash pay, Credit card pay';
  ELSE
    RAISE EXCEPTION '   ❌ One or more canonical payment types not found!';
  END IF;
END $$;

-- =============================================================================
-- PHASE 4: Delete SelectHealth fragments
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '🗑️  Deleting SelectHealth fragments (these are plan names, not payers)...';
END $$;

-- Delete SelectHealth Care (this is a plan name, not a payer)
DELETE FROM payers
WHERE id = '9b0c0548-4f03-4173-b893-c18d473f8f03' AND name = 'SelectHealth Care';

-- Delete SelectHealth Med (this is a plan name, not a payer)
DELETE FROM payers
WHERE id = '5f5c8b81-c34b-4454-9cc6-f57abf968a8e' AND name = 'SelectHealth Med';

-- Delete SelectHealth Value (this is a plan name, not a payer)
DELETE FROM payers
WHERE id = 'e964aa50-8b7a-4780-a570-8a035eebd415' AND name = 'SelectHealth Value';

-- Verify SelectHealth Integrated (correct payer name) still exists with plans
DO $$
DECLARE
  selecthealth_exists BOOLEAN;
  plan_count INT;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM payers
    WHERE id = 'd37d3938-b48d-4bdf-b500-bf5413157ef4'
    AND name = 'SelectHealth Integrated'
  ) INTO selecthealth_exists;

  SELECT COUNT(*) INTO plan_count
  FROM payer_plans
  WHERE payer_id = 'd37d3938-b48d-4bdf-b500-bf5413157ef4';

  IF selecthealth_exists AND plan_count = 6 THEN
    RAISE NOTICE '   ✅ Kept: SelectHealth Integrated with % plans', plan_count;
  ELSIF NOT selecthealth_exists THEN
    RAISE EXCEPTION '   ❌ SelectHealth Integrated canonical payer not found!';
  ELSE
    RAISE EXCEPTION '   ❌ SelectHealth Integrated should have 6 plans, found %', plan_count;
  END IF;
END $$;

-- =============================================================================
-- PHASE 5: Final verification
-- =============================================================================

DO $$
DECLARE
  final_count INT;
  duplicate_check INT;
  contracts_check INT;
  plans_check INT;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📊 Final verification...';

  -- Count total payers
  SELECT COUNT(*) INTO final_count FROM payers;
  RAISE NOTICE '   Total payers: % (expected 29)', final_count;

  -- Check for remaining duplicate names
  SELECT COUNT(*) INTO duplicate_check FROM (
    SELECT name, COUNT(*) as cnt
    FROM payers
    GROUP BY name
    HAVING COUNT(*) > 1
  ) AS dupes;

  IF duplicate_check > 0 THEN
    RAISE WARNING '   ⚠️  Still have % duplicate payer names', duplicate_check;
  ELSE
    RAISE NOTICE '   ✅ No duplicate payer names';
  END IF;

  -- Verify contract count unchanged
  SELECT COUNT(DISTINCT payer_id) INTO contracts_check
  FROM provider_payer_networks;
  RAISE NOTICE '   Payers with contracts: % (expected 14)', contracts_check;

  -- Verify plan count unchanged
  SELECT COUNT(DISTINCT payer_id) INTO plans_check
  FROM payer_plans;
  RAISE NOTICE '   Payers with plans: % (expected 1)', plans_check;

  RAISE NOTICE '';

  -- Final assertion
  IF final_count != 29 THEN
    RAISE EXCEPTION '❌ Expected 29 payers, got %. Rolling back.', final_count;
  END IF;

  IF contracts_check != 14 THEN
    RAISE EXCEPTION '❌ Expected 14 payers with contracts, got %. Rolling back.', contracts_check;
  END IF;

  IF plans_check != 1 THEN
    RAISE EXCEPTION '❌ Expected 1 payer with plans, got %. Rolling back.', plans_check;
  END IF;

  RAISE NOTICE '✅ All verification checks passed!';
END $$;

COMMIT;

-- =============================================================================
-- Success message
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Payer cleanup complete!';
  RAISE NOTICE '';
  RAISE NOTICE 'Summary:';
  RAISE NOTICE '  - Removed 8 duplicate payers';
  RAISE NOTICE '  - 29 payers remaining';
  RAISE NOTICE '  - 14 payers with contracts (preserved)';
  RAISE NOTICE '  - 1 payer with plans (SelectHealth - preserved)';
  RAISE NOTICE '';
  RAISE NOTICE 'Next step: Run node scripts/check-payers-status.js to verify';
END $$;
