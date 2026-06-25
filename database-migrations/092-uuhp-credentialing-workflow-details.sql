-- 092-uuhp-credentialing-workflow-details.sql
--
-- Captures credentialing guidance from UUHP provider credentialing
-- (provider.credentialing@hsc.utah.edu, relayed 2026-06-24):
--   "Since Moonlit is contracted for both plans, once we receive the form you can
--    download from https://uhealthplan.utah.edu/providers/credentialing, we will
--    start the credentialing process for your providers simultaneously with HCU
--    and UUHP. The credentialing process takes about 6 weeks."
--
-- Strategy: store the credentialing know-how ONCE on the authority payer (UUHP).
-- HealthyU (UUHP) and Health Choice Utah delegate to UUHP via
-- credentialing_handled_by_payer_id, so they inherit this workflow automatically
-- (the dashboard resolves a delegated payer's workflow from its handler).
--
-- Payer IDs (verified live):
--   UUHP (commercial) .......... c238fcff-dd31-4be8-a0b2-292c0800d9c4
--   Health Choice Utah ......... 62ab291d-b68e-4c71-a093-2d6e380764c3
--   HealthyU (UUHP) ............ d218f12b-f8c4-498e-96c4-a03693c322d2  (already delegated in 091)

BEGIN;

-- 1. Enrich the UUHP credentialing workflow with the real form URL, contact,
--    ~6-week turnaround, and accurate step-by-step instructions.
UPDATE payer_credentialing_workflows
SET
  portal_url                 = 'https://uhealthplan.utah.edu/providers/credentialing',
  credentialing_contact_name = 'UUHP Provider Credentialing',
  credentialing_contact_email= 'provider.credentialing@hsc.utah.edu',
  typical_approval_days      = 42,  -- ~6 weeks
  detailed_instructions      = '[
    "Download the credentialing form from https://uhealthplan.utah.edu/providers/credentialing",
    "Complete the form for the provider(s)",
    "Email the completed form to provider.credentialing@hsc.utah.edu",
    "UUHP begins credentialing simultaneously for UUHP and Health Choice Utah (Moonlit is contracted with both plans)",
    "Processing takes about 6 weeks"
  ]'::jsonb,
  notes      = 'Single credentialing process covers UUHP and Health Choice Utah simultaneously. Source: UUHP provider credentialing (provider.credentialing@hsc.utah.edu), 2026-06-24.',
  updated_at = NOW()
WHERE payer_id = 'c238fcff-dd31-4be8-a0b2-292c0800d9c4';

-- 2. Delegate Health Choice Utah credentialing to UUHP. UUHP credentials for HCU
--    and UUHP at the same time, so HCU inherits the workflow above and the
--    dashboard shows a "Credentialing handled by UUHP" badge. HCU remains its own
--    payer with an independent contract & fee schedule. (HCU's own workflow row is
--    left intact for reference but is no longer shown for credentialing once
--    delegated.)
--    NOTE: this updates the earlier decision to leave HCU standalone, per the new
--    confirmation that credentialing is simultaneous via UUHP.
UPDATE payers
SET credentialing_handled_by_payer_id = 'c238fcff-dd31-4be8-a0b2-292c0800d9c4'
WHERE id = '62ab291d-b68e-4c71-a093-2d6e380764c3';

-- Verify.
SELECT 'uuhp_workflow' AS check,
       portal_url, credentialing_contact_email, typical_approval_days,
       jsonb_array_length(detailed_instructions) AS instruction_steps
FROM payer_credentialing_workflows
WHERE payer_id = 'c238fcff-dd31-4be8-a0b2-292c0800d9c4';

SELECT 'hcu_delegated' AS check, name, credentialing_handled_by_payer_id
FROM payers
WHERE id = '62ab291d-b68e-4c71-a093-2d6e380764c3';

COMMIT;
