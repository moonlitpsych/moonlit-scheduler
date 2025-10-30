-- Check what columns actually exist in v_appointments_grid
SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'v_appointments_grid'
ORDER BY ordinal_position;
