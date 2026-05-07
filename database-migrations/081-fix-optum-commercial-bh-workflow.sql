-- Migration 081: Fix Optum Commercial Behavioral Health credentialing workflow
--
-- Context:
--   The workflow was modeled as `instant_network` (auto-via-group-contract)
--   with placeholder tasks. The real process is portal-driven via Optum's
--   Provider Express. This migration corrects the workflow record and
--   regenerates Tatiana Kaehler's not-yet-started Optum tasks from the
--   new template.
--
-- Real process (per admin):
--   1. Log in to Provider Express portal
--   2. Use "Link a new provider" flow
--   3. Once linked, navigate to My Network Status > Start Credentialing Application
--
-- Affected payer: Optum Commercial Behavioral Health (c9a7e516-4498-4e21-8f7c-b359653d2d69)
-- Affected provider app: Tatiana Kaehler x Optum (b5f58dab-ac63-4322-859a-dfbca9119762)

BEGIN;

-- 1) Update the workflow record itself
UPDATE payer_credentialing_workflows
SET
  workflow_type = 'online_portal',
  portal_url = 'https://public.providerexpress.com/content/ope-provexpr/us/en/our-network.html',
  portal_instructions = 'Log in to Provider Express → Link a new provider → My Network Status → Start Credentialing Application',
  typical_approval_days = 60,
  notes = 'Provider Express is Optum''s behavioral health credentialing portal. Process is portal-driven; no PDF form. Provider must be linked in the account before the credentialing application becomes available under My Network Status.',
  task_templates = '[
    {
      "order": 1,
      "title": "Log in to Provider Express",
      "description": "Access https://public.providerexpress.com using Moonlit''s Provider Express administrator credentials.",
      "estimated_days": 0
    },
    {
      "order": 2,
      "title": "Link new provider in Provider Express",
      "description": "Use the Link-a-New-Provider flow. Have provider NPI, tax ID, and credentialing details on hand.",
      "estimated_days": 1
    },
    {
      "order": 3,
      "title": "Wait for provider link confirmation",
      "description": "The linked provider must appear in the account before the credentialing application becomes available.",
      "estimated_days": 2
    },
    {
      "order": 4,
      "title": "Start Credentialing Application",
      "description": "Navigate to My Network Status → Start Credentialing Application. Complete and submit the application. Have CAQH attestation, W-9, malpractice certificate, and license copies ready in case they are requested.",
      "estimated_days": 1
    },
    {
      "order": 5,
      "title": "Monitor application status in Provider Express",
      "description": "Check My Network Status periodically until approved. Record approval date and effective date when issued.",
      "estimated_days": 60
    },
    {
      "order": 6,
      "title": "Record contract details in Moonlit systems",
      "description": "Once approved, file effective date and any returned contract documents in the provider''s record.",
      "estimated_days": 0
    }
  ]'::jsonb,
  updated_at = NOW(),
  updated_by = 'migration-081'
WHERE payer_id = 'c9a7e516-4498-4e21-8f7c-b359653d2d69';

-- Sanity check: exactly one row should have been updated
DO $$
DECLARE
  row_count INT;
BEGIN
  GET DIAGNOSTICS row_count = ROW_COUNT;
  IF row_count <> 1 THEN
    RAISE EXCEPTION 'Expected to update 1 workflow row, updated %', row_count;
  END IF;
END $$;

-- 2) Regenerate Tatiana Kaehler's Optum tasks (her application is still not_started)
DELETE FROM provider_credentialing_tasks
WHERE provider_id = '19efc9c8-3950-45c4-be1d-f0e04615e0d1'
  AND payer_id    = 'c9a7e516-4498-4e21-8f7c-b359653d2d69';

INSERT INTO provider_credentialing_tasks (
  provider_id,
  payer_id,
  task_type,
  title,
  description,
  task_status,
  task_order,
  estimated_days,
  created_by
)
SELECT
  '19efc9c8-3950-45c4-be1d-f0e04615e0d1'::uuid,
  w.payer_id,
  w.workflow_type,
  (t->>'title')::text,
  COALESCE((t->>'description')::text, ''),
  'pending',
  COALESCE((t->>'order')::int, 0),
  COALESCE((t->>'estimated_days')::int, 0),
  'migration-081'
FROM payer_credentialing_workflows w,
     jsonb_array_elements(w.task_templates) t
WHERE w.payer_id = 'c9a7e516-4498-4e21-8f7c-b359653d2d69';

COMMIT;
