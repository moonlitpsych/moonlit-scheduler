-- Populate remaining credentialing workflows (Molina, UT Medicaid, UUHP)
-- Supplemental to migration 040

-- Check if workflows exist for these payers first
SELECT
  p.id,
  p.name,
  CASE WHEN pcw.id IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END as workflow_status
FROM payers p
LEFT JOIN payer_credentialing_workflows pcw ON p.id = pcw.payer_id
WHERE p.name IN (
  'Molina Utah',
  'Utah Medicaid Fee-for-Service',
  'University of Utah Health Plans (UUHP)'
);

-- 6. Molina Utah - Spreadsheet to general credentialing email
INSERT INTO payer_credentialing_workflows (
  payer_id,
  workflow_type,
  submission_method,
  contact_type,
  credentialing_contact_name,
  credentialing_contact_email,
  form_template_filename,
  form_template_url,
  detailed_instructions,
  task_templates
)
SELECT
  id as payer_id,
  'excel_submission' as workflow_type,
  'spreadsheet_email' as submission_method,
  'general_email' as contact_type,
  'Molina Healthcare Credentialing' as credentialing_contact_name,
  'credentialing@molinahealthcare.com' as credentialing_contact_email,
  'molina-provider-roster.xlsx' as form_template_filename,
  '/credentialing-forms/molina-provider-roster.xlsx' as form_template_url,
  '[
    "Download Molina provider roster spreadsheet template",
    "Add new provider information to spreadsheet",
    "Email completed spreadsheet to general Molina credentialing email"
  ]'::jsonb as detailed_instructions,
  '[
    {
      "title": "Download Molina provider roster spreadsheet",
      "description": "Download Excel template for provider roster",
      "order": 1,
      "estimated_days": 0
    },
    {
      "title": "Fill out provider information in spreadsheet",
      "description": "Add provider details to the roster template",
      "order": 2,
      "estimated_days": 1
    },
    {
      "title": "Email completed roster to Molina",
      "description": "Send completed spreadsheet to general credentialing email",
      "order": 3,
      "estimated_days": 0
    }
  ]'::jsonb as task_templates
FROM payers
WHERE name = 'Molina Utah'
ON CONFLICT (payer_id) DO UPDATE SET
  workflow_type = EXCLUDED.workflow_type,
  submission_method = EXCLUDED.submission_method,
  contact_type = EXCLUDED.contact_type,
  credentialing_contact_name = EXCLUDED.credentialing_contact_name,
  credentialing_contact_email = EXCLUDED.credentialing_contact_email,
  form_template_filename = EXCLUDED.form_template_filename,
  form_template_url = EXCLUDED.form_template_url,
  detailed_instructions = EXCLUDED.detailed_instructions,
  task_templates = EXCLUDED.task_templates;

-- 7. Utah Medicaid Fee-for-Service - PRISM portal account access
INSERT INTO payer_credentialing_workflows (
  payer_id,
  workflow_type,
  submission_method,
  contact_type,
  portal_url,
  credentialing_contact_name,
  detailed_instructions,
  task_templates
)
SELECT
  id as payer_id,
  'online_portal' as workflow_type,
  'portal' as submission_method,
  'self_service' as contact_type,
  'https://prism.utah.gov' as portal_url,
  'Utah Medicaid PRISM Support' as credentialing_contact_name,
  '[
    "Request or verify access to provider PRISM account",
    "Log into PRISM portal with provider credentials",
    "Navigate to clinic roster section",
    "Add new provider to clinic roster in system"
  ]'::jsonb as detailed_instructions,
  '[
    {
      "title": "Get access to PRISM account",
      "description": "Request PRISM provider credentials if needed, or verify existing access",
      "order": 1,
      "estimated_days": 3
    },
    {
      "title": "Log into provider PRISM portal",
      "description": "Access PRISM using provider portal credentials",
      "order": 2,
      "estimated_days": 0
    },
    {
      "title": "Add provider to clinic roster",
      "description": "Navigate to roster section and add new provider to our clinic",
      "order": 3,
      "estimated_days": 0
    }
  ]'::jsonb as task_templates
FROM payers
WHERE name = 'Utah Medicaid Fee-for-Service'
ON CONFLICT (payer_id) DO UPDATE SET
  workflow_type = EXCLUDED.workflow_type,
  submission_method = EXCLUDED.submission_method,
  contact_type = EXCLUDED.contact_type,
  portal_url = EXCLUDED.portal_url,
  credentialing_contact_name = EXCLUDED.credentialing_contact_name,
  detailed_instructions = EXCLUDED.detailed_instructions,
  task_templates = EXCLUDED.task_templates;

-- 8. University of Utah Health Plans (UUHP) - Provider info to general credentialing email
INSERT INTO payer_credentialing_workflows (
  payer_id,
  workflow_type,
  submission_method,
  contact_type,
  credentialing_contact_name,
  credentialing_contact_email,
  detailed_instructions,
  task_templates
)
SELECT
  id as payer_id,
  'online_portal' as workflow_type,
  'pdf_email' as submission_method,
  'general_email' as contact_type,
  'UUHP Credentialing Department' as credentialing_contact_name,
  'credentialing@uuhp.org' as credentialing_contact_email,
  '[
    "Compile provider information and credentials",
    "Submit provider info to general UUHP credentialing email",
    "Follow up if needed"
  ]'::jsonb as detailed_instructions,
  '[
    {
      "title": "Gather provider credentials and information",
      "description": "Compile all required provider documentation",
      "order": 1,
      "estimated_days": 0
    },
    {
      "title": "Email provider information to UUHP",
      "description": "Send compiled information to general credentialing email",
      "order": 2,
      "estimated_days": 0
    },
    {
      "title": "Confirm receipt and follow up",
      "description": "Verify UUHP received application and check on status",
      "order": 3,
      "estimated_days": 7
    }
  ]'::jsonb as task_templates
FROM payers
WHERE name = 'University of Utah Health Plans (UUHP)'
ON CONFLICT (payer_id) DO UPDATE SET
  workflow_type = EXCLUDED.workflow_type,
  submission_method = EXCLUDED.submission_method,
  contact_type = EXCLUDED.contact_type,
  credentialing_contact_name = EXCLUDED.credentialing_contact_name,
  credentialing_contact_email = EXCLUDED.credentialing_contact_email,
  detailed_instructions = EXCLUDED.detailed_instructions,
  task_templates = EXCLUDED.task_templates;

-- Verify all 8 payers now have workflows
SELECT
  p.name as payer_name,
  pcw.workflow_type,
  pcw.submission_method,
  pcw.contact_type,
  pcw.credentialing_contact_name,
  pcw.credentialing_contact_email,
  pcw.form_template_filename,
  jsonb_array_length(pcw.task_templates) as num_tasks
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
