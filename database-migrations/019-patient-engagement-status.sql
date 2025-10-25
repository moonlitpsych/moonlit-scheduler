-- ============================================================================
-- Migration 019: Patient Engagement Status System
-- Created: 2025-10-21
-- Description: Global patient engagement status tracking with audit history
--
-- Purpose:
-- - Track patient engagement state separate from scheduling data
-- - Surface factual appointment data (last seen, next appointment)
-- - Enable filtering by engagement status without implying clinical cadence
-- - Provide audit trail for all status changes
-- - Support case manager workflows for active patient identification
--
-- Design Principles:
-- - Time alone never changes global status (manual changes only)
-- - Factual data: "last seen" and "next appointment" are derived, not prescribed
-- - Terminal states: discharged, transferred, deceased, inactive (require manual change)
-- - Default state: "active" (patients remain active until explicitly changed)
-- ============================================================================

-- ============================================================================
-- 1. CREATE patient_engagement_status TABLE
-- ============================================================================
-- Global source of truth for patient engagement state

CREATE TABLE IF NOT EXISTS public.patient_engagement_status (
  id uuid NOT NULL DEFAULT gen_random_uuid(),

  -- Patient link
  patient_id uuid NOT NULL UNIQUE REFERENCES patients(id) ON DELETE CASCADE,

  -- Engagement state (manual changes only, never auto-changes)
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'discharged', 'transferred', 'deceased', 'inactive')),

  -- Metadata
  effective_date timestamptz NOT NULL DEFAULT now(),
  changed_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_by_email text NULL,
  change_reason text NULL,
  previous_status text NULL,

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT patient_engagement_status_pkey PRIMARY KEY (id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pes_patient ON patient_engagement_status(patient_id);
CREATE INDEX IF NOT EXISTS idx_pes_status ON patient_engagement_status(status);
CREATE INDEX IF NOT EXISTS idx_pes_changed_by ON patient_engagement_status(changed_by) WHERE changed_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pes_effective_date ON patient_engagement_status(effective_date DESC);

-- Comments
COMMENT ON TABLE patient_engagement_status IS 'Global patient engagement status. Never auto-changes based on time - manual updates only.';
COMMENT ON COLUMN patient_engagement_status.status IS 'active: default state. Terminal states (discharged/transferred/deceased/inactive) require manual change by staff.';
COMMENT ON COLUMN patient_engagement_status.effective_date IS 'When this status became effective (not necessarily when it was entered).';
COMMENT ON COLUMN patient_engagement_status.changed_by IS 'User who changed the status (auth.users.id).';
COMMENT ON COLUMN patient_engagement_status.changed_by_email IS 'Email of user who changed status (for audit trail even if user deleted).';

-- ============================================================================
-- 2. CREATE patient_engagement_status_history TABLE
-- ============================================================================
-- Complete audit trail of all status changes

CREATE TABLE IF NOT EXISTS public.patient_engagement_status_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),

  -- Links
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  engagement_status_id uuid NULL REFERENCES patient_engagement_status(id) ON DELETE SET NULL,

  -- Change details
  old_status text NULL,
  new_status text NOT NULL,
  effective_date timestamptz NOT NULL,

  -- Actor
  changed_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_by_email text NULL,
  changed_by_type text NULL CHECK (changed_by_type IN ('admin', 'provider', 'partner_user', 'system')),

  -- Context
  change_reason text NULL,
  notification_sent boolean DEFAULT false,
  notification_sent_at timestamptz NULL,

  -- Timestamp
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT patient_engagement_status_history_pkey PRIMARY KEY (id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pesh_patient_date ON patient_engagement_status_history(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pesh_changed_by ON patient_engagement_status_history(changed_by) WHERE changed_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pesh_new_status ON patient_engagement_status_history(new_status);
CREATE INDEX IF NOT EXISTS idx_pesh_notification_pending ON patient_engagement_status_history(notification_sent, created_at) WHERE notification_sent = false;

COMMENT ON TABLE patient_engagement_status_history IS 'Complete audit trail of all patient engagement status changes.';
COMMENT ON COLUMN patient_engagement_status_history.notification_sent IS 'Whether admin was notified of this status change (for case manager changes).';

-- ============================================================================
-- 3. CREATE TRIGGER: Auto-log status changes to history
-- ============================================================================

CREATE OR REPLACE FUNCTION tg_log_engagement_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if status actually changed
  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  INSERT INTO patient_engagement_status_history (
    patient_id,
    engagement_status_id,
    old_status,
    new_status,
    effective_date,
    changed_by,
    changed_by_email,
    change_reason
  ) VALUES (
    NEW.patient_id,
    NEW.id,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END,
    NEW.status,
    NEW.effective_date,
    NEW.changed_by,
    NEW.changed_by_email,
    NEW.change_reason
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists, then create
DROP TRIGGER IF EXISTS trg_log_engagement_status_change ON patient_engagement_status;

CREATE TRIGGER trg_log_engagement_status_change
  AFTER INSERT OR UPDATE ON patient_engagement_status
  FOR EACH ROW
  EXECUTE FUNCTION tg_log_engagement_status_change();

-- ============================================================================
-- 4. CREATE TRIGGER: Auto-update updated_at timestamp
-- ============================================================================

DROP TRIGGER IF EXISTS trg_pes_updated_at ON patient_engagement_status;

CREATE TRIGGER trg_pes_updated_at
  BEFORE UPDATE ON patient_engagement_status
  FOR EACH ROW
  EXECUTE FUNCTION tg_set_updated_at();

-- ============================================================================
-- 5. CREATE v_patient_activity_summary VIEW
-- ============================================================================
-- Materialized view for fast dashboard queries
-- Combines engagement status with factual appointment data

CREATE MATERIALIZED VIEW IF NOT EXISTS public.v_patient_activity_summary AS
WITH last_seen AS (
  -- Most recent completed/kept appointment per patient
  SELECT DISTINCT ON (patient_id)
    patient_id,
    start_time as last_seen_date,
    provider_id as last_seen_provider_id,
    id as last_appointment_id
  FROM appointments
  WHERE status IN ('completed', 'kept')
  ORDER BY patient_id, start_time DESC
),
next_appointment AS (
  -- Soonest future appointment per patient (exclude cancelled/no-show)
  SELECT DISTINCT ON (patient_id)
    patient_id,
    start_time as next_appointment_date,
    provider_id as next_appointment_provider_id,
    id as next_appointment_id
  FROM appointments
  WHERE start_time > now()
    AND status NOT IN ('cancelled', 'no_show')
  ORDER BY patient_id, start_time ASC
),
patient_orgs AS (
  -- Organizations patient is shared with
  SELECT
    patient_id,
    array_agg(organization_id ORDER BY organization_id) as shared_with_org_ids,
    array_agg(
      jsonb_build_object(
        'org_id', organization_id,
        'affiliation_type', affiliation_type,
        'consent_on_file', consent_on_file,
        'consent_expires_on', consent_expires_on
      )
    ) as affiliation_details
  FROM patient_organization_affiliations
  WHERE status = 'active'
  GROUP BY patient_id
)
SELECT
  p.id as patient_id,
  p.first_name,
  p.last_name,
  p.email,
  p.phone,
  p.date_of_birth,
  p.status as patient_db_status,

  -- Engagement status (defaults to 'active' if not set)
  COALESCE(pes.status, 'active') as engagement_status,
  pes.effective_date as status_effective_date,
  pes.changed_by_email as status_changed_by,
  pes.updated_at as status_last_updated,

  -- Last seen (factual)
  ls.last_seen_date,
  ls.last_seen_provider_id,
  ls.last_appointment_id,
  CASE
    WHEN ls.last_seen_date IS NOT NULL
    THEN EXTRACT(days FROM (now() - ls.last_seen_date))::int
    ELSE NULL
  END as days_since_last_seen,

  -- Next appointment (factual)
  na.next_appointment_date,
  na.next_appointment_provider_id,
  na.next_appointment_id,
  CASE
    WHEN na.next_appointment_date IS NOT NULL
    THEN true
    ELSE false
  END as has_future_appointment,
  CASE
    WHEN na.next_appointment_date IS NOT NULL
    THEN EXTRACT(days FROM (na.next_appointment_date - now()))::int
    ELSE NULL
  END as days_until_next_appointment,

  -- Organization affiliations
  COALESCE(po.shared_with_org_ids, ARRAY[]::uuid[]) as shared_with_org_ids,
  po.affiliation_details,

  -- Metadata
  p.created_at as patient_created_at,
  p.updated_at as patient_updated_at

FROM patients p
LEFT JOIN patient_engagement_status pes ON pes.patient_id = p.id
LEFT JOIN last_seen ls ON ls.patient_id = p.id
LEFT JOIN next_appointment na ON na.patient_id = p.id
LEFT JOIN patient_orgs po ON po.patient_id = p.id;

-- Create indexes on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_vpas_patient_id ON v_patient_activity_summary(patient_id);
CREATE INDEX IF NOT EXISTS idx_vpas_engagement_status ON v_patient_activity_summary(engagement_status);
CREATE INDEX IF NOT EXISTS idx_vpas_has_future_appt ON v_patient_activity_summary(has_future_appointment);
CREATE INDEX IF NOT EXISTS idx_vpas_last_seen ON v_patient_activity_summary(last_seen_date DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_vpas_next_appt ON v_patient_activity_summary(next_appointment_date ASC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_vpas_days_since_seen ON v_patient_activity_summary(days_since_last_seen DESC NULLS LAST);

-- GIN index for organization array searches
CREATE INDEX IF NOT EXISTS idx_vpas_shared_orgs ON v_patient_activity_summary USING GIN(shared_with_org_ids);

COMMENT ON MATERIALIZED VIEW v_patient_activity_summary IS
  'Fast dashboard view combining engagement status with factual appointment data. Refresh periodically with REFRESH MATERIALIZED VIEW CONCURRENTLY.';

-- ============================================================================
-- 6. CREATE FUNCTION: Refresh materialized view
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_patient_activity_summary()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY v_patient_activity_summary;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION refresh_patient_activity_summary IS
  'Refreshes v_patient_activity_summary materialized view. Call after appointment or status changes.';

-- ============================================================================
-- 7. MIGRATE EXISTING DATA: Set all patients to 'active' status
-- ============================================================================
-- Initialize engagement status for all existing patients

INSERT INTO patient_engagement_status (patient_id, status, effective_date, changed_by_email, change_reason)
SELECT
  id,
  'active',
  COALESCE(created_at, now()),
  'system@trymoonlit.com',
  'Initial migration: all patients default to active status'
FROM patients
WHERE NOT EXISTS (
  SELECT 1 FROM patient_engagement_status pes WHERE pes.patient_id = patients.id
)
ON CONFLICT (patient_id) DO NOTHING;

-- ============================================================================
-- 8. INITIAL VIEW REFRESH
-- ============================================================================

REFRESH MATERIALIZED VIEW v_patient_activity_summary;

-- ============================================================================
-- 9. GRANT PERMISSIONS
-- ============================================================================
-- Allow service role and authenticated users to access these tables

-- patient_engagement_status
GRANT SELECT, INSERT, UPDATE ON patient_engagement_status TO authenticated;
GRANT SELECT ON patient_engagement_status TO anon;

-- patient_engagement_status_history
GRANT SELECT, INSERT ON patient_engagement_status_history TO authenticated;
GRANT SELECT ON patient_engagement_status_history TO anon;

-- Materialized view
GRANT SELECT ON v_patient_activity_summary TO authenticated;
GRANT SELECT ON v_patient_activity_summary TO anon;

-- Refresh function (admin/service role only)
GRANT EXECUTE ON FUNCTION refresh_patient_activity_summary TO authenticated;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

SELECT
  'Migration 019: Patient Engagement Status System - COMPLETE' as status,
  (SELECT COUNT(*) FROM patient_engagement_status) as patients_with_status,
  (SELECT COUNT(*) FROM v_patient_activity_summary) as view_patient_count,
  (SELECT COUNT(*) FROM v_patient_activity_summary WHERE has_future_appointment = true) as patients_with_future_appt,
  (SELECT COUNT(*) FROM v_patient_activity_summary WHERE engagement_status = 'active') as active_patients;
