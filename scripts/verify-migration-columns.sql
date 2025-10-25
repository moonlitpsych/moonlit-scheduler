-- Verify required columns were added by migration

-- Check provider_payer_networks columns
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'provider_payer_networks'
AND column_name IN ('billing_provider_id', 'notes', 'created_at', 'updated_at')
ORDER BY column_name;

-- Check supervision_relationships columns
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'supervision_relationships'
AND column_name IN ('attending_provider_id', 'resident_provider_id', 'payer_id', 
                     'supervision_type', 'start_date', 'end_date', 'is_active',
                     'supervision_level', 'notes', 'created_by', 'updated_by')
ORDER BY column_name;

-- Check payers columns
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'payers'
AND column_name IN ('allows_supervised', 'supervision_level', 'updated_at')
ORDER BY column_name;
