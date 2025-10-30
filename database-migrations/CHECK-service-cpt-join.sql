-- Show how services are linked to CPT codes via join table
SELECT
  s.name as service_name,
  c.code as cpt_code,
  c.description as cpt_description
FROM service_cpt_codes scc
JOIN services s ON s.id = scc.service_id
JOIN cpt_codes c ON c.id = scc.cpt_code_id
ORDER BY s.name, c.code;
