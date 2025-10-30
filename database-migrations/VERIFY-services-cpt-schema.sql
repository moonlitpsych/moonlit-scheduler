-- =====================================================================
-- Schema Verification: Services and CPT Codes
-- Run this in Supabase SQL Editor to understand the schema
-- =====================================================================

-- 1. Check all services and their default_cpt values
SELECT
  'SERVICES TABLE' as section,
  id,
  name,
  default_cpt,
  created_at
FROM services
ORDER BY name;

-- 2. Check all CPT codes in the system
SELECT
  'CPT_CODES TABLE' as section,
  id,
  code,
  description,
  created_at
FROM cpt_codes
WHERE code IN ('99205', '99204', '90838', '99214', '99215', '90836', '90833')
ORDER BY code;

-- 3. Check service_cpt_codes join table
SELECT
  'SERVICE_CPT_CODES JOIN TABLE' as section,
  scc.service_id,
  s.name as service_name,
  s.default_cpt as service_default_cpt,
  c.code as cpt_code,
  c.description as cpt_description
FROM service_cpt_codes scc
JOIN services s ON s.id = scc.service_id
JOIN cpt_codes c ON c.id = scc.cpt_code_id
WHERE c.code IN ('99205', '99204', '90838', '99214', '99215', '90836', '90833')
ORDER BY c.code;

-- 4. Check fee_schedule_lines structure
SELECT
  'FEE_SCHEDULE_LINES SAMPLE' as section,
  fsl.id,
  p.name as payer_name,
  s.name as service_name,
  s.default_cpt as service_cpt,
  fsl.allowed_cents,
  (fsl.allowed_cents::numeric / 100)::numeric(10,2) as allowed_dollars,
  fsl.effective_date
FROM fee_schedule_lines fsl
JOIN payers p ON p.id = fsl.payer_id
JOIN services s ON s.id = fsl.service_id
LIMIT 10;

-- 5. Count services by default_cpt status
SELECT
  'SERVICES SUMMARY' as section,
  COUNT(*) as total_services,
  COUNT(default_cpt) as services_with_default_cpt,
  COUNT(*) - COUNT(default_cpt) as services_without_default_cpt
FROM services;

-- 6. List target CPT codes and their availability
SELECT
  'TARGET CPT CODES AVAILABILITY' as section,
  target_cpt,
  EXISTS (
    SELECT 1 FROM services WHERE default_cpt = target_cpt
  ) as exists_in_services_default_cpt,
  EXISTS (
    SELECT 1 FROM cpt_codes WHERE code = target_cpt
  ) as exists_in_cpt_codes_table,
  (
    SELECT COUNT(*)
    FROM service_cpt_codes scc
    JOIN cpt_codes c ON c.id = scc.cpt_code_id
    WHERE c.code = target_cpt
  ) as join_table_mappings
FROM (
  VALUES
    ('99205'),
    ('99204'),
    ('90838'),
    ('99214'),
    ('99215'),
    ('90836'),
    ('90833')
) AS targets(target_cpt)
ORDER BY target_cpt;
