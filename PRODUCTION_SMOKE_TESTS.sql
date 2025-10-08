-- ============================================================================
-- PRODUCTION SMOKE TESTS (POST-DEPLOY)
-- Run these in Supabase SQL Editor after Vercel deployment completes
-- ============================================================================

-- ============================================================================
-- Test 1: UPSERT Function
-- ============================================================================

-- Should return 1 row with status='in_network', updated_at=NOW()
SELECT
  id,
  status,
  updated_at,
  notes
FROM upsert_provider_payer_contract(
  '08fbcd34-cd5f-425c-85bd-1aeeffbe9694'::uuid,  -- Dr. Sweeney
  '8bd0bedb-226e-4253-bfeb-46ce835ef2a8'::uuid,  -- DMBA
  '2025-11-01'::date,
  NULL,
  NULL,
  'Admin note: prod post-deploy verification'
);

-- Expected:
-- ✅ Returns 1 row
-- ✅ status = 'in_network' (default)
-- ✅ updated_at is recent (just now)
-- ✅ notes contains the admin note

-- ============================================================================
-- Test 2: Coverage API - Future Date (should include DMBA)
-- ============================================================================

SELECT
  provider_id,
  payer_id,
  network_status,
  effective_date,
  bookable_from_date
FROM public.fn_bookable_provider_payer_asof(date '2025-12-08')
WHERE provider_id = '08fbcd34-cd5f-425c-85bd-1aeeffbe9694'
  AND payer_id    = '8bd0bedb-226e-4253-bfeb-46ce835ef2a8';

-- Expected:
-- ✅ Returns 1 row
-- ✅ network_status = 'in_network'
-- ✅ effective_date = '2025-11-01'
-- ✅ bookable_from_date <= '2025-12-08'

-- ============================================================================
-- Test 3: Coverage API - Today (should exclude DMBA if before 2025-11-01)
-- ============================================================================

SELECT
  provider_id,
  payer_id,
  network_status,
  effective_date
FROM public.v_bookable_provider_payer
WHERE provider_id = '08fbcd34-cd5f-425c-85bd-1aeeffbe9694'
  AND payer_id    = '8bd0bedb-226e-4253-bfeb-46ce835ef2a8';

-- Expected (if today < 2025-11-01):
-- ✅ Returns 0 rows (DMBA not yet effective)
--
-- Expected (if today >= 2025-11-01):
-- ✅ Returns 1 row (DMBA now effective)

-- ============================================================================
-- Test 4: Security - Function Permissions
-- ============================================================================

SELECT
  routine_name,
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE routine_name IN (
    'upsert_provider_payer_contract',
    'fn_bookable_provider_payer_asof'
  )
  AND grantee IN ('PUBLIC', 'authenticated', 'service_role', 'postgres')
ORDER BY routine_name, grantee;

-- Expected:
-- ✅ service_role has EXECUTE on both functions
-- ✅ postgres has EXECUTE on both functions
-- ✅ PUBLIC does NOT appear
-- ✅ authenticated does NOT appear

-- ============================================================================
-- All production smoke tests complete!
-- ============================================================================

-- If all tests pass:
-- ✅ UPSERT function working
-- ✅ Service date RPC working
-- ✅ Today view working
-- ✅ Security locked down

-- Next: Test UI at /admin/bookability/coverage
