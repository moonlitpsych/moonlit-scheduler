-- Find Matthew Reese and add his alternate email
-- Step 1: Find his patient ID
SELECT id, first_name, last_name, email, alternate_emails
FROM patients
WHERE first_name ILIKE '%matthew%'
  AND last_name ILIKE '%reese%';

-- Step 2: Add his alternate email (run this after confirming the ID above)
-- Replace the email in the WHERE clause with his actual current email if different
UPDATE patients
SET alternate_emails = '["bwhipkey+16@firststephouse.org"]'::jsonb
WHERE (email = 'm47732414@gmail.com' OR email = 'bwhipkey+16@firststephouse.org')
  AND first_name ILIKE '%matthew%'
  AND last_name ILIKE '%reese%';

-- Step 3: Verify it worked
SELECT id, first_name, last_name, email, alternate_emails
FROM patients
WHERE first_name ILIKE '%matthew%'
  AND last_name ILIKE '%reese%';
