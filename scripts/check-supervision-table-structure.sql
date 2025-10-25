-- Check what columns actually exist in supervision_relationships table
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'supervision_relationships'
ORDER BY ordinal_position;
