-- Fix task template schema mismatch
-- Migration 035 used 'task_name' but API expects 'title'
-- This caused NOT NULL constraint violations when creating tasks

-- Update all instant_network workflows to use correct schema
UPDATE payer_credentialing_workflows
SET task_templates = '[
  {
    "title": "Verify group contract coverage",
    "description": "Confirm provider is covered under Moonlit''s existing group contract with this payer",
    "order": 1,
    "estimated_days": 0
  },
  {
    "title": "Add provider to internal roster",
    "description": "Update internal systems to reflect provider''s coverage under group contract",
    "order": 2,
    "estimated_days": 1
  }
]'::jsonb
WHERE workflow_type = 'instant_network';

-- Verify the update
SELECT
  p.name as payer_name,
  pcw.workflow_type,
  jsonb_pretty(pcw.task_templates) as formatted_tasks
FROM payer_credentialing_workflows pcw
JOIN payers p ON p.id = pcw.payer_id
WHERE pcw.workflow_type = 'instant_network'
ORDER BY p.name
LIMIT 5;

-- Count affected rows
SELECT
  workflow_type,
  COUNT(*) as payer_count,
  COUNT(CASE WHEN task_templates->0 ? 'title' THEN 1 END) as has_title_field,
  COUNT(CASE WHEN task_templates->0 ? 'task_name' THEN 1 END) as has_task_name_field
FROM payer_credentialing_workflows
WHERE workflow_type = 'instant_network'
GROUP BY workflow_type;
