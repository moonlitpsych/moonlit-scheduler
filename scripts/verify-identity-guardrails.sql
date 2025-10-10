-- V2.0 Identity Guardrails Verification Script
-- Purpose: Verify that strong matching prevents incorrect patient merging
-- Run after implementing identity guardrails to ensure they work correctly

-- ============================================================================
-- 1. Check for shared canonical emails (potential case manager scenarios)
-- ============================================================================
SELECT
    canonical_email,
    COUNT(DISTINCT id) as patient_count,
    COUNT(DISTINCT intakeq_email_alias) as with_alias_count,
    json_agg(
        json_build_object(
            'patient_id', id,
            'name', first_name || ' ' || last_name,
            'dob', date_of_birth,
            'phone', phone,
            'intakeq_client_id', intakeq_client_id,
            'intakeq_email_alias', intakeq_email_alias,
            'created_at', created_at
        ) ORDER BY created_at
    ) as patients
FROM patients
WHERE canonical_email IS NOT NULL
  OR email IS NOT NULL
GROUP BY COALESCE(canonical_email, email)
HAVING COUNT(DISTINCT id) > 1
ORDER BY patient_count DESC, canonical_email;

-- Expected:
-- - Each shared email should have different patient names/DOBs
-- - Second+ patients should have intakeq_email_alias set
-- - Each should have different intakeq_client_id

-- ============================================================================
-- 2. Audit log verification: Check identity matching in IntakeQ sync logs
-- ============================================================================
SELECT
    created_at,
    action,
    status,
    patient_id,
    intakeq_client_id,
    enrichment_data->>'identityMatch' as identity_match,
    enrichment_data->'emailAliasing'->>'aliasApplied' as alias_applied,
    enrichment_data->'emailAliasing'->>'aliasReason' as alias_reason,
    canonical_email
FROM intakeq_audit
WHERE action IN ('create_client', 'update_client', 'enrichment_applied')
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 50;

-- Expected identityMatch values:
-- - 'strong': Patient matched by email+name+DOB (returning patient)
-- - 'fallback': Patient matched by email+name+phone (DOB missing)
-- - 'none': New patient, no match found
-- - 'no_strong_match_email_collision': New patient with aliased email

-- ============================================================================
-- 3. Verify NO upsert conflicts on email (anti-pattern check)
-- ============================================================================
-- This query checks if any recent inserts could have been upserts
-- If we find duplicates, it means our strong matching failed

WITH recent_patients AS (
    SELECT
        id,
        email,
        first_name,
        last_name,
        date_of_birth,
        phone,
        created_at,
        ROW_NUMBER() OVER (
            PARTITION BY email
            ORDER BY created_at
        ) as email_occurrence
    FROM patients
    WHERE created_at > NOW() - INTERVAL '7 days'
)
SELECT
    email,
    COUNT(*) as occurrence_count,
    json_agg(
        json_build_object(
            'id', id,
            'name', first_name || ' ' || last_name,
            'dob', date_of_birth,
            'phone', phone,
            'created_at', created_at,
            'occurrence', email_occurrence
        ) ORDER BY created_at
    ) as patients
FROM recent_patients
WHERE email_occurrence > 1
GROUP BY email;

-- Expected: EMPTY RESULT
-- If results found: Strong matching failed, investigate ensurePatient logic

-- ============================================================================
-- 4. IntakeQ email alias usage verification
-- ============================================================================
SELECT
    p.id as patient_id,
    p.email as canonical_email,
    p.intakeq_email_alias,
    p.intakeq_client_id,
    p.first_name || ' ' || p.last_name as patient_name,
    p.date_of_birth,
    p.created_at,
    ia.enrichment_data->'emailAliasing'->>'aliasApplied' as audit_alias_applied,
    ia.enrichment_data->'emailAliasing'->>'aliasReason' as audit_alias_reason
FROM patients p
LEFT JOIN LATERAL (
    SELECT enrichment_data
    FROM intakeq_audit
    WHERE patient_id = p.id
      AND action = 'create_client'
      AND status = 'success'
    ORDER BY created_at DESC
    LIMIT 1
) ia ON true
WHERE p.intakeq_email_alias IS NOT NULL
ORDER BY p.created_at DESC;

