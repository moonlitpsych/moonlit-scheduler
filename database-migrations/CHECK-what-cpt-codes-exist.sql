-- Check what CPT codes are available and how they map to services
-- 1. All CPT codes in the system
SELECT 'CPT CODES TABLE' as section, code, description
FROM cpt_codes
ORDER BY code;

-- 2. Service-to-CPT mappings via join table
SELECT 'SERVICE_CPT_CODES JOIN' as section,
  s.name as service_name,
  c.code as cpt_code,
  c.description as cpt_description
FROM service_cpt_codes scc
JOIN services s ON s.id = scc.service_id
JOIN cpt_codes c ON c.id = scc.cpt_code_id
ORDER BY s.name, c.code;

-- 3. All services with their current default_cpt
SELECT 'SERVICES TABLE' as section,
  name as service_name,
  default_cpt,
  price as price_cents
FROM services
ORDER BY name;
