-- Dev Network Check: Verify provider-payer mappings for booking flow
-- Use this when you get PAYER_NOT_IN_NETWORK errors

-- 1) Show columns so we match real schema
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'provider_payer_networks'
ORDER BY ordinal_position;

-- 2) Inspect the specific provider/payer pair (replace with IDs from request)
-- Example IDs (replace these):
-- providerId: 08fbcd34-cd5f-425c-85bd-1aeeffbe9694 (Dr. Sweeney)
-- payerId: 8b48c3e2-f555-4d67-8122-c086466ba97d (UnitedHealthcare Community Plan)

SELECT *
FROM provider_payer_networks
WHERE provider_id = '08fbcd34-cd5f-425c-85bd-1aeeffbe9694'
  AND payer_id    = '8b48c3e2-f555-4d67-8122-c086466ba97d';

-- 3) If no rows, seed a DEV row (adjust column names based on #1 results)
-- Only run this for DEV/TEST environments!
INSERT INTO provider_payer_networks (provider_id, payer_id, created_at, updated_at)
VALUES (
  '08fbcd34-cd5f-425c-85bd-1aeeffbe9694',
  '8b48c3e2-f555-4d67-8122-c086466ba97d',
  NOW(),
  NOW()
)
ON CONFLICT (provider_id, payer_id) DO NOTHING;

-- 4) Re-check after insert
SELECT *
FROM provider_payer_networks
WHERE provider_id = '08fbcd34-cd5f-425c-85bd-1aeeffbe9694'
  AND payer_id    = '8b48c3e2-f555-4d67-8122-c086466ba97d';

-- 5) Check what the bookability view thinks about this pair
SELECT *
FROM v_bookable_provider_payer
WHERE provider_id = '08fbcd34-cd5f-425c-85bd-1aeeffbe9694'
  AND payer_id    = '8b48c3e2-f555-4d67-8122-c086466ba97d';

-- 6) Show all mappings for this provider (debugging)
SELECT
  ppn.provider_id,
  p.first_name || ' ' || p.last_name as provider_name,
  ppn.payer_id,
  pay.name as payer_name,
  ppn.created_at
FROM provider_payer_networks ppn
JOIN providers p ON p.id = ppn.provider_id
JOIN payers pay ON pay.id = ppn.payer_id
WHERE ppn.provider_id = '08fbcd34-cd5f-425c-85bd-1aeeffbe9694'
ORDER BY pay.name;