-- Check appointments table schema for patient_info column
SELECT
    column_name,
    is_nullable,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_name = 'appointments'
ORDER BY ordinal_position;

-- Check last 10 appointments for patient_info state
SELECT
    id,
    patient_id,
    provider_id,
    payer_id,
    (patient_info IS NULL) as patient_info_is_null,
    patient_info,
    created_at
FROM appointments
ORDER BY created_at DESC
LIMIT 10;