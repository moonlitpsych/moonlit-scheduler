-- Enhance payer_credentialing_workflows with real-world process details
-- Adds fields for portal URLs, submission emails, file attachments, and detailed instructions

-- Add new columns for enhanced workflow tracking
ALTER TABLE payer_credentialing_workflows
ADD COLUMN IF NOT EXISTS portal_url TEXT,
ADD COLUMN IF NOT EXISTS submission_method TEXT,
ADD COLUMN IF NOT EXISTS submission_email TEXT,
ADD COLUMN IF NOT EXISTS contact_type TEXT,
ADD COLUMN IF NOT EXISTS form_template_url TEXT,
ADD COLUMN IF NOT EXISTS form_template_filename TEXT,
ADD COLUMN IF NOT EXISTS detailed_instructions JSONB,
ADD COLUMN IF NOT EXISTS reference_documents JSONB;

-- Add check constraint for submission_method
ALTER TABLE payer_credentialing_workflows
DROP CONSTRAINT IF EXISTS payer_credentialing_workflows_submission_method_check;

ALTER TABLE payer_credentialing_workflows
ADD CONSTRAINT payer_credentialing_workflows_submission_method_check
CHECK (submission_method IN ('portal', 'pdf_email', 'spreadsheet_email', 'multi_step', 'portal_then_email'));

-- Add check constraint for contact_type
ALTER TABLE payer_credentialing_workflows
DROP CONSTRAINT IF EXISTS payer_credentialing_workflows_contact_type_check;

ALTER TABLE payer_credentialing_workflows
ADD CONSTRAINT payer_credentialing_workflows_contact_type_check
CHECK (contact_type IN ('human_contact', 'general_email', 'portal_only', 'self_service'));

-- Create public directory for credentialing forms (reference only - actual directory created separately)
COMMENT ON COLUMN payer_credentialing_workflows.form_template_url IS 'Relative path like /credentialing-forms/payer-name-form.pdf or full URL';
COMMENT ON COLUMN payer_credentialing_workflows.detailed_instructions IS 'Step-by-step instructions as JSONB array';
COMMENT ON COLUMN payer_credentialing_workflows.reference_documents IS 'Array of {name, url, type} for supporting documents';

-- Verify new columns
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'payer_credentialing_workflows'
  AND column_name IN (
    'portal_url',
    'submission_method',
    'submission_email',
    'contact_type',
    'form_template_url',
    'form_template_filename',
    'detailed_instructions',
    'reference_documents'
  )
ORDER BY column_name;
