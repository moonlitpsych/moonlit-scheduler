-- =====================================================
-- Migration 071: Co-Signature Queue Tables
-- Created: 2026-01-15
-- Purpose: Track clinical notes requiring attending co-signature
-- =====================================================

-- =====================================================
-- PAYER CO-SIGN REQUIREMENTS TABLE
-- =====================================================
-- Maps IntakeQ location names to co-sign requirements
-- Note: In IntakeQ, Location = Payer (by Moonlit configuration)

CREATE TABLE IF NOT EXISTS payer_cosign_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- IntakeQ mapping
  intakeq_location_id VARCHAR,                    -- IntakeQ's internal ID (if available)
  intakeq_location_name VARCHAR NOT NULL UNIQUE,  -- The LocationName from IntakeQ

  -- Business logic
  requires_cosign BOOLEAN NOT NULL DEFAULT true,

  -- Display
  display_name VARCHAR NOT NULL,                  -- Friendly name for UI

  -- Metadata
  notes TEXT,                                     -- Any special instructions
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for lookup by location name (the join key from IntakeQ)
CREATE INDEX IF NOT EXISTS idx_payer_cosign_location
  ON payer_cosign_requirements(intakeq_location_name);

COMMENT ON TABLE payer_cosign_requirements IS 'Maps IntakeQ location names to payer co-signature requirements for supervised appointments';
COMMENT ON COLUMN payer_cosign_requirements.intakeq_location_name IS 'The LocationName field from IntakeQ appointments - used as join key';
COMMENT ON COLUMN payer_cosign_requirements.requires_cosign IS 'Whether notes for this payer require attending co-signature';


-- =====================================================
-- CO-SIGNATURE QUEUE TABLE
-- =====================================================
-- Stores notes awaiting attending co-signature

CREATE TABLE IF NOT EXISTS cosign_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- IntakeQ identifiers (for idempotency and linking)
  note_id VARCHAR NOT NULL UNIQUE,               -- IntakeQ Note ID (unique constraint prevents duplicates)
  appointment_id VARCHAR NOT NULL,               -- IntakeQ Appointment ID (for enrichment)
  client_id INTEGER NOT NULL,                    -- IntakeQ Client ID

  -- Patient info (denormalized for display)
  patient_name VARCHAR NOT NULL,

  -- Payer info (denormalized for filtering)
  payer_location_name VARCHAR NOT NULL,          -- From appointment.LocationName
  payer_display_name VARCHAR NOT NULL,           -- From payer_cosign_requirements.display_name

  -- Provider info (resident who created the note)
  resident_name VARCHAR NOT NULL,
  resident_email VARCHAR,

  -- Note metadata
  note_date TIMESTAMP WITH TIME ZONE NOT NULL,   -- When the note was created
  note_type VARCHAR,                             -- E.g., "Progress Note", "Intake Note"
  service_name VARCHAR,                          -- Service type from appointment

  -- Queue status
  status VARCHAR NOT NULL DEFAULT 'pending'      -- 'pending', 'signed', 'skipped'
    CHECK (status IN ('pending', 'signed', 'skipped')),

  -- Timestamps
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),  -- When added to queue
  signed_at TIMESTAMP WITH TIME ZONE,               -- When marked as signed
  signed_by VARCHAR,                                -- Attending who signed

  -- IntakeQ link (for direct navigation)
  intakeq_note_url VARCHAR GENERATED ALWAYS AS (
    'https://intakeq.com/app/notes/' || note_id
  ) STORED,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_cosign_queue_status
  ON cosign_queue(status);
CREATE INDEX IF NOT EXISTS idx_cosign_queue_payer
  ON cosign_queue(payer_location_name);
CREATE INDEX IF NOT EXISTS idx_cosign_queue_resident
  ON cosign_queue(resident_name);
CREATE INDEX IF NOT EXISTS idx_cosign_queue_date
  ON cosign_queue(note_date DESC);
CREATE INDEX IF NOT EXISTS idx_cosign_queue_pending_date
  ON cosign_queue(status, note_date DESC)
  WHERE status = 'pending';

COMMENT ON TABLE cosign_queue IS 'Queue of clinical notes awaiting attending co-signature';
COMMENT ON COLUMN cosign_queue.note_id IS 'IntakeQ Note ID - unique to prevent duplicate queue entries';
COMMENT ON COLUMN cosign_queue.status IS 'pending = awaiting signature, signed = co-signed, skipped = manually bypassed';
COMMENT ON COLUMN cosign_queue.intakeq_note_url IS 'Auto-generated URL to open note in IntakeQ for signing';


