-- 091-seed-uuhp-plans-and-delegation.sql
--
-- Reflects the credentialing reality described by UUHP provider relations
-- (message relayed 2026-06-24):
--   "Once providers are credentialed, they are in network for all the plans for
--    which the entire group is contracted. For UUHP these would be: Healthy
--    Premier, Healthy Preferred, Healthy U Behavioral Health, U Health Plus.
--    Health Choice Utah is a separate health plan independent of UUHP. But we do
--    handle the credentialing for their providers."
--
-- Modeling decisions (confirmed with Miriam):
--   1. The four UUHP plans are tracked as payer_plans under the single UUHP
--      (commercial) payer. Booking stays payer-level, so ONE UUHP contract
--      covers all four plans automatically (no booking-validation change — see
--      CLAUDE.md "NO PLAN VALIDATION IN BOOKING FLOW").
--   2. HealthyU (UUHP) Medicaid's credentialing is performed via UUHP's process,
--      so it points at UUHP through the new credentialing_handled_by_payer_id
--      column (added separately). It remains its own payer for booking/eligibility.
--   (HCU keeps its own existing credentialing workflow for now, per Miriam.)
--
-- Prereq: payers.credentialing_handled_by_payer_id column already added.
--
-- Payer IDs (verified against live DB 2026-06-24):
--   UUHP (commercial, Private) ......... c238fcff-dd31-4be8-a0b2-292c0800d9c4
--   HealthyU (UUHP) (Medicaid) ......... d218f12b-f8c4-498e-96c4-a03693c322d2

BEGIN;

-- 1. Delegate HealthyU (UUHP) Medicaid credentialing to the UUHP process.
UPDATE payers
SET credentialing_handled_by_payer_id = 'c238fcff-dd31-4be8-a0b2-292c0800d9c4'
WHERE id = 'd218f12b-f8c4-498e-96c4-a03693c322d2';

-- 2. Track the four UUHP plans under the UUHP (commercial) payer.
--    plan_type defaults to 'OTHER' pending confirmation of each plan's product
--    type (HMO/PPO/EPO/POS/HDHP). is_default left FALSE until the standard plan
--    is confirmed. Idempotent via the (payer_id, plan_name) unique constraint.
INSERT INTO payer_plans (payer_id, plan_name, plan_type, is_default, is_active, notes)
VALUES
  ('c238fcff-dd31-4be8-a0b2-292c0800d9c4', 'Healthy Premier',            'OTHER', FALSE, TRUE, 'UUHP group plan. Covered by a single UUHP credentialing/contract. Source: UUHP provider relations, 2026-06-24.'),
  ('c238fcff-dd31-4be8-a0b2-292c0800d9c4', 'Healthy Preferred',          'OTHER', FALSE, TRUE, 'UUHP group plan. Covered by a single UUHP credentialing/contract. Source: UUHP provider relations, 2026-06-24.'),
  ('c238fcff-dd31-4be8-a0b2-292c0800d9c4', 'Healthy U Behavioral Health','OTHER', FALSE, TRUE, 'UUHP group plan (behavioral health). Covered by a single UUHP credentialing/contract. Source: UUHP provider relations, 2026-06-24.'),
  ('c238fcff-dd31-4be8-a0b2-292c0800d9c4', 'U Health Plus',              'OTHER', FALSE, TRUE, 'UUHP group plan. Covered by a single UUHP credentialing/contract. Source: UUHP provider relations, 2026-06-24.')
ON CONFLICT (payer_id, plan_name) DO NOTHING;

-- Verify before committing.
--   Expect 1 delegated payer and 4 UUHP plans.
SELECT 'delegation' AS check, count(*) AS rows
FROM payers WHERE credentialing_handled_by_payer_id = 'c238fcff-dd31-4be8-a0b2-292c0800d9c4'
UNION ALL
SELECT 'uuhp_plans', count(*)
FROM payer_plans WHERE payer_id = 'c238fcff-dd31-4be8-a0b2-292c0800d9c4';

COMMIT;
