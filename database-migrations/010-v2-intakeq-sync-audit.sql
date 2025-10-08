-- Migration: V2.0 IntakeQ Sync Audit Trail
-- Purpose: Log all IntakeQ client/appointment sync operations for debugging and compliance
-- Created: 2025-10-08
-- Feature: PRACTICEQ_ENRICH_ENABLED

-- Create intakeq_sync_audit table
CREATE TABLE IF NOT EXISTS intakeq_sync_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL, -- 'create_client', 'update_client', 'create_appointment', 'duplicate_detected'
    status TEXT NOT NULL, -- 'success', 'failed', 'duplicate_detected', 'blocked'
    patient_id UUID REFERENCES patients(id) ON DELETE SET NULL, -- Link to our patient record
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL, -- Link to our appointment record
    intakeq_client_id TEXT, -- IntakeQ client ID (if created/found)
    intakeq_appointment_id TEXT, -- IntakeQ appointment ID (if created)
    payload JSONB, -- Request payload sent to IntakeQ
    response JSONB, -- Response from IntakeQ API
    error TEXT, -- Error message if failed
    duplicate_info JSONB, -- Info about duplicate detection (if applicable)
    enrichment_data JSONB, -- V2.0 enriched fields (phone, DOB, insurance, etc.)
    feature_flags JSONB, -- Feature flag state at time of sync
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    duration_ms INTEGER, -- How long the API call took

    -- Constraints
    CONSTRAINT valid_action CHECK (action IN (
        'create_client',
        'update_client',
        'create_appointment',
        'duplicate_detected',
        'enrichment_applied'
    )),
    CONSTRAINT valid_status CHECK (status IN (
        'success',
        'failed',
        'duplicate_detected',
        'blocked',
        'retry_needed'
    ))
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_intakeq_sync_audit_patient_id
    ON intakeq_sync_audit(patient_id);

CREATE INDEX IF NOT EXISTS idx_intakeq_sync_audit_appointment_id
    ON intakeq_sync_audit(appointment_id);

CREATE INDEX IF NOT EXISTS idx_intakeq_sync_audit_action_status
    ON intakeq_sync_audit(action, status);

CREATE INDEX IF NOT EXISTS idx_intakeq_sync_audit_created_at
    ON intakeq_sync_audit(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_intakeq_sync_audit_intakeq_client_id
    ON intakeq_sync_audit(intakeq_client_id)
    WHERE intakeq_client_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_intakeq_sync_audit_failures
    ON intakeq_sync_audit(created_at DESC)
    WHERE status = 'failed';

-- Add helpful comments
COMMENT ON TABLE intakeq_sync_audit IS 'V2.0: Audit trail for all IntakeQ synchronization operations';
COMMENT ON COLUMN intakeq_sync_audit.action IS 'Type of sync operation performed';
COMMENT ON COLUMN intakeq_sync_audit.status IS 'Outcome of the sync operation';
COMMENT ON COLUMN intakeq_sync_audit.enrichment_data IS 'V2.0 enriched fields sent to IntakeQ (phone, DOB, insurance, etc.)';
COMMENT ON COLUMN intakeq_sync_audit.duplicate_info IS 'Details when duplicate client is detected';
COMMENT ON COLUMN intakeq_sync_audit.feature_flags IS 'Snapshot of V2.0 feature flag state during sync';

-- Helper function to log sync operations
CREATE OR REPLACE FUNCTION log_intakeq_sync(
    p_action TEXT,
    p_status TEXT,
    p_patient_id UUID DEFAULT NULL,
    p_appointment_id UUID DEFAULT NULL,
    p_intakeq_client_id TEXT DEFAULT NULL,
    p_intakeq_appointment_id TEXT DEFAULT NULL,
    p_payload JSONB DEFAULT NULL,
    p_response JSONB DEFAULT NULL,
    p_error TEXT DEFAULT NULL,
    p_duplicate_info JSONB DEFAULT NULL,
    p_enrichment_data JSONB DEFAULT NULL,
    p_feature_flags JSONB DEFAULT NULL,
    p_duration_ms INTEGER DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_audit_id UUID;
BEGIN
    INSERT INTO intakeq_sync_audit (
        action,
        status,
        patient_id,
        appointment_id,
        intakeq_client_id,
        intakeq_appointment_id,
        payload,
        response,
        error,
        duplicate_info,
        enrichment_data,
        feature_flags,
        duration_ms
    ) VALUES (
        p_action,
        p_status,
        p_patient_id,
        p_appointment_id,
        p_intakeq_client_id,
        p_intakeq_appointment_id,
        p_payload,
        p_response,
        p_error,
        p_duplicate_info,
        p_enrichment_data,
        p_feature_flags,
        p_duration_ms
    ) RETURNING id INTO v_audit_id;

    RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION log_intakeq_sync IS 'Helper function to log IntakeQ sync operations to audit trail';

-- Verification queries
DO $$
BEGIN
    RAISE NOTICE 'IntakeQ sync audit table created successfully';
    RAISE NOTICE 'Use: SELECT * FROM intakeq_sync_audit ORDER BY created_at DESC LIMIT 10;';
    RAISE NOTICE 'Use: SELECT action, status, COUNT(*) FROM intakeq_sync_audit GROUP BY action, status;';
END $$;
