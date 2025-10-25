-- 1. Verify columns exist in database
-- Check provider_payer_networks
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'provider_payer_networks'
AND column_name IN ('billing_provider_id', 'notes', 'created_at', 'updated_at')
ORDER BY column_name;

-- Check supervision_relationships
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'supervision_relationships'
AND column_name IN ('supervisor_provider_id', 'supervisee_provider_id', 'payer_id', 'supervision_level')
ORDER BY column_name;

-- 2. Refresh PostgREST schema cache
-- This tells Supabase to reload its understanding of your database schema
NOTIFY pgrst, 'reload schema';
