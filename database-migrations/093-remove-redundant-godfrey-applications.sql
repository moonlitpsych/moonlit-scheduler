-- 093-remove-redundant-godfrey-applications.sql
--
-- Dr. Donald Godfrey (2ff6c3b9-d35f-4433-ba32-772064737bde) carries 17
-- not_started provider_payer_applications. Three of them are for payers he is
-- ALREADY in_network and bookable with (confirmed via provider_payer_networks
-- and v_bookable_provider_payer), so a "not_started application" is factually
-- wrong noise on his credentialing dashboard:
--
--   Health Choice Utah  62ab291d-b68e-4c71-a093-2d6e380764c3  (contract eff 2026-05-22)
--   Molina Utah         8b48c3e2-f555-4d67-8122-c086466ba97d  (contract eff 2026-05-20)
--   UUHP                c238fcff-dd31-4be8-a0b2-292c0800d9c4  (contract eff 2026-06-01)
--
-- All three apps have NULL application_submitted_date (never worked — placeholder
-- rows) and ZERO linked provider_credentialing_tasks, so deleting them orphans
-- nothing. The other 14 not_started apps are for payers he has no contract with
-- yet — a legitimate credentialing pipeline — and are intentionally left intact.
--
-- Deleting by application id (verified live 2026-06-25), not by payer, to be exact.

BEGIN;

-- Safety: confirm zero tasks reference these apps before deleting (should be 0).
-- (Informational SELECT; does not block the transaction.)
SELECT 'linked_tasks_before' AS check, COUNT(*) AS n
FROM provider_credentialing_tasks
WHERE application_id IN (
  'e38ed480-6350-4cb0-aee0-2f1b4c113208',  -- HCU
  'cc4c485e-3dcd-4fb1-b82e-9a51aae3ecf8',  -- Molina
  '96273d83-a541-4a5e-bc9f-8856d7519f14'   -- UUHP
);

DELETE FROM provider_payer_applications
WHERE id IN (
  'e38ed480-6350-4cb0-aee0-2f1b4c113208',  -- HCU
  'cc4c485e-3dcd-4fb1-b82e-9a51aae3ecf8',  -- Molina
  '96273d83-a541-4a5e-bc9f-8856d7519f14'   -- UUHP
)
AND provider_id = '2ff6c3b9-d35f-4433-ba32-772064737bde'
AND application_status = 'not_started'        -- guard: only remove never-started rows
AND application_submitted_date IS NULL;       -- guard: never touch a submitted app

-- Verify: Godfrey should now have 14 applications, none for HCU/Molina/UUHP.
SELECT 'godfrey_apps_after' AS check, COUNT(*) AS remaining
FROM provider_payer_applications
WHERE provider_id = '2ff6c3b9-d35f-4433-ba32-772064737bde';

SELECT 'redundant_remaining' AS check, COUNT(*) AS should_be_zero
FROM provider_payer_applications
WHERE provider_id = '2ff6c3b9-d35f-4433-ba32-772064737bde'
  AND payer_id IN (
    '62ab291d-b68e-4c71-a093-2d6e380764c3',
    '8b48c3e2-f555-4d67-8122-c086466ba97d',  -- Molina Utah
    'c238fcff-dd31-4be8-a0b2-292c0800d9c4'
  );

COMMIT;
