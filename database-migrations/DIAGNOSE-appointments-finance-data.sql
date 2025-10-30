-- =====================================================================
-- DIAGNOSE: Appointments Finance Data Flow
-- Shows how appointments connect to payers, services, and fee schedules
-- =====================================================================

-- 1. Show sample appointment records with all relevant fields
SELECT
  'APPOINTMENTS TABLE SAMPLE' as section,
  id,
  patient_id,
  provider_id,
  payer_id,
  start_time,
  status,
  appointment_type,
  notes
FROM appointments
ORDER BY start_time DESC
LIMIT 5;

-- 2. Check if appointments have payer_id populated
SELECT
  'APPOINTMENTS PAYER LINKAGE' as section,
  COUNT(*) as total_appointments,
  COUNT(payer_id) as appointments_with_payer,
  COUNT(*) - COUNT(payer_id) as appointments_without_payer,
  ROUND(100.0 * COUNT(payer_id) / NULLIF(COUNT(*), 0), 2) as pct_with_payer
FROM appointments;

-- 3. Show appointments with their payer names
SELECT
  'APPOINTMENTS WITH PAYER NAMES' as section,
  a.id as appointment_id,
  a.start_time,
  a.payer_id,
  p.name as payer_name,
  a.appointment_type
FROM appointments a
LEFT JOIN payers p ON p.id = a.payer_id
ORDER BY a.start_time DESC
LIMIT 10;

-- 4. Check appointments table columns
SELECT
  'APPOINTMENTS TABLE COLUMNS' as section,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'appointments'
ORDER BY ordinal_position;

-- 5. Check if there's a service_id or service_instance_id on appointments
SELECT
  'SERVICE LINKAGE CHECK' as section,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'appointments'
  AND (column_name LIKE '%service%' OR column_name LIKE '%cpt%')
ORDER BY column_name;

-- 6. Show what v_appointments_grid is currently returning
SELECT
  'V_APPOINTMENTS_GRID SAMPLE' as section,
  appointment_id,
  appointment_date,
  payer_name,
  expected_gross_cents,
  (expected_gross_cents::numeric / 100)::numeric(10,2) as expected_gross_dollars
FROM v_appointments_grid
ORDER BY appointment_date DESC
LIMIT 10;
