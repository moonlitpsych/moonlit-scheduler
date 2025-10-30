-- =====================================================================
-- COMPREHENSIVE Schema Verification - NO ASSUMPTIONS
-- Run this in Supabase SQL Editor to see actual schema
-- =====================================================================

-- 1. List ALL columns in services table
SELECT
  '1. SERVICES TABLE COLUMNS' as section,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'services'
ORDER BY ordinal_position;

-- 2. List ALL columns in cpt_codes table
SELECT
  '2. CPT_CODES TABLE COLUMNS' as section,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'cpt_codes'
ORDER BY ordinal_position;

-- 3. List ALL columns in service_cpt_codes table
SELECT
  '3. SERVICE_CPT_CODES TABLE COLUMNS' as section,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'service_cpt_codes'
ORDER BY ordinal_position;

-- 4. List ALL columns in fee_schedule_lines table
SELECT
  '4. FEE_SCHEDULE_LINES TABLE COLUMNS' as section,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'fee_schedule_lines'
ORDER BY ordinal_position;

-- 5. List ALL columns in payers table
SELECT
  '5. PAYERS TABLE COLUMNS' as section,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'payers'
ORDER BY ordinal_position;

-- 6. Sample data from services (first 5 rows, all columns)
SELECT
  '6. SERVICES SAMPLE DATA' as section,
  *
FROM services
LIMIT 5;

-- 7. Sample data from cpt_codes (first 10 rows, all columns)
SELECT
  '7. CPT_CODES SAMPLE DATA' as section,
  *
FROM cpt_codes
LIMIT 10;

-- 8. Sample data from service_cpt_codes (first 10 rows, all columns)
SELECT
  '8. SERVICE_CPT_CODES SAMPLE DATA' as section,
  *
FROM service_cpt_codes
LIMIT 10;

-- 9. Sample data from fee_schedule_lines (first 5 rows, all columns)
SELECT
  '9. FEE_SCHEDULE_LINES SAMPLE DATA' as section,
  *
FROM fee_schedule_lines
LIMIT 5;

-- 10. Count records in each table
SELECT
  '10. TABLE ROW COUNTS' as section,
  'services' as table_name,
  COUNT(*) as row_count
FROM services
UNION ALL
SELECT
  '10. TABLE ROW COUNTS',
  'cpt_codes',
  COUNT(*)
FROM cpt_codes
UNION ALL
SELECT
  '10. TABLE ROW COUNTS',
  'service_cpt_codes',
  COUNT(*)
FROM service_cpt_codes
UNION ALL
SELECT
  '10. TABLE ROW COUNTS',
  'fee_schedule_lines',
  COUNT(*)
FROM fee_schedule_lines
UNION ALL
SELECT
  '10. TABLE ROW COUNTS',
  'payers',
  COUNT(*)
FROM payers;
