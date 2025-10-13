-- V2.0 Final Verification Script
-- Run this after implementing the five final fixes
-- Expected results: All checks should show successful completions

-- ============================================================================
-- CHECK 1: Questionnaire sending audit trail
-- ============================================================================
-- Should show successful send_questionnaire actions for recent bookings
-- Expected: 2+ success entries (one Medicaid, one non-Medicaid)

SELECT
  action,
  status,
  created_at,
  enrichment_data->>'questionnaireId' as questionnaire_id,
  enrichment_data->>'questionnaireName' as questionnaire_name,
  payload->>'clientEmail' as client_email,
  error_message
FROM intakeq_sync_audit
WHERE action = 'send_questionnaire'
ORDER BY created_at DESC
LIMIT 10;

-- Expected output:
-- - status='success' for recent bookings
-- - questionnaire_name = 'medicaid' or 'general' based on payer
-- - no error_message for successful sends

-- ============================================================================
-- CHECK 2: DOB persistence in IntakeQ
-- ============================================================================
-- Verify patients with DOB have it synced to IntakeQ
-- Note: This is a DB-side check; manual IntakeQ verification also needed

SELECT
  p.id,
  p.first_name,
  p.last_name,
  p.date_of_birth,
  p.intakeq_client_id,
  CASE
    WHEN audit.enrichment_data->'enrichedFields' @> '["DateOfBirth"]'::jsonb
    THEN 'DOB_SENT_TO_INTAKEQ'
    ELSE 'DOB_NOT_ENRICHED'
  END as dob_sync_status
FROM patients p
LEFT JOIN intakeq_sync_audit audit ON
  audit.intakeq_client_id = p.intakeq_client_id
  AND audit.action IN ('create_client', 'update_client')
WHERE p.date_of_birth IS NOT NULL
  AND p.created_at > NOW() - INTERVAL '7 days'
ORDER BY p.created_at DESC
LIMIT 10;

-- Expected output:
-- - dob_sync_status = 'DOB_SENT_TO_INTAKEQ' for all recent patients with DOB
-- - intakeq_client_id should be populated

-- ============================================================================
-- CHECK 3: Address removal verification
-- ============================================================================
-- Verify no address data is being sent to IntakeQ in recent bookings
-- Check audit logs to ensure address field is NOT in payloads

SELECT
  action,
  created_at,
  payload->>'FirstName' as first_name,
  payload->>'LastName' as last_name,
  payload->>'Address' as address_field,
  CASE
    WHEN payload ? 'Address' THEN 'ADDRESS_STILL_SENT'
    ELSE 'ADDRESS_REMOVED_OK'
  END as address_status
FROM intakeq_sync_audit
WHERE action IN ('create_client', 'update_client')
  AND created_at > NOW() - INTERVAL '1 day'
ORDER BY created_at DESC
LIMIT 10;

-- Expected output:
-- - address_status = 'ADDRESS_REMOVED_OK' for all entries
-- - address_field should be NULL

-- ============================================================================
-- CHECK 4: Primary payer persistence
-- ============================================================================
-- Verify primary_payer_id is being set for new patients

SELECT
  p.id,
  p.first_name,
  p.last_name,
  p.email,
  p.primary_payer_id,
  py.name as primary_payer_name,
  a.payer_id as appointment_payer_id,
  pa.name as appointment_payer_name,
  p.created_at,
  CASE
    WHEN p.primary_payer_id IS NOT NULL THEN 'PRIMARY_PAYER_SET'
    ELSE 'PRIMARY_PAYER_MISSING'
  END as payer_status
FROM patients p
LEFT JOIN payers py ON py.id = p.primary_payer_id
LEFT JOIN appointments a ON a.patient_id = p.id
LEFT JOIN payers pa ON pa.id = a.payer_id
WHERE p.created_at > NOW() - INTERVAL '7 days'
ORDER BY p.created_at DESC
LIMIT 10;

-- Expected output:
-- - payer_status = 'PRIMARY_PAYER_SET' for all recent patients
-- - primary_payer_name should match the payer selected at booking
-- - appointment_payer_id should equal primary_payer_id for first booking

-- ============================================================================
-- CHECK 5: IntakeQ insurance enrichment
-- ============================================================================
-- Verify insurance company name is being sent to IntakeQ

SELECT
  action,
  created_at,
  intakeq_client_id,
  payload->>'FirstName' as first_name,
  payload->>'LastName' as last_name,
  payload->>'PrimaryInsuranceCompanyName' as insurance_company,
  payload->>'PrimaryMemberID' as member_id,
  enrichment_data->'enrichedFields' as enriched_fields,
  CASE
    WHEN payload->>'PrimaryInsuranceCompanyName' IS NOT NULL
    THEN 'INSURANCE_SENT'
    ELSE 'INSURANCE_MISSING'
  END as insurance_status
FROM intakeq_sync_audit
WHERE action IN ('create_client', 'update_client')
  AND created_at > NOW() - INTERVAL '1 day'
ORDER BY created_at DESC
LIMIT 10;

-- Expected output:
-- - insurance_status = 'INSURANCE_SENT' for bookings with payer
-- - enriched_fields should include 'PrimaryInsuranceName'
-- - insurance_company should be populated with mapped payer name

-- ============================================================================
-- SUMMARY METRICS: Overall V2.0 health check
-- ============================================================================

SELECT
  'Total recent bookings (7d)' as metric,
  COUNT(*) as count
FROM appointments
WHERE created_at > NOW() - INTERVAL '7 days'

UNION ALL

SELECT
  'Questionnaires sent successfully (7d)' as metric,
  COUNT(*) as count
FROM intakeq_sync_audit
WHERE action = 'send_questionnaire'
  AND status = 'success'
  AND created_at > NOW() - INTERVAL '7 days'

UNION ALL

SELECT
  'Patients with primary_payer_id (7d)' as metric,
  COUNT(*) as count
FROM patients
WHERE primary_payer_id IS NOT NULL
  AND created_at > NOW() - INTERVAL '7 days'

UNION ALL

SELECT
  'IntakeQ clients with DOB enriched (7d)' as metric,
  COUNT(*) as count
FROM intakeq_sync_audit
WHERE action IN ('create_client', 'update_client')
  AND enrichment_data->'enrichedFields' @> '["DateOfBirth"]'::jsonb
  AND created_at > NOW() - INTERVAL '7 days'

UNION ALL

SELECT
  'IntakeQ clients with insurance enriched (7d)' as metric,
  COUNT(*) as count
FROM intakeq_sync_audit
WHERE action IN ('create_client', 'update_client')
  AND payload->>'PrimaryInsuranceCompanyName' IS NOT NULL
  AND created_at > NOW() - INTERVAL '7 days'

ORDER BY metric;

-- ============================================================================
-- TROUBLESHOOTING: Failed operations in last 24 hours
-- ============================================================================

SELECT
  action,
  status,
  created_at,
  appointment_id,
  intakeq_client_id,
  error_message,
  payload->>'FirstName' as first_name,
  payload->>'LastName' as last_name
FROM intakeq_sync_audit
WHERE status = 'failed'
  AND created_at > NOW() - INTERVAL '1 day'
ORDER BY created_at DESC
LIMIT 20;

-- Expected output:
-- - Ideally empty (no failures)
-- - If present, review error_message for patterns
