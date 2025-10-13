-- V2.0 Booking Verification Queries
-- Run after applying migration 011

-- 1. Verify audit actions include new types
SELECT DISTINCT action
FROM intakeq_sync_audit
WHERE action IN ('send_questionnaire', 'mirror_contact_email', 'telehealth_fallback')
ORDER BY action;

-- 2. Verify appointment linkage and enrichment
SELECT
  a.id AS appointment_id,
  a.patient_id,
  a.pq_appointment_id,
  a.telehealth_join_url,
  p.email,
  p.phone,
  p.date_of_birth,
  p.status AS patient_status
FROM appointments a
JOIN patients p ON p.id = a.patient_id
WHERE a.created_at >= NOW() - INTERVAL '24 hours'
ORDER BY a.created_at DESC
LIMIT 5;

-- 3. Check audit trail for recent bookings
SELECT
  created_at AT TIME ZONE 'America/Denver' AS created_local,
  action,
  status,
  intakeq_client_id,
  intakeq_appointment_id,
  CASE
    WHEN enrichment_data IS NOT NULL
    THEN jsonb_array_length(enrichment_data->'enrichedFields')
    ELSE 0
  END AS enriched_field_count,
  LEFT(COALESCE(error, ''), 100) AS error_short
FROM intakeq_sync_audit
WHERE created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 20;

-- 4. Verify PHI redaction in audit logs
SELECT
  action,
  payload->>'firstName' AS first_name_should_be_redacted,
  payload->>'email' AS email_should_be_redacted,
  payload->>'phone' AS phone_should_be_redacted,
  response->>'firstName' AS response_first_name_redacted
FROM intakeq_sync_audit
WHERE action = 'create_client'
  AND created_at >= NOW() - INTERVAL '7 days'
LIMIT 5;

-- 5. Check questionnaire sending
SELECT
  created_at AT TIME ZONE 'America/Denver' AS sent_at,
  status,
  payload->>'questionnaireName' AS questionnaire_type,
  response->>'questionnaireId' AS questionnaire_id,
  appointment_id
FROM intakeq_sync_audit
WHERE action = 'send_questionnaire'
  AND created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;

-- 6. Check contact mirroring
SELECT
  created_at AT TIME ZONE 'America/Denver' AS mirrored_at,
  status,
  payload->>'contactEmail' AS contact_email,
  appointment_id
FROM intakeq_sync_audit
WHERE action = 'mirror_contact_email'
  AND created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;

-- 7. Check for duplicate detections
SELECT
  created_at AT TIME ZONE 'America/Denver' AS detected_at,
  patient_id,
  intakeq_client_id,
  duplicate_info
FROM intakeq_sync_audit
WHERE status = 'duplicate_detected'
  OR action = 'duplicate_detected'
ORDER BY created_at DESC
LIMIT 10;

-- 8. Verify patient upsert working (check for recent updates)
SELECT
  id,
  email,
  phone,
  date_of_birth,
  created_at,
  updated_at,
  CASE
    WHEN updated_at > created_at THEN 'updated'
    ELSE 'new'
  END AS record_type
FROM patients
WHERE created_at >= NOW() - INTERVAL '24 hours'
   OR updated_at >= NOW() - INTERVAL '24 hours'
ORDER BY GREATEST(created_at, updated_at) DESC
LIMIT 10;

-- 9. Summary stats for today
WITH today_stats AS (
  SELECT
    COUNT(*) AS total_bookings,
    COUNT(pq_appointment_id) AS synced_to_intakeq,
    COUNT(*) FILTER (WHERE telehealth_join_url IS NOT NULL) AS has_telehealth_link
  FROM appointments
  WHERE (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Denver')::date = CURRENT_DATE
),
audit_stats AS (
  SELECT
    COUNT(*) FILTER (WHERE action = 'create_client') AS clients_created,
    COUNT(*) FILTER (WHERE action = 'send_questionnaire') AS questionnaires_sent,
    COUNT(*) FILTER (WHERE action = 'mirror_contact_email') AS contacts_mirrored,
    COUNT(*) FILTER (WHERE status = 'failed') AS failed_operations
  FROM intakeq_sync_audit
  WHERE (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Denver')::date = CURRENT_DATE
)
SELECT
  t.total_bookings,
  t.synced_to_intakeq,
  t.has_telehealth_link,
  a.clients_created,
  a.questionnaires_sent,
  a.contacts_mirrored,
  a.failed_operations
FROM today_stats t, audit_stats a;