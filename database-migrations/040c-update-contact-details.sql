-- Update credentialing contact details with real human contacts
-- Based on actual contact information from credentialing team

-- 1. SelectHealth - Brittany Reynolds
UPDATE payer_credentialing_workflows
SET
  credentialing_contact_name = 'Brittany Reynolds',
  credentialing_contact_email = 'Brittany.Reynolds@selecthealth.org'
WHERE payer_id = (SELECT id FROM payers WHERE name = 'SelectHealth Integrated');

-- 2. DMBA - Provider Relations email (update from generic credentialing@dmba.com)
UPDATE payer_credentialing_workflows
SET
  credentialing_contact_email = 'providerrelations@dmba.com'
WHERE payer_id = (SELECT id FROM payers WHERE name = 'DMBA');

-- 3. Health Choice Utah - Amy Prince
UPDATE payer_credentialing_workflows
SET
  credentialing_contact_name = 'Amy Prince',
  credentialing_contact_email = 'Amy.Prince@healthchoiceutah.com'
WHERE payer_id = (SELECT id FROM payers WHERE name = 'Health Choice Utah');

-- 4. HMHI BHN - Jessie Konate
UPDATE payer_credentialing_workflows
SET
  credentialing_contact_name = 'Jessie Konate',
  credentialing_contact_email = 'jessie.konate@hsc.utah.edu'
WHERE payer_id = (SELECT id FROM payers WHERE name = 'HMHI BHN');

-- 5. Molina Utah - MHU PIM team email
UPDATE payer_credentialing_workflows
SET
  credentialing_contact_name = 'MHU PIM Team',
  credentialing_contact_email = 'MHUPIM@molinahealthcare.com'
WHERE payer_id = (SELECT id FROM payers WHERE name = 'Molina Utah');

-- Verify all contacts are now populated
SELECT
  p.name as payer_name,
  pcw.contact_type,
  pcw.credentialing_contact_name,
  pcw.credentialing_contact_email,
  pcw.submission_method,
  pcw.form_template_filename
FROM payer_credentialing_workflows pcw
JOIN payers p ON p.id = pcw.payer_id
WHERE p.name IN (
  'DMBA',
  'SelectHealth Integrated',
  'HMHI BHN',
  'Regence BlueCross BlueShield',
  'Health Choice Utah',
  'Molina Utah',
  'Utah Medicaid Fee-for-Service',
  'University of Utah Health Plans (UUHP)'
)
ORDER BY p.name;
