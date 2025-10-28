-- Add PDF form submission as a workflow type
-- Many payers provide PDF forms that must be filled and submitted

-- First, let's check the current constraint
ALTER TABLE payer_credentialing_workflows
DROP CONSTRAINT IF EXISTS payer_credentialing_workflows_workflow_type_check;

-- Add new constraint with pdf_form_submission
ALTER TABLE payer_credentialing_workflows
ADD CONSTRAINT payer_credentialing_workflows_workflow_type_check
CHECK (workflow_type IN (
  'instant_network',
  'online_portal',
  'excel_submission',
  'pdf_form_submission'
));

-- Verify
SELECT
  constraint_name,
  check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'payer_credentialing_workflows_workflow_type_check';
