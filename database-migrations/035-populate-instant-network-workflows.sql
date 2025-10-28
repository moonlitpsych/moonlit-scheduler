-- Migration: Populate credentialing workflows for payers with group contracts
-- These payers have requires_individual_contract = false, meaning providers are
-- automatically credentialed via Moonlit's group contract

-- Insert instant_network workflows for all payers that don't require individual contracts
INSERT INTO payer_credentialing_workflows (
  payer_id,
  workflow_type,
  task_templates,
  typical_approval_days,
  notes,
  created_at,
  updated_at
)
SELECT
  id as payer_id,
  'instant_network' as workflow_type,
  '[
    {
      "task_name": "Verify group contract coverage",
      "category": "verification",
      "description": "Confirm provider is covered under Moonlit''s existing group contract with this payer"
    },
    {
      "task_name": "Add provider to internal roster",
      "category": "administrative",
      "description": "Update internal systems to reflect provider''s coverage under group contract"
    }
  ]'::jsonb as task_templates,
  0 as typical_approval_days, -- Instant network, no waiting period
  'Provider is automatically credentialed via Moonlit''s group contract. No individual application required.' as notes,
  NOW() as created_at,
  NOW() as updated_at
FROM payers
WHERE requires_individual_contract = false
ON CONFLICT (payer_id) DO UPDATE SET
  workflow_type = EXCLUDED.workflow_type,
  task_templates = EXCLUDED.task_templates,
  typical_approval_days = EXCLUDED.typical_approval_days,
  notes = EXCLUDED.notes,
  updated_at = NOW();

-- Verify the insert
SELECT
  COUNT(*) as workflows_created,
  workflow_type
FROM payer_credentialing_workflows
WHERE workflow_type = 'instant_network'
GROUP BY workflow_type;
