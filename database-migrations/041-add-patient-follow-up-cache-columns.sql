-- Migration: Add follow-up cache columns to patients table
-- Purpose: Cache follow-up data from IntakeQ notes to avoid real-time API calls
--
-- This enables instant roster loading by storing follow-up data in the database
-- rather than fetching it from IntakeQ on every page load.
--
-- Follow-up data should be populated by a background sync script, not on page load.

-- Add columns to store cached follow-up data
ALTER TABLE patients
ADD COLUMN IF NOT EXISTS last_follow_up_text TEXT,
ADD COLUMN IF NOT EXISTS last_follow_up_note_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_follow_up_synced_at TIMESTAMPTZ;

-- Add comment explaining the columns
COMMENT ON COLUMN patients.last_follow_up_text IS 'Cached follow-up text extracted from most recent locked IntakeQ note';
COMMENT ON COLUMN patients.last_follow_up_note_date IS 'Date of the IntakeQ note the follow-up was extracted from';
COMMENT ON COLUMN patients.last_follow_up_synced_at IS 'When the follow-up data was last synced from IntakeQ';

-- Create index for finding stale follow-up data
CREATE INDEX IF NOT EXISTS idx_patients_follow_up_sync
ON patients (last_follow_up_synced_at)
WHERE practiceq_client_id IS NOT NULL;
