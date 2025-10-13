-- Helper Query: Get latest audit rows for a specific appointment
-- Replace 'YOUR_APPOINTMENT_ID' with actual appointment ID

-- Show all audit entries for a specific appointment
WITH appointment_audit AS (
  SELECT
    action,
    status,
    created_at,
    appointment_id,
    intakeq_client_id,
    patient_id,
    enrichment_data->>'identityMatch' as identity_match,
    enrichment_data->>'enrichedFields' as enriched_fields,
    error_message,
    duration_ms,
    payload,
    response
  FROM intakeq_sync_audit
  WHERE appointment_id = 'YOUR_APPOINTMENT_ID'  -- Replace with actual ID
    OR payload->>'appointmentId' = 'YOUR_APPOINTMENT_ID'
  ORDER BY created_at DESC
)
SELECT * FROM appointment_audit;

-- Summary view: Latest status per action type
WITH latest_per_action AS (
  SELECT DISTINCT ON (action)
    action,
    status,
    created_at,
    enrichment_data->>'identityMatch' as identity_match,
    error_message
  FROM intakeq_sync_audit
  WHERE appointment_id = 'YOUR_APPOINTMENT_ID'  -- Replace with actual ID
  ORDER BY action, created_at DESC
)
SELECT * FROM latest_per_action
ORDER BY created_at;

-- Quick check: Did everything succeed for this appointment?
SELECT
  appointment_id,
  COUNT(*) as total_actions,
  COUNT(*) FILTER (WHERE status = 'success') as successful,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  COUNT(*) FILTER (WHERE action = 'send_questionnaire') as questionnaire_attempts,
  COUNT(*) FILTER (WHERE action = 'send_questionnaire' AND status = 'success') as questionnaire_sent
FROM intakeq_sync_audit
WHERE appointment_id = 'YOUR_APPOINTMENT_ID'  -- Replace with actual ID
GROUP BY appointment_id;

-- Helper: Find appointment IDs from recent bookings by patient email
SELECT
  a.id as appointment_id,
  p.email,
  p.first_name,
  p.last_name,
  a.created_at,
  a.pq_appointment_id
FROM appointments a
JOIN patients p ON p.id = a.patient_id
WHERE p.email ILIKE '%YOUR_EMAIL_PATTERN%'  -- Replace with email pattern
  AND a.created_at > NOW() - INTERVAL '24 hours'
ORDER BY a.created_at DESC
LIMIT 10;