-- Create IntakeQ settings table for providers
-- This isolates EMR-specific configuration from the core providers table

CREATE TABLE IF NOT EXISTS provider_intakeq_settings (
  provider_id UUID PRIMARY KEY REFERENCES providers(id) ON DELETE CASCADE,
  practitioner_id TEXT,  -- IntakeQ Practitioner ID (currently stored in providers.intakeq_practitioner_id)
  service_id TEXT NOT NULL,  -- Default IntakeQ Service ID for appointments
  location_id TEXT NOT NULL,  -- Default IntakeQ Location ID for appointments
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_provider_intakeq_settings_provider_id
ON provider_intakeq_settings(provider_id);

-- Add comments
COMMENT ON TABLE provider_intakeq_settings IS 'IntakeQ-specific configuration for providers';
COMMENT ON COLUMN provider_intakeq_settings.practitioner_id IS 'IntakeQ Practitioner ID from IntakeQ dashboard';
COMMENT ON COLUMN provider_intakeq_settings.service_id IS 'Default IntakeQ Service ID (e.g., "New Patient Visit")';
COMMENT ON COLUMN provider_intakeq_settings.location_id IS 'Default IntakeQ Location ID (e.g., "Insurance - UT")';

-- Populate with data for bookable providers
-- Using Service ID: 137bcec9-6d59-4cd8-910f-a1d9c0616319 (New Patient Visit - insurance UT)
-- Using Location ID: 4 (Insurance - UT)
INSERT INTO provider_intakeq_settings (provider_id, practitioner_id, service_id, location_id)
SELECT
  id,
  intakeq_practitioner_id,
  '137bcec9-6d59-4cd8-910f-a1d9c0616319',  -- New Patient Visit (insurance — UT)
  '4'  -- Insurance — UT
FROM providers
WHERE is_bookable = true
  AND intakeq_practitioner_id IS NOT NULL
ON CONFLICT (provider_id) DO UPDATE
SET
  practitioner_id = EXCLUDED.practitioner_id,
  service_id = EXCLUDED.service_id,
  location_id = EXCLUDED.location_id,
  updated_at = NOW();

-- Verification query (run after migration)
-- SELECT
--   p.first_name,
--   p.last_name,
--   p.is_bookable,
--   pis.practitioner_id,
--   pis.service_id,
--   pis.location_id
-- FROM providers p
-- LEFT JOIN provider_intakeq_settings pis ON p.id = pis.provider_id
-- WHERE p.is_bookable = true;
