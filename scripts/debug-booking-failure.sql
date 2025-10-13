-- Debug script to check recent booking attempts
-- Run this in Supabase SQL editor

-- 1. Check recent appointments (last hour)
SELECT
    a.id,
    a.patient_id,
    a.provider_id,
    a.payer_id,
    a.pq_appointment_id,
    a.created_at,
    a.appointment_type,
    a.status,
    p.first_name || ' ' || p.last_name as patient_name,
    p.email as patient_email,
    p.primary_payer_id,
    pay.name as payer_name
FROM appointments a
LEFT JOIN patients p ON p.id = a.patient_id
LEFT JOIN payers pay ON pay.id = a.payer_id
WHERE a.created_at > NOW() - INTERVAL '1 hour'
ORDER BY a.created_at DESC
LIMIT 5;

-- 2. Check if provider_payer_networks table exists and its columns
SELECT
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'provider_payer_networks'
ORDER BY ordinal_position;

-- 3. Check services table columns (looking for service_type)
SELECT
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'services'
AND column_name LIKE '%type%'
ORDER BY ordinal_position;

-- 4. Check recent audit logs for the booking
SELECT
    action,
    status,
    created_at,
    appointment_id,
    patient_id,
    error_message,
    enrichment_data->>'identityMatch' as identity_match
FROM intakeq_sync_audit
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 10;

-- 5. Check if patient's primary_payer_id was saved
SELECT
    id,
    email,
    first_name,
    last_name,
    primary_payer_id,
    created_at,
    updated_at
FROM patients
WHERE created_at > NOW() - INTERVAL '1 hour'
   OR updated_at > NOW() - INTERVAL '1 hour'
ORDER BY GREATEST(created_at, updated_at) DESC
LIMIT 5;