-- Expected:
-- - intakeq_email_alias format: canonical+{patient_id}@domain.com
-- - audit_alias_applied = true
-- - audit_alias_reason = 'duplicate_in_db' or 'duplicate_in_intakeq'

-- ============================================================================
-- 5. Verify separate IntakeQ clients for shared email scenarios
-- ============================================================================
WITH shared_emails AS (
    SELECT email
    FROM patients
    WHERE email IS NOT NULL
    GROUP BY email
    HAVING COUNT(DISTINCT id) > 1
)
SELECT
    p.email as canonical_email,
    p.id as patient_id,
    p.first_name || ' ' || p.last_name as patient_name,
    p.date_of_birth,
    p.phone,
    p.intakeq_client_id,
    p.intakeq_email_alias,
    p.created_at
FROM patients p
INNER JOIN shared_emails se ON p.email = se.email
ORDER BY p.email, p.created_at;

-- Expected:
-- - Each patient has DIFFERENT intakeq_client_id
-- - First patient: intakeq_email_alias = NULL (uses canonical)
-- - Second+ patients: intakeq_email_alias = canonical+{patient_id}@domain

-- ============================================================================
-- 6. Strong match success rate
-- ============================================================================
SELECT
    enrichment_data->>'identityMatch' as match_type,
    COUNT(*) as count,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM intakeq_audit
WHERE action = 'create_client'
  AND status = 'success'
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY enrichment_data->>'identityMatch'
ORDER BY count DESC;

-- Expected distribution (intake-only scenario):
-- - 'none': High % (new patients)
-- - 'strong': Low % (returning patients matched)
-- - 'no_strong_match_email_collision': Very low % (case manager scenarios)
-- - 'fallback': Rare (only when DOB missing)

-- ============================================================================
-- 7. Verify patient table email normalization
-- ============================================================================
SELECT
    id,
    email,
    first_name,
    last_name,
    CASE
        WHEN email != LOWER(TRIM(email)) THEN 'NOT_NORMALIZED'
        ELSE 'OK'
    END as normalization_status
FROM patients
WHERE email IS NOT NULL
  AND email != LOWER(TRIM(email))
LIMIT 10;

-- Expected: EMPTY RESULT (all emails should be normalized)

-- ============================================================================
-- 8. Acceptance Criteria Summary
-- ============================================================================
-- Run this to get a quick pass/fail summary

SELECT
    'Shared emails have different patient records' as check_name,
    CASE
        WHEN EXISTS (
            SELECT 1 FROM patients
            GROUP BY email
            HAVING COUNT(DISTINCT id) > 1
               AND COUNT(DISTINCT (first_name || last_name || COALESCE(date_of_birth::text, ''))) = 1
        ) THEN '❌ FAIL'
        ELSE '✅ PASS'
    END as status
UNION ALL
SELECT
    'Email collisions have aliases applied',
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM patients p1
            INNER JOIN patients p2 ON p1.email = p2.email AND p1.id != p2.id
            WHERE p2.intakeq_email_alias IS NULL
              AND p2.created_at > p1.created_at
        ) THEN '❌ FAIL'
        ELSE '✅ PASS'
    END
UNION ALL
SELECT
    'Recent audit logs include identityMatch',
    CASE
        WHEN EXISTS (
            SELECT 1 FROM intakeq_audit
            WHERE action = 'create_client'
              AND created_at > NOW() - INTERVAL '1 day'
              AND enrichment_data->>'identityMatch' IS NULL
        ) THEN '❌ FAIL'
        ELSE '✅ PASS'
    END
UNION ALL
SELECT
    'No email normalization issues',
    CASE
        WHEN EXISTS (
            SELECT 1 FROM patients
            WHERE email IS NOT NULL
              AND email != LOWER(TRIM(email))
        ) THEN '❌ FAIL'
        ELSE '✅ PASS'
    END;

-- ============================================================================
-- Notes:
-- - Run after each booking test session
-- - All checks should PASS for V2.0 acceptance
-- - If any FAIL, review ensurePatient and upsertPracticeQClient logic
-- ============================================================================
