-- Check if Regence BlueCross BlueShield was updated
SELECT
    id,
    name,
    status_code,
    effective_date,
    allows_supervised,
    supervision_level,
    updated_at
FROM payers
WHERE name LIKE '%Regence%BlueCross%BlueShield%'
ORDER BY updated_at DESC
LIMIT 1;
