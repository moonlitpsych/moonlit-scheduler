-- Populate credentialing workflows with real-world process details
-- Based on documented processes for 8 key payers

-- 1. DMBA - Multi-step portal process
UPDATE payer_credentialing_workflows
SET
  submission_method = 'multi_step',
  contact_type = 'portal_only',
  workflow_type = 'online_portal',
  credentialing_contact_name = 'DMBA Credentialing Team',
  credentialing_contact_email = 'credentialing@dmba.com',
  detailed_instructions = '[
    "Submit initial application through DMBA portal",
    "Wait for approval email from DMBA",
    "Once approved, fill out full application on DMBA portal and submit",
    "Email exists for questions but not necessary to contact a human"
  ]'::jsonb,
  task_templates = '[
    {
      "title": "Submit initial application in DMBA portal",
      "description": "Create account if needed and submit initial application",
      "order": 1,
      "estimated_days": 0
    },
    {
      "title": "Wait for DMBA approval notification",
      "description": "Check email for approval from DMBA credentialing team",
      "order": 2,
      "estimated_days": 7
    },
    {
      "title": "Complete full application in DMBA portal",
      "description": "Log back into portal and fill out complete credentialing application",
      "order": 3,
      "estimated_days": 1
    }
  ]'::jsonb
WHERE payer_id = (SELECT id FROM payers WHERE name = 'DMBA');

-- 2. SelectHealth - PDF to human contact
UPDATE payer_credentialing_workflows
SET
  submission_method = 'pdf_email',
  contact_type = 'human_contact',
  workflow_type = 'pdf_form_submission',
  form_template_filename = 'selecthealth-provider-application.pdf',
  form_template_url = '/credentialing-forms/selecthealth-provider-application.pdf',
  detailed_instructions = '[
    "Download SelectHealth provider application PDF",
    "Fill out all required provider information",
    "Submit completed PDF via email to human contact"
  ]'::jsonb,
  task_templates = '[
    {
      "title": "Download SelectHealth credentialing form",
      "description": "Download the PDF application form from file storage",
      "order": 1,
      "estimated_days": 0
    },
    {
      "title": "Fill out PDF application",
      "description": "Complete all required provider information in the PDF form",
      "order": 2,
      "estimated_days": 1
    },
    {
      "title": "Email completed form to SelectHealth contact",
      "description": "Send completed PDF to credentialing contact person",
      "order": 3,
      "estimated_days": 0
    }
  ]'::jsonb
WHERE payer_id = (SELECT id FROM payers WHERE name = 'SelectHealth Integrated');

-- 3. HMHI BHN - PDF to human email contact
UPDATE payer_credentialing_workflows
SET
  submission_method = 'pdf_email',
  contact_type = 'human_contact',
  workflow_type = 'pdf_form_submission',
  form_template_filename = 'hmhi-bhn-provider-application.pdf',
  form_template_url = '/credentialing-forms/hmhi-bhn-provider-application.pdf',
  detailed_instructions = '[
    "Download HMHI BHN provider application PDF",
    "Complete all provider information",
    "Email to HMHI BHN credentialing contact"
  ]'::jsonb,
  task_templates = '[
    {
      "title": "Download HMHI BHN credentialing form",
      "description": "Download the PDF application form",
      "order": 1,
      "estimated_days": 0
    },
    {
      "title": "Fill out PDF application",
      "description": "Complete all required provider information",
      "order": 2,
      "estimated_days": 1
    },
    {
      "title": "Email completed form to HMHI BHN",
      "description": "Send completed PDF to credentialing contact",
      "order": 3,
      "estimated_days": 0
    }
  ]'::jsonb
WHERE payer_id = (SELECT id FROM payers WHERE name = 'HMHI BHN');

-- 4. Regence BCBS - PDF to general credentialing email
UPDATE payer_credentialing_workflows
SET
  submission_method = 'pdf_email',
  contact_type = 'general_email',
  workflow_type = 'pdf_form_submission',
  credentialing_contact_name = 'Regence Credentialing Department',
  credentialing_contact_email = 'credentialing@regence.com',
  form_template_filename = 'regence-provider-application.pdf',
  form_template_url = '/credentialing-forms/regence-provider-application.pdf',
  detailed_instructions = '[
    "Download Regence BCBS provider application PDF",
    "Complete all provider information",
    "Email to general Regence credentialing email"
  ]'::jsonb,
  task_templates = '[
    {
      "title": "Download Regence BCBS credentialing form",
      "description": "Download the PDF application form",
      "order": 1,
      "estimated_days": 0
    },
    {
      "title": "Fill out PDF application",
      "description": "Complete all required provider information",
      "order": 2,
      "estimated_days": 1
    },
    {
      "title": "Email completed form to Regence",
      "description": "Send completed PDF to general credentialing email",
      "order": 3,
      "estimated_days": 0
    }
  ]'::jsonb
