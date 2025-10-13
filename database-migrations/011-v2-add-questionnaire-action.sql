-- Migration: V2.0 Add send_questionnaire action to audit trail
-- Purpose: Add support for tracking questionnaire sending operations
-- Created: 2025-10-09
-- Depends on: 010-v2-intakeq-sync-audit.sql

BEGIN;

-- Check if constraint needs updating
DO $$
BEGIN
    -- Drop existing constraint if it exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'valid_action'
        AND conrelid = 'intakeq_sync_audit'::regclass
    ) THEN
        ALTER TABLE intakeq_sync_audit DROP CONSTRAINT valid_action;
    END IF;

    -- Add updated constraint with all actions
    ALTER TABLE intakeq_sync_audit
    ADD CONSTRAINT valid_action CHECK (action IN (
        'create_client',
        'update_client',
        'create_appointment',
        'duplicate_detected',
        'enrichment_applied',
        'send_questionnaire',
        'mirror_contact_email',
        'telehealth_fallback',
        'email_failed'
    ));
END $$;

-- Update table comment (idempotent)
COMMENT ON TABLE intakeq_sync_audit IS 'V2.0: Audit trail for all IntakeQ sync operations including questionnaire sending and contact mirroring';

COMMIT;