-- ============================================================================
-- Migration 020: Add Organization and Case Manager Data to Activity View
-- Created: 2025-10-21
-- Description: Enhance v_patient_activity_summary with org and case manager info
--
-- Purpose:
-- - Support admin view: all patients with organization column
-- - Support provider view: assigned patients with case manager column
-- - Enable sorting/filtering by organization and case manager
-- ============================================================================

-- Drop existing view
DROP MATERIALIZED VIEW IF EXISTS v_patient_activity_summary CASCADE;

-- Recreate with additional fields
CREATE MATERIALIZED VIEW public.v_patient_activity_summary AS
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
        'org_name', o.name,
        'affiliation_type', affiliation_type,
        'consent_on_file', consent_on_file,
        'consent_expires_on', consent_expires_on,
        'primary_contact_user_id', primary_contact_user_id
      )
    ) as affiliation_details
  FROM patient_organization_affiliations poa
  LEFT JOIN organizations o ON o.id = poa.organization_id
  WHERE poa.status = 'active'
  GROUP BY patient_id
),
primary_case_manager AS (
  -- Primary case manager assigned to patient (across all orgs)
  SELECT DISTINCT ON (patient_id)
    patient_id,
    partner_user_id as primary_case_manager_id,
    organization_id as case_manager_org_id
  FROM partner_user_patient_assignments
  WHERE status = 'active'
    AND assignment_type = 'primary'
  ORDER BY patient_id, assigned_date DESC
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

  -- Provider assignment
  p.primary_provider_id,
  prov.first_name as provider_first_name,
  prov.last_name as provider_last_name,

  -- Organization affiliations
  COALESCE(po.shared_with_org_ids, ARRAY[]::uuid[]) as shared_with_org_ids,
  po.affiliation_details,

  -- Case manager assignment
  pcm.primary_case_manager_id,
  pcm.case_manager_org_id,
  pu.full_name as case_manager_name,
  pu.email as case_manager_email,

  -- Metadata
  p.created_at as patient_created_at,
  p.updated_at as patient_updated_at

FROM patients p
LEFT JOIN patient_engagement_status pes ON pes.patient_id = p.id
LEFT JOIN last_seen ls ON ls.patient_id = p.id
LEFT JOIN next_appointment na ON na.patient_id = p.id
LEFT JOIN patient_orgs po ON po.patient_id = p.id
LEFT JOIN primary_case_manager pcm ON pcm.patient_id = p.id
LEFT JOIN partner_users pu ON pu.id = pcm.primary_case_manager_id
LEFT JOIN providers prov ON prov.id = p.primary_provider_id;

-- Create indexes on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_vpas_patient_id ON v_patient_activity_summary(patient_id);
CREATE INDEX IF NOT EXISTS idx_vpas_engagement_status ON v_patient_activity_summary(engagement_status);
CREATE INDEX IF NOT EXISTS idx_vpas_has_future_appt ON v_patient_activity_summary(has_future_appointment);
CREATE INDEX IF NOT EXISTS idx_vpas_last_seen ON v_patient_activity_summary(last_seen_date DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_vpas_next_appt ON v_patient_activity_summary(next_appointment_date ASC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_vpas_days_since_seen ON v_patient_activity_summary(days_since_last_seen DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_vpas_provider ON v_patient_activity_summary(primary_provider_id) WHERE primary_provider_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vpas_case_manager ON v_patient_activity_summary(primary_case_manager_id) WHERE primary_case_manager_id IS NOT NULL;

-- GIN index for organization array searches
CREATE INDEX IF NOT EXISTS idx_vpas_shared_orgs ON v_patient_activity_summary USING GIN(shared_with_org_ids);

COMMENT ON MATERIALIZED VIEW v_patient_activity_summary IS
  'Fast dashboard view with engagement status, appointment data, provider assignment, organization affiliations, and case manager info. Refresh with REFRESH MATERIALIZED VIEW CONCURRENTLY.';

-- Refresh the view
REFRESH MATERIALIZED VIEW v_patient_activity_summary;

-- Grant permissions
GRANT SELECT ON v_patient_activity_summary TO authenticated;
GRANT SELECT ON v_patient_activity_summary TO anon;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

SELECT
  'Migration 020: Enhanced Activity View - COMPLETE' as status,
  (SELECT COUNT(*) FROM v_patient_activity_summary) as total_patients,
  (SELECT COUNT(*) FROM v_patient_activity_summary WHERE primary_provider_id IS NOT NULL) as patients_with_provider,
  (SELECT COUNT(*) FROM v_patient_activity_summary WHERE primary_case_manager_id IS NOT NULL) as patients_with_case_manager,
  (SELECT COUNT(*) FROM v_patient_activity_summary WHERE array_length(shared_with_org_ids, 1) > 0) as patients_with_org_affiliation;
