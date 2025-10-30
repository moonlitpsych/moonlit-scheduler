-- =====================================================================
-- PRE-CHECK: Verify Migration 045 Will Work
-- Run this BEFORE running the actual migration
-- =====================================================================

-- Check 1: Verify all 5 payer names exist exactly as expected
SELECT
  'PAYER MAPPING CHECK' as check_name,
  expected_name,
  CASE
    WHEN EXISTS (SELECT 1 FROM payers WHERE name = expected_name) THEN '✓ FOUND'
    ELSE '✗ NOT FOUND - MIGRATION WILL FAIL'
  END as status,
  (SELECT name FROM payers WHERE name ILIKE '%' || search_term || '%' LIMIT 1) as suggested_match
FROM (
  VALUES
    ('Optum Commercial Behavioral Health', 'Optum'),
    ('DMBA', 'DMBA'),
    ('Health Choice Utah', 'Health Choice'),
    ('Aetna', 'Aetna'),
    ('Utah Medicaid Fee-for-Service', 'Medicaid')
) AS expected(expected_name, search_term);

-- Check 2: Verify unique constraint doesn't conflict with existing data
SELECT
  'DUPLICATE CHECK' as check_name,
  payer_id,
  cpt,
  effective_from,
  COUNT(*) as duplicate_count
FROM fee_schedule_lines
WHERE cpt IN ('99205', '99204', '90838', '99214', '99215', '90836', '90833')
GROUP BY payer_id, cpt, effective_from
HAVING COUNT(*) > 1;

-- Check 3: Show what currently exists for our target CPT codes
SELECT
  'CURRENT FEE SCHEDULE DATA' as check_name,
  p.name as payer_name,
  fsl.cpt,
  fsl.allowed_cents,
  (fsl.allowed_cents::numeric / 100)::numeric(10,2) as allowed_dollars,
  fsl.effective_from
FROM fee_schedule_lines fsl
JOIN payers p ON p.id = fsl.payer_id
WHERE fsl.cpt IN ('99205', '99204', '90838', '99214', '99215', '90836', '90833')
ORDER BY p.name, fsl.cpt;

-- Check 4: Verify table structure
SELECT
  'TABLE STRUCTURE CHECK' as check_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'fee_schedule_lines'
  AND column_name IN ('payer_id', 'cpt', 'allowed_cents', 'effective_from')
ORDER BY column_name;

-- Final Summary
SELECT
  'MIGRATION READINESS' as summary,
  (SELECT COUNT(*) FROM payers WHERE name IN (
    'Optum Commercial Behavioral Health',
    'DMBA',
    'Health Choice Utah',
    'Aetna',
    'Utah Medicaid Fee-for-Service'
  )) as payers_found,
  CASE
    WHEN (SELECT COUNT(*) FROM payers WHERE name IN (
      'Optum Commercial Behavioral Health',
      'DMBA',
      'Health Choice Utah',
      'Aetna',
      'Utah Medicaid Fee-for-Service'
    )) = 5 THEN '✓ READY TO RUN'
    ELSE '✗ PAYER NAMES DO NOT MATCH - FIX MAPPINGS FIRST'
  END as migration_status;
