/**
 * Migration 042: Add Follow-Up Cache to Activity View
 * Created: 2025-12-09
 *
 * Purpose:
 * - Add follow-up cache columns to v_patient_activity_summary view
 * - Enable provider/admin rosters to display cached follow-up data
 * - Depends on migration 041 (follow-up cache columns on patients table)
 *
 * Note: This view is a regular VIEW (not materialized) for real-time data
 */

-- Drop existing view to recreate with new columns
DROP VIEW IF EXISTS v_patient_activity_summary CASCADE;

-- Recreate view with follow-up cache fields
CREATE VIEW public.v_patient_activity_summary AS
WITH last_seen AS (
  -- Most recent completed/kept appointment per patient
  SELECT DISTINCT ON (patient_id)
    patient_id,
    start_time as last_seen_date,
    provider_id as last_seen_provider_id,
    id as last_appointment_id,
    status as last_appointment_status
  FROM appointments
  WHERE status IN ('completed', 'kept', 'no_show')
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
  ls.last_appointment_status,
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

  -- Payer information
  p.primary_payer_id,
  payer.name as payer_name,
  payer.payer_type as payer_type,
  payer.state as payer_state,

  -- Organization affiliations
  COALESCE(po.shared_with_org_ids, ARRAY[]::uuid[]) as shared_with_org_ids,
  po.affiliation_details,

  -- Case manager assignment
  pcm.primary_case_manager_id,
  pcm.case_manager_org_id,
  pu.full_name as case_manager_name,
  pu.email as case_manager_email,

  -- PracticeQ/IntakeQ sync tracking
  p.last_intakeq_sync,

  -- Test patient flag
  p.is_test_patient,

  -- Follow-up cache (NEW) - populated by background sync
  p.last_follow_up_text,
  p.last_follow_up_note_date,
  p.last_follow_up_synced_at,

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
LEFT JOIN providers prov ON prov.id = p.primary_provider_id
LEFT JOIN payers payer ON payer.id = p.primary_payer_id;

-- Add comment to view
COMMENT ON VIEW v_patient_activity_summary IS
  'Real-time dashboard view with engagement status, appointment data, provider assignment, organization affiliations, case manager info, payer data, test patient flag, follow-up cache, and PracticeQ sync tracking. Data is always current.';

-- Grant permissions
GRANT SELECT ON v_patient_activity_summary TO authenticated;
GRANT SELECT ON v_patient_activity_summary TO anon;
GRANT SELECT ON v_patient_activity_summary TO service_role;

-- Verify the change
SELECT
  'Migration 042: Add follow-up to activity view - COMPLETE' as status,
  COUNT(*) as total_patients,
  COUNT(*) FILTER (WHERE last_follow_up_text IS NOT NULL) as with_follow_up_data,
  COUNT(*) FILTER (WHERE last_follow_up_text IS NULL) as without_follow_up_data
FROM v_patient_activity_summary;
