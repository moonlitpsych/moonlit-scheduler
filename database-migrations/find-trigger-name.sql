-- Find the correct trigger name on appointments table
SELECT
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'appointments'
  AND trigger_name LIKE '%bookable%';

-- Also check all triggers on appointments table
SELECT
  trigger_name,
  event_manipulation,
  event_object_table
FROM information_schema.triggers
WHERE event_object_table = 'appointments'
ORDER BY trigger_name;
