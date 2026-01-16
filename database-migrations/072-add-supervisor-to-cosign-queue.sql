-- =====================================================
-- Migration 072: Add Supervisor Tracking to Co-Sign Queue
-- Created: 2026-01-15
-- Purpose: Route notes to specific supervising attendings
-- =====================================================

-- Add supervisor tracking columns
ALTER TABLE cosign_queue
ADD COLUMN IF NOT EXISTS supervisor_provider_id UUID REFERENCES providers(id),
ADD COLUMN IF NOT EXISTS supervisor_name VARCHAR,
ADD COLUMN IF NOT EXISTS appointment_note TEXT;

-- Index for filtering by supervisor
CREATE INDEX IF NOT EXISTS idx_cosign_queue_supervisor
ON cosign_queue(supervisor_provider_id);

COMMENT ON COLUMN cosign_queue.supervisor_provider_id IS 'Provider ID of the supervising attending assigned to co-sign';
COMMENT ON COLUMN cosign_queue.supervisor_name IS 'Parsed supervisor name from appointment note (e.g., "Roller")';
COMMENT ON COLUMN cosign_queue.appointment_note IS 'Raw note field from IntakeQ appointment';

-- Verification
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cosign_queue' AND column_name = 'supervisor_provider_id'
  ) THEN
    RAISE NOTICE '✅ Migration 072 complete: supervisor columns added to cosign_queue';
  ELSE
    RAISE EXCEPTION 'Migration 072 failed: supervisor_provider_id column not found';
  END IF;
END $$;
