/**
 * Migration 022: Create Sync Logs Table
 *
 * Purpose:
 * - Track all automated and manual PracticeQ sync operations
 * - Monitor sync performance and errors
 * - Provide audit trail for sync activity
 * - Enable admin dashboard for sync monitoring
 */

-- Create sync_logs table
CREATE TABLE IF NOT EXISTS sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Sync type: 'manual_patient', 'manual_org_bulk', 'automated_daily', 'webhook'
  sync_type VARCHAR(50) NOT NULL CHECK (sync_type IN ('manual_patient', 'manual_org_bulk', 'automated_daily', 'webhook')),

  -- Context
  organization_id UUID REFERENCES organizations(id),
  patient_id UUID REFERENCES patients(id),
  triggered_by_user_id UUID, -- Can be partner_user, app_user, or null for automated

  -- Timing
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INT, -- Calculated: completed_at - started_at in milliseconds

  -- Status
  status VARCHAR(20) NOT NULL CHECK (status IN ('in_progress', 'completed', 'failed', 'partial_success')),

  -- Results summary
  appointments_new INT DEFAULT 0,
  appointments_updated INT DEFAULT 0,
  appointments_unchanged INT DEFAULT 0,
  appointments_errors INT DEFAULT 0,
  patients_processed INT DEFAULT 0, -- For bulk syncs
  patients_failed INT DEFAULT 0, -- For bulk syncs

  -- Error details
  error_message TEXT,
  error_stack TEXT,

  -- Metadata (JSONB for flexible storage)
  metadata JSONB DEFAULT '{}'::jsonb,
  /* Example metadata:
    {
      "date_range": {"startDate": "2025-07-01", "endDate": "2026-01-31"},
      "warnings": ["Unknown practitioner abc123"],
      "patient_names": ["Austin Schneider", "Bryan Belveal"],
      "intakeq_api_calls": 12,
      "rate_limit_hit": false
    }
  */

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX idx_sync_logs_org ON sync_logs(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX idx_sync_logs_patient ON sync_logs(patient_id) WHERE patient_id IS NOT NULL;
CREATE INDEX idx_sync_logs_started_at ON sync_logs(started_at DESC);
CREATE INDEX idx_sync_logs_status ON sync_logs(status);
CREATE INDEX idx_sync_logs_sync_type ON sync_logs(sync_type);
CREATE INDEX idx_sync_logs_triggered_by ON sync_logs(triggered_by_user_id) WHERE triggered_by_user_id IS NOT NULL;

-- Composite index for common queries
CREATE INDEX idx_sync_logs_org_started ON sync_logs(organization_id, started_at DESC) WHERE organization_id IS NOT NULL;

-- Comments for documentation
COMMENT ON TABLE sync_logs IS 'Audit trail and monitoring for PracticeQ appointment sync operations';
COMMENT ON COLUMN sync_logs.sync_type IS 'Type of sync: manual_patient (single patient), manual_org_bulk (all org patients), automated_daily (cron), webhook (IntakeQ webhook)';
COMMENT ON COLUMN sync_logs.status IS 'Sync status: in_progress (running), completed (success), failed (error), partial_success (some patients failed)';
COMMENT ON COLUMN sync_logs.duration_ms IS 'Sync duration in milliseconds, calculated on completion';
COMMENT ON COLUMN sync_logs.metadata IS 'Flexible JSONB storage for sync details, warnings, API call counts, etc.';

-- Function to calculate duration on completion
CREATE OR REPLACE FUNCTION update_sync_log_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL THEN
    NEW.duration_ms = EXTRACT(EPOCH FROM (NEW.completed_at - NEW.started_at))::INT * 1000;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate duration
CREATE TRIGGER trg_sync_log_duration
  BEFORE UPDATE ON sync_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_sync_log_duration();

-- View for recent sync activity (useful for admin dashboard)
CREATE OR REPLACE VIEW v_recent_sync_activity AS
SELECT
  sl.id,
  sl.sync_type,
  sl.status,
  sl.started_at,
  sl.completed_at,
  sl.duration_ms,
  sl.appointments_new,
  sl.appointments_updated,
  sl.appointments_unchanged,
  sl.appointments_errors,
  sl.patients_processed,
  sl.patients_failed,
  sl.error_message,

  -- Organization info
  o.id AS organization_id,
  o.name AS organization_name,

  -- Patient info
  p.id AS patient_id,
  p.first_name AS patient_first_name,
  p.last_name AS patient_last_name,

  -- Triggered by (try partner_users first, then app_users)
  COALESCE(pu.full_name, au.email) AS triggered_by_name,

  sl.created_at
FROM sync_logs sl
LEFT JOIN organizations o ON sl.organization_id = o.id
LEFT JOIN patients p ON sl.patient_id = p.id
LEFT JOIN partner_users pu ON sl.triggered_by_user_id = pu.id
LEFT JOIN app_users au ON sl.triggered_by_user_id = au.id
ORDER BY sl.started_at DESC
LIMIT 100;

COMMENT ON VIEW v_recent_sync_activity IS 'Recent 100 sync operations with enriched organization, patient, and user information';

-- Grant permissions (adjust based on your RLS policies)
-- GRANT SELECT ON sync_logs TO authenticated;
-- GRANT INSERT, UPDATE ON sync_logs TO authenticated;
-- GRANT SELECT ON v_recent_sync_activity TO authenticated;

-- Verification query
SELECT
  'sync_logs table created' AS status,
  COUNT(*) AS initial_row_count
FROM sync_logs;
