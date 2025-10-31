-- Migration: Add alternate_emails to patients table
-- Purpose: Support patients with multiple email addresses (email changes, work/personal emails)
-- Date: 2025-10-31

-- Add alternate_emails column (JSONB array of strings)
ALTER TABLE patients
ADD COLUMN IF NOT EXISTS alternate_emails JSONB DEFAULT '[]'::jsonb;

-- Add comment
COMMENT ON COLUMN patients.alternate_emails IS 'Array of alternate email addresses for this patient. Used for PracticeQ/IntakeQ appointment matching when patient has changed emails or has multiple contact emails.';

-- Create index for searching within alternate_emails (GIN index for JSONB)
CREATE INDEX IF NOT EXISTS idx_patients_alternate_emails
ON patients USING GIN (alternate_emails);

-- Example: Add Matthew Reese's alternate emails
-- Update this with actual patient ID after deployment
-- UPDATE patients
-- SET alternate_emails = '["bwhipkey+16@firststephouse.org"]'::jsonb
-- WHERE email = 'm47732414@gmail.com'
-- AND first_name = 'Matthew'
-- AND last_name = 'Reese';

-- Example query to find patient by any email (primary or alternate):
-- SELECT * FROM patients
-- WHERE email = 'search@example.com'
--    OR alternate_emails @> '"search@example.com"'::jsonb;

COMMIT;
