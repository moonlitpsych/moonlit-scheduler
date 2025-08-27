-- Add IntakeQ practitioner ID column to providers table
-- Migration: add_intakeq_practitioner_id
-- Date: 2025-08-21

-- Add the column
ALTER TABLE providers 
ADD COLUMN intakeq_practitioner_id TEXT;

-- Add comment for documentation
COMMENT ON COLUMN providers.intakeq_practitioner_id IS 'IntakeQ practitioner ID for EMR integration';

-- Create index for faster lookups
CREATE INDEX idx_providers_intakeq_practitioner_id ON providers(intakeq_practitioner_id);

-- Populate with known mappings based on email addresses
-- These mappings are from the IntakeQ API response we fetched

-- Update C. Rufus Sweeney (rufussweeney@gmail.com)
UPDATE providers 
SET intakeq_practitioner_id = '685ee0c8bf742b8ede28f37e'
WHERE email = 'rufussweeney@gmail.com' OR 
      LOWER(first_name) = 'rufus' OR 
      LOWER(last_name) = 'sweeney';

-- Update Travis Norseth (travis.norseth@hsc.utah.edu)  
UPDATE providers 
SET intakeq_practitioner_id = '674f75864066453dbd5db757'
WHERE email = 'travis.norseth@hsc.utah.edu' OR 
      (LOWER(first_name) = 'travis' AND LOWER(last_name) = 'norseth');

-- Update Tatiana Kaehler (tatianakaehler@gmail.com)
UPDATE providers 
SET intakeq_practitioner_id = '6838a1c65752f5b216563846'
WHERE email = 'tatianakaehler@gmail.com' OR 
      (LOWER(first_name) = 'tatiana' AND LOWER(last_name) = 'kaehler');

-- Update Merrick Reynolds (merricksreynolds@gmail.com)
UPDATE providers 
SET intakeq_practitioner_id = '6848eada36472707ced63b78'
WHERE email = 'merricksreynolds@gmail.com' OR 
      (LOWER(first_name) = 'merrick' AND LOWER(last_name) = 'reynolds');

-- Verify the updates
SELECT 
    id,
    first_name,
    last_name,
    email,
    intakeq_practitioner_id,
    CASE 
        WHEN intakeq_practitioner_id IS NOT NULL THEN 'Mapped'
        ELSE 'Not Mapped'
    END as mapping_status
FROM providers
ORDER BY last_name, first_name;