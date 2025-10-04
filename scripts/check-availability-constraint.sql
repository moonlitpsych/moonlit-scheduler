-- Check what's blocking appointments from being created
-- The error "Chosen time is not available for the selected provider (direct)"
-- suggests a database function or trigger is checking availability

-- 1. Check if there are any triggers on the appointments table
SELECT
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'appointments';

-- 2. Check if there's a function checking availability
SELECT
    routine_name,
    routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
    AND (routine_name LIKE '%avail%'
         OR routine_name LIKE '%appointment%'
         OR routine_name LIKE '%check%'
         OR routine_name LIKE '%booking%');

-- 3. Check provider_availability_cache for today
SELECT
    p.first_name || ' ' || p.last_name as provider_name,
    pac.date,
    pac.available_slots,
    pac.day_of_week
FROM provider_availability_cache pac
JOIN providers p ON p.id = pac.provider_id
WHERE pac.date = CURRENT_DATE
    AND p.is_bookable = true
ORDER BY provider_name;

-- 4. Check if there's a constraint function
SELECT
    n.nspname as schema,
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname LIKE '%appointment%'
    OR p.proname LIKE '%availability%'
    OR p.proname LIKE '%booking%';

-- 5. Check what slots are in the cache for Oct 4, 2025
SELECT
    p.first_name || ' ' || p.last_name as provider_name,
    pac.available_slots
FROM provider_availability_cache pac
JOIN providers p ON p.id = pac.provider_id
WHERE pac.date = '2025-10-04'
    AND p.is_bookable = true
    AND p.intakeq_practitioner_id IS NOT NULL;