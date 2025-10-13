-- Introspection script to check actual database state

-- 1. Check if intakeq_sync_audit table exists
SELECT
    table_name,
    table_schema
FROM information_schema.tables
WHERE table_name LIKE '%sync_audit%';

-- 2. Get constraint details for the audit table
SELECT
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'intakeq_sync_audit'::regclass
ORDER BY conname;

-- 3. Check column details
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'intakeq_sync_audit'
ORDER BY ordinal_position;

-- 4. Check if patients table has intakeq_client_id column
SELECT
    column_name
FROM information_schema.columns
WHERE table_name = 'patients'
AND column_name LIKE '%intakeq%' OR column_name LIKE '%practiceq%'
OR column_name LIKE '%pq_%';