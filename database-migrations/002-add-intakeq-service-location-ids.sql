-- Add IntakeQ Service and Location ID fields to providers table
-- These are required for creating appointments in IntakeQ via API

ALTER TABLE providers
ADD COLUMN IF NOT EXISTS intakeq_service_id TEXT,
ADD COLUMN IF NOT EXISTS intakeq_location_id TEXT;

COMMENT ON COLUMN providers.intakeq_service_id IS 'IntakeQ Service ID for appointment creation (from IntakeQ Dashboard → Settings → Services)';
COMMENT ON COLUMN providers.intakeq_location_id IS 'IntakeQ Location ID for appointment creation (from IntakeQ Dashboard → Settings → Locations)';

-- Note: These values must be obtained manually from the IntakeQ dashboard
-- Each provider needs both service_id and location_id for appointments to sync to IntakeQ
