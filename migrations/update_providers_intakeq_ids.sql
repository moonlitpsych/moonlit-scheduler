-- Update providers with actual IntakeQ practitioner IDs
-- Date: 2025-10-04
-- These IDs were fetched from IntakeQ API

-- First, ensure the columns exist
ALTER TABLE providers
ADD COLUMN IF NOT EXISTS intakeq_practitioner_id TEXT,
ADD COLUMN IF NOT EXISTS intakeq_service_id TEXT,
ADD COLUMN IF NOT EXISTS intakeq_location_id TEXT;

-- Update Travis Norseth
UPDATE providers
SET
  intakeq_practitioner_id = '674f75864066453dbd5db757',
  intakeq_service_id = '01JDQR0MT6MGADAMR7N8XHGZQ1', -- Default service, update as needed
  intakeq_location_id = '2' -- Housed Medicaid location
WHERE first_name = 'Travis' AND last_name = 'Norseth';

-- Update Tatiana Kaehler
UPDATE providers
SET
  intakeq_practitioner_id = '6838a1c65752f5b216563846',
  intakeq_service_id = '01JDQR0MT6MGADAMR7N8XHGZQ1', -- Default service, update as needed
  intakeq_location_id = '2' -- Housed Medicaid location
WHERE first_name = 'Tatiana' AND last_name = 'Kaehler';

-- Update Merrick Reynolds
UPDATE providers
SET
  intakeq_practitioner_id = '6848eada36472707ced63b78',
  intakeq_service_id = '01JDQR0MT6MGADAMR7N8XHGZQ1', -- Default service, update as needed
  intakeq_location_id = '2' -- Housed Medicaid location
WHERE first_name = 'Merrick' AND last_name = 'Reynolds';

-- Update C. Rufus Sweeney
UPDATE providers
SET
  intakeq_practitioner_id = '685ee0c8bf742b8ede28f37e',
  intakeq_service_id = '01JDQR0MT6MGADAMR7N8XHGZQ1', -- Default service, update as needed
  intakeq_location_id = '2' -- Housed Medicaid location
WHERE first_name = 'Rufus' AND last_name = 'Sweeney';

-- Verify the updates
SELECT
    id,
    first_name,
    last_name,
    intakeq_practitioner_id,
    intakeq_service_id,
    intakeq_location_id,
    is_bookable,
    CASE
        WHEN intakeq_practitioner_id IS NOT NULL THEN '✅ IntakeQ Ready'
        ELSE '❌ No IntakeQ ID'
    END as intakeq_status
FROM providers
WHERE is_bookable = true
ORDER BY last_name, first_name;