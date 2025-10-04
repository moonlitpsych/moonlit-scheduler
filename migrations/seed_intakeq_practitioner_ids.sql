-- Seed IntakeQ practitioner IDs for existing providers
-- Date: 2025-10-04
-- These IDs were fetched directly from IntakeQ API

-- Update Travis Norseth
UPDATE providers
SET intakeq_practitioner_id = '674f75864066453dbd5db757'
WHERE first_name = 'Travis' AND last_name = 'Norseth';

-- Update Tatiana Kaehler
UPDATE providers
SET intakeq_practitioner_id = '6838a1c65752f5b216563846'
WHERE first_name = 'Tatiana' AND last_name = 'Kaehler';

-- Update Merrick Reynolds
UPDATE providers
SET intakeq_practitioner_id = '6848eada36472707ced63b78'
WHERE first_name = 'Merrick' AND last_name = 'Reynolds';

-- Update C. Rufus Sweeney
UPDATE providers
SET intakeq_practitioner_id = '685ee0c8bf742b8ede28f37e'
WHERE first_name = 'Rufus' AND last_name = 'Sweeney';

-- Verify the updates
SELECT
    id,
    first_name || ' ' || last_name as provider_name,
    intakeq_practitioner_id,
    is_bookable,
    CASE
        WHEN intakeq_practitioner_id IS NOT NULL THEN '✅ IntakeQ Ready'
        ELSE '❌ No IntakeQ ID'
    END as status
FROM providers
WHERE is_bookable = true
ORDER BY last_name, first_name;