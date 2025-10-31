-- Merge Matthew Reese duplicate records
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

-- STEP 3: Move any appointments from duplicate record to canonical record
UPDATE appointments
SET patient_id = 'e2f73fe3-038a-4fb6-ac56-36164789351f'
WHERE patient_id = '497676a5-3449-4f09-ba5b-41be7659e858';

-- STEP 4: Move any other data associated with duplicate record
-- (Check if there are any user assignments, etc.)
UPDATE patient_user_assignments
SET patient_id = 'e2f73fe3-038a-4fb6-ac56-36164789351f'
WHERE patient_id = '497676a5-3449-4f09-ba5b-41be7659e858';

-- STEP 5: Check for any other affiliations on duplicate record
SELECT *
FROM patient_organization_affiliations
WHERE patient_id = '497676a5-3449-4f09-ba5b-41be7659e858';

-- STEP 6: Delete the duplicate patient record
DELETE FROM patients
WHERE id = '497676a5-3449-4f09-ba5b-41be7659e858';

-- STEP 7: Verify the merge worked
SELECT
  id,
  first_name,
  last_name,
  email,
  alternate_emails,
  primary_provider_id
FROM patients
WHERE id = 'e2f73fe3-038a-4fb6-ac56-36164789351f';

-- STEP 8: Check appointments are now all under canonical record
SELECT
  COUNT(*) as appointment_count,
  MIN(start_time) as earliest_appointment,
  MAX(start_time) as latest_appointment
FROM appointments
WHERE patient_id = 'e2f73fe3-038a-4fb6-ac56-36164789351f';

-- STEP 9: Verify duplicate is gone
SELECT COUNT(*) as should_be_zero
FROM patients
WHERE id = '497676a5-3449-4f09-ba5b-41be7659e858';
