/**
 * Migration 023: Add Meeting URL and Location Information to Appointments
 *
 * Purpose:
 * - Store telehealth meeting URLs (Google Meet links from IntakeQ)
 * - Store location information for in-person appointments
 * - Enable case managers to see where/how patients attend appointments
 *
 * Use Case:
 * Case managers need to share telehealth links or office addresses
 * with patients to help them get to their appointments on time.
 */

-- Add meeting_url column for telehealth links
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS meeting_url TEXT;

COMMENT ON COLUMN appointments.meeting_url IS
  'Video conferencing URL for telehealth appointments (e.g., Google Meet link from IntakeQ)';

-- Add location_info column for appointment location details
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS location_info JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN appointments.location_info IS
  'Location details from IntakeQ: {
    "locationId": "4",
    "locationName": "Insurance — UT",
    "placeOfService": "10",
    "address": {...}
  }';

-- Create index for querying telehealth appointments
CREATE INDEX IF NOT EXISTS idx_appointments_meeting_url
ON appointments(meeting_url)
WHERE meeting_url IS NOT NULL;

-- Create index for location queries
CREATE INDEX IF NOT EXISTS idx_appointments_location_info
ON appointments USING GIN (location_info)
WHERE location_info IS NOT NULL AND location_info != '{}'::jsonb;

-- Add helper function to determine if appointment is telehealth
CREATE OR REPLACE FUNCTION is_telehealth_appointment(appt_location_info JSONB)
RETURNS BOOLEAN AS $$
BEGIN
  -- Place of Service codes:
  -- 02 = Telehealth provided other than in patient's home
  -- 10 = Telehealth provided in patient's home
  RETURN (appt_location_info->>'placeOfService') IN ('02', '10')
         OR (appt_location_info->>'locationType') = 'telehealth';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION is_telehealth_appointment IS
  'Determines if an appointment is telehealth based on place of service code or location type';

-- Example queries:

-- Get all telehealth appointments
-- SELECT * FROM appointments WHERE is_telehealth_appointment(location_info);

-- Get appointments with meeting URLs
-- SELECT id, start_time, meeting_url FROM appointments WHERE meeting_url IS NOT NULL;

-- Get appointments by location
-- SELECT * FROM appointments WHERE location_info->>'locationId' = '4';

-- Verification query
SELECT
  'Migration 023 complete' AS status,
  COUNT(*) FILTER (WHERE meeting_url IS NOT NULL) AS appointments_with_meeting_url,
  COUNT(*) FILTER (WHERE location_info IS NOT NULL AND location_info != '{}'::jsonb) AS appointments_with_location_info,
  COUNT(*) AS total_appointments
FROM appointments;
