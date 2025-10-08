-- ============================================================================
-- POST-MERGE SMOKE TESTS
-- Run these in Supabase SQL Editor after merging fix/create-contract to main
-- ============================================================================

-- ============================================================================
-- Test A: Contract UPSERT (same pair → update, no 409)
-- ============================================================================

-- First insert (creates new row)
SELECT * FROM upsert_provider_payer_contract(
  '08fbcd34-cd5f-425c-85bd-1aeeffbe9694'::uuid,  -- Dr. Sweeney
  '8bd0bedb-226e-4253-bfeb-46ce835ef2a8'::uuid,  -- DMBA
  '2025-11-01'::date,
  NULL,
  NULL,
  'Admin note: first save test'
);

-- Second insert with same provider+payer (should UPDATE, not throw error)
SELECT * FROM upsert_provider_payer_contract(
  '08fbcd34-cd5f-425c-85bd-1aeeffbe9694'::uuid,  -- Dr. Sweeney
  '8bd0bedb-226e-4253-bfeb-46ce835ef2a8'::uuid,  -- DMBA
  '2025-11-01'::date,
  '2026-10-31'::date,  -- Added expiration
  NULL,                -- Status should default to 'in_network'
  'Admin note: second save test (should append)'
);

-- Verify results
SELECT
  provider_id,
  payer_id,
  effective_date,
  expiration_date,
  status,
  notes,
  updated_at
FROM provider_payer_networks
WHERE provider_id = '08fbcd34-cd5f-425c-85bd-1aeeffbe9694'
  AND payer_id = '8bd0bedb-226e-4253-bfeb-46ce835ef2a8';

-- Expected:
-- - Only ONE row (not two)
-- - status = 'in_network' (default)
-- - expiration_date = 2026-10-31 (updated)
-- - notes contains BOTH notes (appended with newline)
-- - updated_at is recent

-- ============================================================================
-- Test B: Coverage by Future Date (should include DMBA)
-- ============================================================================

SELECT *
FROM public.fn_bookable_provider_payer_asof(date '2025-12-08')
WHERE provider_id = '08fbcd34-cd5f-425c-85bd-1aeeffbe9694'
  AND payer_id    = '8bd0bedb-226e-4253-bfeb-46ce835ef2a8';

-- Expected:
-- - Returns 1 row
-- - network_status = 'in_network'
-- - effective_date = 2025-11-01
-- - bookable_from_date = 2025-10-11 (or earlier)

-- ============================================================================
-- Test C: "Bookable Today" (won't include DMBA until 2025-11-01)
-- ============================================================================

SELECT *
FROM public.v_bookable_provider_payer
WHERE provider_id = '08fbcd34-cd5f-425c-85bd-1aeeffbe9694'
  AND payer_id    = '8bd0bedb-226e-4253-bfeb-46ce835ef2a8';

-- Expected (if run before 2025-11-01):
-- - Returns 0 rows (DMBA not yet effective)
--
-- Expected (if run on/after 2025-11-01):
-- - Returns 1 row
-- - network_status = 'in_network'

-- ============================================================================
-- Edge Case 1: Status Defaults to 'in_network' When Omitted
-- ============================================================================

SELECT * FROM upsert_provider_payer_contract(
  '08fbcd34-cd5f-425c-85bd-1aeeffbe9694'::uuid,
  '1f9c18ec-f4af-4343-9c1f-515abda9c442'::uuid,  -- MotivHealth
  '2025-07-23'::date,
  NULL,
  NULL,  -- Status intentionally NULL
  'Test: status should default to in_network'
);

-- Verify
SELECT status FROM provider_payer_networks
WHERE provider_id = '08fbcd34-cd5f-425c-85bd-1aeeffbe9694'
  AND payer_id = '1f9c18ec-f4af-4343-9c1f-515abda9c442';

-- Expected: status = 'in_network'

-- ============================================================================
-- Edge Case 2: Notes Append on Update
-- ============================================================================

-- First save
SELECT * FROM upsert_provider_payer_contract(
  '504d53c6-54ef-40b0-81d4-80812c2c7bfd'::uuid,  -- Dr. Privratsky
  '1f9c18ec-f4af-4343-9c1f-515abda9c442'::uuid,  -- MotivHealth
  '2025-07-23'::date,
  NULL,
  'in_network',
  'First note: contract signed'
);

-- Second save with new note
SELECT * FROM upsert_provider_payer_contract(
  '504d53c6-54ef-40b0-81d4-80812c2c7bfd'::uuid,  -- Dr. Privratsky
  '1f9c18ec-f4af-4343-9c1f-515abda9c442'::uuid,  -- MotivHealth
  '2025-08-01'::date,  -- Changed effective date
  NULL,
  'in_network',
  'Second note: effective date updated'
);

-- Verify
SELECT notes FROM provider_payer_networks
WHERE provider_id = '504d53c6-54ef-40b0-81d4-80812c2c7bfd'
  AND payer_id = '1f9c18ec-f4af-4343-9c1f-515abda9c442';

-- Expected:
-- notes contains BOTH:
-- "First note: contract signed"
-- "Second note: effective date updated"
-- (separated by newline)

-- ============================================================================
-- Edge Case 3: Expiration in the Past Drops Out of Views
-- ============================================================================

-- Create a contract with past expiration
SELECT * FROM upsert_provider_payer_contract(
  '08fbcd34-cd5f-425c-85bd-1aeeffbe9694'::uuid,  -- Dr. Sweeney
  'a01d69d6-ae70-4917-afef-49b5ef7e5220'::uuid,  -- Utah Medicaid FFS
  '2025-01-01'::date,
  '2025-09-30'::date,  -- Expired!
  'terminated',
  'Test: expired contract'
);

-- Check if it appears in today's view (should NOT appear)
SELECT *
FROM public.v_bookable_provider_payer
WHERE provider_id = '08fbcd34-cd5f-425c-85bd-1aeeffbe9694'
  AND payer_id = 'a01d69d6-ae70-4917-afef-49b5ef7e5220';

-- Expected: 0 rows (expired on 2025-09-30, before today)

-- Check if it appears in RPC for a date within validity (should appear)
SELECT *
FROM public.fn_bookable_provider_payer_asof(date '2025-06-15')
WHERE provider_id = '08fbcd34-cd5f-425c-85bd-1aeeffbe9694'
  AND payer_id = 'a01d69d6-ae70-4917-afef-49b5ef7e5220';

-- Expected: 1 row (2025-06-15 is between 2025-01-01 and 2025-09-30)

-- ============================================================================
-- Security Test: Verify Function Permissions
-- ============================================================================

SELECT
  routine_name,
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE routine_name IN ('upsert_provider_payer_contract', 'fn_bookable_provider_payer_asof')
  AND grantee IN ('PUBLIC', 'authenticated', 'service_role')
ORDER BY routine_name, grantee;

-- Expected: ONLY service_role should have EXECUTE privilege
-- PUBLIC and authenticated should NOT appear

-- ============================================================================
-- All tests complete!
-- ============================================================================
