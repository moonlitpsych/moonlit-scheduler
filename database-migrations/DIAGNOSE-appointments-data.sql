-- =====================================================================
-- DIAGNOSE: Appointments Data - What's Actually There
-- =====================================================================

-- 1. How many appointments have payer_id?
SELECT
  'PAYER LINKAGE' as check_name,
  COUNT(*) as total_appointments,
  COUNT(payer_id) as with_payer_id,
  COUNT(*) - COUNT(payer_id) as without_payer_id,
  ROUND(100.0 * COUNT(payer_id) / NULLIF(COUNT(*), 0), 2) as pct_with_payer
FROM appointments;

-- 2. What payers are actually used in appointments?
SELECT
  'PAYERS IN USE' as check_name,
  p.name as payer_name,
  COUNT(a.id) as appointment_count
FROM appointments a
LEFT JOIN payers p ON p.id = a.payer_id
GROUP BY p.name
ORDER BY COUNT(a.id) DESC;

-- 3. What services/CPTs are used in appointments?
SELECT
  'SERVICES IN USE' as check_name,
  s.name as service_name,
  s.default_cpt as cpt_code,
  COUNT(a.id) as appointment_count
FROM appointments a
JOIN service_instances si ON si.id = a.service_instance_id
JOIN services s ON s.id = si.service_id
GROUP BY s.name, s.default_cpt
ORDER BY COUNT(a.id) DESC;

-- 4. Which payer + CPT combinations are in appointments but NOT in fee_schedule_lines?
SELECT
  'MISSING FEE SCHEDULES' as check_name,
  p.name as payer_name,
  s.default_cpt as cpt_code,
  COUNT(a.id) as appointment_count,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM fee_schedule_lines fsl
      WHERE fsl.payer_id = a.payer_id
        AND fsl.cpt = s.default_cpt
    ) THEN '✓ Has fee schedule'
    ELSE '✗ MISSING - will show wrong amount'
  END as fee_schedule_status
FROM appointments a
JOIN service_instances si ON si.id = a.service_instance_id
JOIN services s ON s.id = si.service_id
LEFT JOIN payers p ON p.id = a.payer_id
WHERE a.payer_id IS NOT NULL
  AND s.default_cpt IS NOT NULL
GROUP BY p.name, s.default_cpt, a.payer_id
ORDER BY COUNT(a.id) DESC;

-- 5. Sample appointments with all key fields
SELECT
  'SAMPLE APPOINTMENTS' as check_name,
  a.id,
  a.start_time::date as date,
  p.name as payer_name,
  s.name as service_name,
  s.default_cpt as cpt_code,
  a.status
FROM appointments a
JOIN service_instances si ON si.id = a.service_instance_id
JOIN services s ON s.id = si.service_id
LEFT JOIN payers p ON p.id = a.payer_id
ORDER BY a.start_time DESC
LIMIT 10;