-- =====================================================
-- WEBHOOK AUDIT LOG TABLE
-- =====================================================
-- Tracks all webhook events for debugging

CREATE TABLE IF NOT EXISTS cosign_webhook_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Webhook payload
  webhook_type VARCHAR NOT NULL,                  -- 'Note Locked', etc.
  note_id VARCHAR,
  client_id INTEGER,
  raw_payload JSONB,

  -- Processing result
  action_taken VARCHAR,                           -- 'added_to_queue', 'marked_signed', 'ignored_no_cosign', 'ignored_note_not_found'
  processing_error TEXT,

  -- Metadata
  received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for debugging specific notes
CREATE INDEX IF NOT EXISTS idx_cosign_webhook_note
  ON cosign_webhook_log(note_id);
CREATE INDEX IF NOT EXISTS idx_cosign_webhook_received
  ON cosign_webhook_log(received_at DESC);

COMMENT ON TABLE cosign_webhook_log IS 'Audit trail for IntakeQ note webhook events';


-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE payer_cosign_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE cosign_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE cosign_webhook_log ENABLE ROW LEVEL SECURITY;

-- Service role (webhook handler) can read/write all
CREATE POLICY "Service role full access to payer_cosign_requirements"
  ON payer_cosign_requirements FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to cosign_queue"
  ON cosign_queue FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to cosign_webhook_log"
  ON cosign_webhook_log FOR ALL
  USING (auth.role() = 'service_role');

-- Authenticated admin users can read queue and payer requirements
CREATE POLICY "Authenticated users can view payer_cosign_requirements"
  ON payer_cosign_requirements FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view cosign_queue"
  ON cosign_queue FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update cosign_queue"
  ON cosign_queue FOR UPDATE
  USING (auth.role() = 'authenticated');


-- =====================================================
-- UPDATED_AT TRIGGER
-- =====================================================

CREATE OR REPLACE FUNCTION update_cosign_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_payer_cosign_requirements_updated_at
    BEFORE UPDATE ON payer_cosign_requirements
    FOR EACH ROW
    EXECUTE FUNCTION update_cosign_updated_at();

CREATE TRIGGER update_cosign_queue_updated_at
    BEFORE UPDATE ON cosign_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_cosign_updated_at();


-- =====================================================
-- SEED DATA: PAYER CO-SIGN REQUIREMENTS
-- =====================================================

INSERT INTO payer_cosign_requirements (intakeq_location_name, display_name, requires_cosign, notes)
VALUES
  ('Medicaid', 'Utah Medicaid', true, 'All Medicaid patients require attending supervision'),
  ('HMHI-BHN', 'HMHI-BHN (U of U)', true, 'University of Utah employee plan'),
  ('SelectHealth', 'SelectHealth', true, 'Includes both Medicaid & Commercial'),
  ('SelectHealth Medicaid', 'SelectHealth Medicaid', true, 'Medicaid MCO'),
  ('SelectHealth Commercial', 'SelectHealth Commercial', true, 'Commercial plans'),
  ('DMBA', 'DMBA', true, 'LDS Church employee plan'),
  ('Regence', 'Regence BlueCross', true, 'Commercial'),
  ('Molina', 'Molina Healthcare', true, 'Medicaid MCO'),
  ('Self-Pay', 'Self-Pay', false, 'No co-sign required for self-pay')
ON CONFLICT (intakeq_location_name)
DO UPDATE SET
  display_name = EXCLUDED.display_name,
  requires_cosign = EXCLUDED.requires_cosign,
  notes = EXCLUDED.notes,
  updated_at = NOW();


-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
DECLARE
  table_count INTEGER;
  payer_count INTEGER;
BEGIN
  -- Verify tables created
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_name IN ('payer_cosign_requirements', 'cosign_queue', 'cosign_webhook_log')
    AND table_schema = 'public';

  IF table_count != 3 THEN
    RAISE EXCEPTION 'Expected 3 tables, found %', table_count;
  END IF;

  -- Verify seed data
  SELECT COUNT(*) INTO payer_count FROM payer_cosign_requirements;

  IF payer_count < 9 THEN
    RAISE EXCEPTION 'Expected at least 9 payer records, found %', payer_count;
  END IF;

  RAISE NOTICE '✅ Migration 071 complete: 3 tables created, % payer records seeded', payer_count;
END $$;
