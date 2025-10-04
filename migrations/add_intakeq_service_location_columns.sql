-- Add IntakeQ configuration columns to providers table
-- Migration: add_intakeq_service_location_columns
-- Date: 2025-10-04

-- Add the columns
ALTER TABLE providers
ADD COLUMN IF NOT EXISTS intakeq_service_id TEXT,
ADD COLUMN IF NOT EXISTS intakeq_location_id TEXT;

-- Add comments for documentation
COMMENT ON COLUMN providers.intakeq_service_id IS 'Default IntakeQ service ID for this provider appointments';
COMMENT ON COLUMN providers.intakeq_location_id IS 'Default IntakeQ location ID for this provider';

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_providers_intakeq_service_id ON providers(intakeq_service_id);
CREATE INDEX IF NOT EXISTS idx_providers_intakeq_location_id ON providers(intakeq_location_id);

-- Update providers with default values (using fallback values from code)
-- User should update these with actual IntakeQ IDs later
UPDATE providers
SET
  intakeq_service_id = '01JDQR0MT6MGADAMR7N8XHGZQ1',  -- Default service ID
  intakeq_location_id = '1'                           -- Default location ID
WHERE intakeq_practitioner_id IS NOT NULL;

-- Verify the updates
SELECT
    id,
    first_name,
    last_name,
    intakeq_practitioner_id,
    intakeq_service_id,
    intakeq_location_id,
    CASE
        WHEN intakeq_practitioner_id IS NOT NULL
             AND intakeq_service_id IS NOT NULL
             AND intakeq_location_id IS NOT NULL
        THEN '✅ Fully Configured'
        WHEN intakeq_practitioner_id IS NOT NULL
        THEN '⚠️ Missing Service/Location IDs'
        ELSE '❌ Not Integrated'
    END as intakeq_status
FROM providers
ORDER BY last_name, first_name;