WHERE payer_id = (SELECT id FROM payers WHERE name = 'Regence BlueCross BlueShield');

-- 5. Health Choice Utah - PDF to human email contact
UPDATE payer_credentialing_workflows
SET
  submission_method = 'pdf_email',
  contact_type = 'human_contact',
  workflow_type = 'pdf_form_submission',
  form_template_filename = 'health-choice-utah-provider-application.pdf',
  form_template_url = '/credentialing-forms/health-choice-utah-provider-application.pdf',
  detailed_instructions = '[
    "Download Health Choice Utah provider application PDF",
    "Complete all provider information",
    "Email to Health Choice Utah credentialing contact"
  ]'::jsonb,
  task_templates = '[
    {
      "title": "Download Health Choice Utah credentialing form",
      "description": "Download the PDF application form",
      "order": 1,
      "estimated_days": 0
    },
    {
      "title": "Fill out PDF application",
      "description": "Complete all required provider information",
      "order": 2,
      "estimated_days": 1
    },
    {
      "title": "Email completed form to Health Choice Utah",
      "description": "Send completed PDF to credentialing contact",
      "order": 3,
      "estimated_days": 0
    }
  ]'::jsonb
WHERE payer_id = (SELECT id FROM payers WHERE name = 'Health Choice Utah');

-- 6. Molina - Spreadsheet to general credentialing email
UPDATE payer_credentialing_workflows
SET
  submission_method = 'spreadsheet_email',
  contact_type = 'general_email',
  workflow_type = 'excel_submission',
  credentialing_contact_name = 'Molina Healthcare Credentialing',
  credentialing_contact_email = 'credentialing@molinahealthcare.com',
  form_template_filename = 'molina-provider-roster.xlsx',
  form_template_url = '/credentialing-forms/molina-provider-roster.xlsx',
  detailed_instructions = '[
    "Download Molina provider roster spreadsheet template",
    "Add new provider information to spreadsheet",
    "Email completed spreadsheet to general Molina credentialing email"
  ]'::jsonb,
  task_templates = '[
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
  ]'::jsonb
WHERE payer_id = (SELECT id FROM payers WHERE name = 'Molina Utah');

-- 7. UT Medicaid - PRISM portal account access
UPDATE payer_credentialing_workflows
SET
  submission_method = 'portal',
  contact_type = 'self_service',
  workflow_type = 'online_portal',
  portal_url = 'https://prism.utah.gov',
  credentialing_contact_name = 'Utah Medicaid PRISM Support',
  detailed_instructions = '[
    "Request or verify access to provider PRISM account",
    "Log into PRISM portal with provider credentials",
    "Navigate to clinic roster section",
    "Add new provider to clinic roster in system"
  ]'::jsonb,
  task_templates = '[
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
  ]'::jsonb
WHERE payer_id = (SELECT id FROM payers WHERE name IN ('Medicaid UT', 'Utah Medicaid'));

-- 8. UUHP - Provider info to general credentialing email
UPDATE payer_credentialing_workflows
SET
  submission_method = 'pdf_email',
  contact_type = 'general_email',
  workflow_type = 'online_portal',
  credentialing_contact_name = 'UUHP Credentialing Department',
  credentialing_contact_email = 'credentialing@uuhp.org',
  detailed_instructions = '[
    "Compile provider information and credentials",
    "Submit provider info to general UUHP credentialing email",
    "Follow up if needed"
  ]'::jsonb,
  task_templates = '[
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
  ]'::jsonb
WHERE payer_id = (SELECT id FROM payers WHERE name = 'University of Utah Health Plans (UUHP)');

-- Verify updates
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
  'Medicaid UT',
  'Utah Medicaid',
  'University of Utah Health Plans (UUHP)'
)
ORDER BY p.name;
