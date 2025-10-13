-- IntakeQ Insurance Mapping Population Script
-- Generated: October 13, 2025
-- Purpose: Map database payer IDs to IntakeQ insurance company names

-- First, let's see what payers we have in the database
SELECT
    p.id,
    p.name,
    p.is_active,
    pem.value as existing_mapping
FROM payers p
LEFT JOIN payer_external_mappings pem ON
    pem.payer_id = p.id
    AND pem.system = 'practiceq'
    AND pem.key_name = 'insurance_company_name'
WHERE p.is_active = true
ORDER BY p.name;

-- Check recent appointment to see what payer was used
SELECT
    a.id as appointment_id,
    a.created_at,
    a.insurance_info->>'payer_id' as payer_id,
    a.insurance_info->>'payer_name' as payer_name_in_appointment,
    a.insurance_info->>'member_id' as member_id,
    p.name as payer_name_in_db
FROM appointments a
LEFT JOIN payers p ON p.id = (a.insurance_info->>'payer_id')::uuid
WHERE a.created_at > NOW() - INTERVAL '1 day'
ORDER BY a.created_at DESC
LIMIT 5;

-- Now insert the mappings based on IntakeQ's payer list
-- IMPORTANT: You need to update the payer_id values with actual IDs from your database

-- Step 1: Find the correct payer IDs by matching names
WITH payer_lookup AS (
    SELECT
        id,
        name,
        CASE
            -- Map database payer names to IntakeQ names
            WHEN LOWER(name) LIKE '%molina%' THEN 'Molina Healthcare of Utah (aka American Family Care)'
            WHEN LOWER(name) LIKE '%medicaid%utah%' THEN 'Medicaid Utah'
            WHEN LOWER(name) LIKE '%medicaid%idaho%' THEN 'Medicaid Idaho'
            WHEN LOWER(name) LIKE '%aetna%' THEN 'Aetna Health, Inc.'
            WHEN LOWER(name) LIKE '%first health%' THEN 'First Health Network'
            WHEN LOWER(name) LIKE '%health choice%' THEN 'Health Choice of Utah'
            WHEN LOWER(name) LIKE '%healthyu%' THEN 'HealthyU Medicaid'
            WHEN LOWER(name) LIKE '%huntsman%' THEN 'Huntsman Mental Health Institute Behavioral Health Network (HMHI BHN)'
            WHEN LOWER(name) LIKE '%motiv%' THEN 'MotivHealth Insurance Company'
            WHEN LOWER(name) LIKE '%optum%' THEN 'Optum Care Network'
            WHEN LOWER(name) LIKE '%deseret%mutual%' THEN 'Deseret Mutual Benefit Administrators'
            WHEN LOWER(name) LIKE '%university%utah%health%' THEN 'University of Utah Health Plans'
            ELSE NULL
        END as intakeq_name
    FROM payers
    WHERE is_active = true
)
SELECT
    'INSERT INTO payer_external_mappings (payer_id, system, key_name, value) VALUES ('''
    || id || ''', ''practiceq'', ''insurance_company_name'', '''
    || intakeq_name || ''') ON CONFLICT (payer_id, system, key_name) DO UPDATE SET value = EXCLUDED.value;' as insert_statement
FROM payer_lookup
WHERE intakeq_name IS NOT NULL;

-- Manual insert template (update with actual payer IDs from above query)
/*
INSERT INTO payer_external_mappings (payer_id, system, key_name, value)
VALUES
    -- Molina
    ('YOUR_MOLINA_PAYER_ID', 'practiceq', 'insurance_company_name', 'Molina Healthcare of Utah (aka American Family Care)'),

    -- Medicaid
    ('YOUR_MEDICAID_UT_ID', 'practiceq', 'insurance_company_name', 'Medicaid Utah'),
    ('YOUR_MEDICAID_ID_ID', 'practiceq', 'insurance_company_name', 'Medicaid Idaho'),

    -- Commercial insurers
    ('YOUR_AETNA_ID', 'practiceq', 'insurance_company_name', 'Aetna Health, Inc.'),
    ('YOUR_FIRST_HEALTH_ID', 'practiceq', 'insurance_company_name', 'First Health Network'),
    ('YOUR_HEALTH_CHOICE_ID', 'practiceq', 'insurance_company_name', 'Health Choice of Utah'),
    ('YOUR_HEALTHYU_ID', 'practiceq', 'insurance_company_name', 'HealthyU Medicaid'),
    ('YOUR_DESERET_ID', 'practiceq', 'insurance_company_name', 'Deseret Mutual Benefit Administrators'),

    -- Special networks
    ('YOUR_HUNTSMAN_ID', 'practiceq', 'insurance_company_name', 'Huntsman Mental Health Institute Behavioral Health Network (HMHI BHN)'),
    ('YOUR_MOTIV_ID', 'practiceq', 'insurance_company_name', 'MotivHealth Insurance Company'),
    ('YOUR_OPTUM_ID', 'practiceq', 'insurance_company_name', 'Optum Care Network'),
    ('YOUR_UU_HEALTH_ID', 'practiceq', 'insurance_company_name', 'University of Utah Health Plans')
ON CONFLICT (payer_id, system, key_name)
DO UPDATE SET
    value = EXCLUDED.value,
    updated_at = NOW();
*/

-- Verify mappings after insertion
SELECT
    p.name as database_payer_name,
    pem.value as intakeq_insurance_name,
    pem.created_at,
    pem.updated_at
FROM payer_external_mappings pem
JOIN payers p ON p.id = pem.payer_id
WHERE pem.system = 'practiceq'
    AND pem.key_name = 'insurance_company_name'
ORDER BY p.name;

-- Test query: Check if the most recent appointment would have proper insurance mapping
WITH recent_appointment AS (
    SELECT
        insurance_info->>'payer_id' as payer_id,
        insurance_info->>'payer_name' as payer_name,
        insurance_info->>'member_id' as member_id
    FROM appointments
    WHERE created_at > NOW() - INTERVAL '1 day'
    ORDER BY created_at DESC
    LIMIT 1
)
SELECT
    ra.payer_name as appointment_payer,
    p.name as database_payer,
    pem.value as intakeq_mapping,
    CASE
        WHEN pem.value IS NOT NULL THEN '✅ Mapped'
        ELSE '❌ No mapping - will use fallback'
    END as status
FROM recent_appointment ra
LEFT JOIN payers p ON p.id = ra.payer_id::uuid
LEFT JOIN payer_external_mappings pem ON
    pem.payer_id = ra.payer_id::uuid
    AND pem.system = 'practiceq'
    AND pem.key_name = 'insurance_company_name';