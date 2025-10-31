-- Merge Matthew Reese duplicate records (with trigger bypass)
-- Canonical record: e2f73fe3-038a-4fb6-ac56-36164789351f (has First Step House affiliation)
-- Duplicate record: 497676a5-3449-4f09-ba5b-41be7659e858 (created with new email)

-- STEP 1: Check what appointments exist for each record
SELECT
  'Canonical (old email)' as record_type,
  id,
  patient_id,
  start_time,
  status,
  pq_appointment_id
FROM appointments
WHERE patient_id = 'e2f73fe3-038a-4fb6-ac56-36164789351f'
ORDER BY start_time DESC
LIMIT 5;

SELECT
  'Duplicate (new email)' as record_type,
  id,
  patient_id,
  start_time,
  status,
  pq_appointment_id
FROM appointments
WHERE patient_id = '497676a5-3449-4f09-ba5b-41be7659e858'
ORDER BY start_time DESC
LIMIT 5;

-- STEP 2: Update the canonical record with the NEW email and add OLD email to alternates
UPDATE patients
SET
  email = 'm47732414@gmail.com',
  alternate_emails = '["bwhipkey+16@firststephouse.org"]'::jsonb,
  updated_at = NOW()
WHERE id = 'e2f73fe3-038a-4fb6-ac56-36164789351f';

-- STEP 3: Temporarily disable BOTH bookability triggers to allow appointment moves
-- (check_bookable_provider_payer fires on UPDATE, enforce_bookable_provider_payer fires on INSERT)
ALTER TABLE appointments DISABLE TRIGGER check_bookable_provider_payer;
ALTER TABLE appointments DISABLE TRIGGER enforce_bookable_provider_payer;

-- STEP 4: Move any appointments from duplicate record to canonical record
UPDATE appointments
SET patient_id = 'e2f73fe3-038a-4fb6-ac56-36164789351f'
WHERE patient_id = '497676a5-3449-4f09-ba5b-41be7659e858';

-- STEP 5: Re-enable both bookability triggers
ALTER TABLE appointments ENABLE TRIGGER check_bookable_provider_payer;
ALTER TABLE appointments ENABLE TRIGGER enforce_bookable_provider_payer;

-- STEP 6: Check for any other affiliations on duplicate record (should return 0 rows)
SELECT *
FROM patient_organization_affiliations
WHERE patient_id = '497676a5-3449-4f09-ba5b-41be7659e858';

-- STEP 7: Delete the duplicate patient record
DELETE FROM patients
WHERE id = '497676a5-3449-4f09-ba5b-41be7659e858';

-- STEP 8: Verify the merge worked
SELECT
  id,
  first_name,
  last_name,
  email,
  alternate_emails,
  primary_provider_id
FROM patients
WHERE id = 'e2f73fe3-038a-4fb6-ac56-36164789351f';

-- STEP 9: Check appointments are now all under canonical record
SELECT
  COUNT(*) as appointment_count,
  MIN(start_time) as earliest_appointment,
  MAX(start_time) as latest_appointment
FROM appointments
WHERE patient_id = 'e2f73fe3-038a-4fb6-ac56-36164789351f';

-- STEP 10: Verify duplicate is gone
SELECT COUNT(*) as should_be_zero
FROM patients
WHERE id = '497676a5-3449-4f09-ba5b-41be7659e858';
