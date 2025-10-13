-- V2.0 SQL Query Shortcuts
-- Useful queries for monitoring and debugging the enhanced booking system

-- =============================================================================
-- 1. TODAY'S BOOKINGS WITH INTAKEQ STATUS
-- =============================================================================
-- Shows all bookings created today with their IntakeQ sync status
SELECT
    a.id AS appointment_id,
    a.pq_appointment_id,
    a.patient_id,
    p.first_name || ' ' || p.last_name AS patient_name,
    p.email AS patient_email,
    p.intakeq_client_id,
    pr.first_name || ' ' || pr.last_name AS provider_name,
    (a.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Denver')::timestamp AS created_local,
    (a.start_time AT TIME ZONE 'UTC' AT TIME ZONE 'America/Denver')::timestamp AS start_local,
    a.status,
    CASE
        WHEN a.pq_appointment_id IS NOT NULL THEN 'synced'
        WHEN a.notes LIKE '%IntakeQ sync failed%' THEN 'failed'
        ELSE 'pending'
    END AS intakeq_status
FROM appointments a
JOIN patients p ON p.id = a.patient_id
JOIN providers pr ON pr.id = a.provider_id
WHERE (a.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Denver')::date = CURRENT_DATE
ORDER BY a.created_at DESC;

-- =============================================================================
-- 2. SEARCH BY PATIENT EMAIL
-- =============================================================================
-- Find appointments and IntakeQ status by patient email
-- Replace 'patient@example.com' with actual email
SELECT
    a.id AS appointment_id,
    a.pq_appointment_id,
    p.id AS patient_id,
    p.first_name || ' ' || p.last_name AS patient_name,
    p.email,
    p.phone,
    p.date_of_birth,
    p.intakeq_client_id,
    (a.start_time AT TIME ZONE 'UTC' AT TIME ZONE 'America/Denver')::timestamp AS appointment_time,
    pr.first_name || ' ' || pr.last_name AS provider_name
FROM appointments a
JOIN patients p ON p.id = a.patient_id
JOIN providers pr ON pr.id = a.provider_id
WHERE p.email ILIKE '%patient@example.com%'
ORDER BY a.created_at DESC
LIMIT 50;

-- =============================================================================
-- 3. AUDIT TRAIL FOR SPECIFIC APPOINTMENT
-- =============================================================================
-- Shows all IntakeQ sync operations for an appointment
-- Replace 'appointment-uuid' with actual appointment ID
SELECT
    created_at,
    action,
    status,
    appointment_id,
    intakeq_client_id,
    intakeq_appointment_id,
    LEFT(COALESCE(error, ''), 200) AS error_short,
    enrichment_data->>'enrichedFields' AS enriched_fields,
    duration_ms
FROM intakeq_sync_audit
WHERE appointment_id = 'appointment-uuid'
ORDER BY created_at;

-- =============================================================================
-- 4. V2.0 ENRICHMENT STATUS
-- =============================================================================
-- Shows enrichment success rate for today's bookings
WITH enrichment_stats AS (
    SELECT
        COUNT(*) AS total_syncs,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS successful_syncs,
        SUM(CASE WHEN action = 'enrichment_applied' THEN 1 ELSE 0 END) AS enrichments_applied,
        SUM(CASE WHEN status = 'duplicate_detected' THEN 1 ELSE 0 END) AS duplicates_detected,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_syncs,
        AVG(duration_ms) AS avg_duration_ms
    FROM intakeq_sync_audit
    WHERE created_at >= CURRENT_DATE
)
SELECT
    total_syncs,
    successful_syncs,
    enrichments_applied,
    duplicates_detected,
    failed_syncs,
    ROUND((successful_syncs::numeric / NULLIF(total_syncs, 0) * 100), 2) AS success_rate,
    ROUND(avg_duration_ms::numeric, 2) AS avg_duration_ms
FROM enrichment_stats;

-- =============================================================================
-- 5. DUPLICATE CLIENT DETECTION
-- =============================================================================
-- Find all duplicate client detections in the last 7 days
SELECT
    created_at,
    patient_id,
    intakeq_client_id,
    duplicate_info,
    appointment_id
FROM intakeq_sync_audit
WHERE status = 'duplicate_detected'
  AND created_at >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY created_at DESC;

-- =============================================================================
-- 6. FAILED INTAKEQ SYNCS NEEDING ATTENTION
-- =============================================================================
-- Shows failed syncs in the last 24 hours that need manual intervention
SELECT
    isa.created_at,
    isa.action,
    isa.appointment_id,
    a.start_time,
    p.first_name || ' ' || p.last_name AS patient_name,
    p.email,
    isa.error,
    pr.first_name || ' ' || pr.last_name AS provider_name
FROM intakeq_sync_audit isa
LEFT JOIN appointments a ON a.id = isa.appointment_id
LEFT JOIN patients p ON p.id = isa.patient_id
LEFT JOIN providers pr ON pr.id = a.provider_id
WHERE isa.status = 'failed'
  AND isa.created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
ORDER BY isa.created_at DESC;

-- =============================================================================
-- 7. PAYER INSURANCE MAPPING STATUS
-- =============================================================================
-- Shows which payers have IntakeQ insurance mappings
SELECT
    p.id AS payer_id,
    p.name AS payer_name,
    pem.value AS intakeq_insurance_name,
    COUNT(DISTINCT ppn.provider_id) AS provider_count,
    CASE
        WHEN pem.value IS NOT NULL THEN 'mapped'
        ELSE 'unmapped'
    END AS mapping_status
FROM payers p
LEFT JOIN payer_external_mappings pem ON
    pem.payer_id = p.id
    AND pem.system = 'practiceq'
    AND pem.key_name = 'insurance_company_name'
LEFT JOIN provider_payer_networks ppn ON ppn.payer_id = p.id
GROUP BY p.id, p.name, pem.value
ORDER BY provider_count DESC, p.name;

-- =============================================================================
-- 8. CONTACT/CASE MANAGER USAGE
-- =============================================================================
-- Shows appointments where contact mirroring was used
SELECT
    a.id AS appointment_id,
    p.first_name || ' ' || p.last_name AS patient_name,
    isa.enrichment_data->>'contactNotified' AS contact_notified,
    a.created_at
FROM appointments a
JOIN patients p ON p.id = a.patient_id
JOIN intakeq_sync_audit isa ON isa.appointment_id = a.id
WHERE isa.enrichment_data->>'contactNotified' = 'true'
  AND a.created_at >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY a.created_at DESC;

-- =============================================================================
-- 9. QUESTIONNAIRE SEND STATUS
-- =============================================================================
-- Shows questionnaire sending success/failure rate
SELECT
    DATE(created_at) AS date,
    COUNT(*) FILTER (WHERE action = 'send_questionnaire') AS total_attempts,
    COUNT(*) FILTER (WHERE action = 'send_questionnaire' AND status = 'success') AS successful_sends,
    COUNT(*) FILTER (WHERE action = 'send_questionnaire' AND status = 'failed') AS failed_sends,
    COUNT(*) FILTER (WHERE payload->>'questionnaireName' = 'medicaid') AS medicaid_questionnaires,
    COUNT(*) FILTER (WHERE payload->>'questionnaireName' = 'general') AS general_questionnaires
FROM intakeq_sync_audit
WHERE action = 'send_questionnaire'
  AND created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- =============================================================================
-- 10. IDEMPOTENCY REQUESTS CLEANUP
-- =============================================================================
-- Clean up old idempotency requests (older than 24 hours)
-- Run this periodically to prevent table bloat
DELETE FROM idempotency_requests
WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '24 hours';

-- Count remaining idempotency requests
SELECT
    COUNT(*) AS total_requests,
    COUNT(*) FILTER (WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '1 hour') AS last_hour,
    COUNT(*) FILTER (WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours') AS last_24h
FROM idempotency_requests;

-- =============================================================================
-- 11. V2.0 FEATURE FLAG USAGE
-- =============================================================================
-- Shows how feature flags are being used in production
SELECT
    feature_flags->>'practiceqEnrich' AS enrichment_enabled,
    feature_flags->>'practiceqDuplicateAlerts' AS duplicate_alerts,
    feature_flags->>'intakeHideNonIntakeProviders' AS hide_non_intake,
    feature_flags->>'bookingAutoRefresh' AS auto_refresh,
    COUNT(*) AS sync_count,
    MAX(created_at) AS last_used
FROM intakeq_sync_audit
WHERE feature_flags IS NOT NULL
GROUP BY
    feature_flags->>'practiceqEnrich',
    feature_flags->>'practiceqDuplicateAlerts',
    feature_flags->>'intakeHideNonIntakeProviders',
    feature_flags->>'bookingAutoRefresh'
ORDER BY sync_count DESC;

-- =============================================================================
-- 12. PROVIDER BOOKING VOLUME
-- =============================================================================
-- Shows booking volume by provider for the current month
SELECT
    pr.id AS provider_id,
    pr.first_name || ' ' || pr.last_name AS provider_name,
    COUNT(*) AS total_bookings,
    COUNT(a.pq_appointment_id) AS intakeq_synced,
    COUNT(*) - COUNT(a.pq_appointment_id) AS pending_sync,
    MIN(a.start_time) AS first_appointment,
    MAX(a.start_time) AS last_appointment
FROM appointments a
JOIN providers pr ON pr.id = a.provider_id
WHERE DATE_TRUNC('month', a.created_at) = DATE_TRUNC('month', CURRENT_DATE)
GROUP BY pr.id, pr.first_name, pr.last_name
ORDER BY total_bookings DESC;