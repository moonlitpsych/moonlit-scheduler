-- Check provider table structure to see role fields
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'providers'
AND column_name LIKE '%role%'
ORDER BY ordinal_position;

-- Check what role values exist in providers table
SELECT
    id,
    first_name,
    last_name,
    role,
    role_id,
    is_active,
    is_bookable
FROM providers
WHERE is_active = true
ORDER BY last_name, first_name;

-- If there's a roles table, check it
SELECT
    id,
    name,
    description
FROM roles
ORDER BY name;
