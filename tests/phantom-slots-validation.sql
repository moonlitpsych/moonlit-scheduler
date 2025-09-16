-- SQL test queries to validate phantom slots fix
-- Run these against your database to verify the fix works correctly

-- Test 1: Verify Dr. Sweeney's provider record exists
SELECT
    id,
    first_name,
    last_name,
    is_active,
    is_bookable
FROM providers
WHERE id = '08fbcd34-cd5f-425c-85bd-1aeeffbe9694';

-- Test 2: Check Dr. Sweeney's regular availability on Mondays (2025-09-16)
SELECT
    provider_id,
    day_of_week,
    start_time,
    end_time,
    is_recurring
FROM provider_availability
WHERE provider_id = '08fbcd34-cd5f-425c-85bd-1aeeffbe9694'
  AND day_of_week = 1  -- Monday
  AND is_recurring = true;

-- Test 3: Check for exceptions on 2025-09-15 (should block availability)
SELECT
    provider_id,
    exception_date,
    exception_type,
    start_time,
    end_time,
    note
FROM availability_exceptions
WHERE provider_id = '08fbcd34-cd5f-425c-85bd-1aeeffbe9694'
  AND exception_date = '2025-09-15';

-- Test 4: Check for exceptions on 2025-09-16 (should be clear)
SELECT
    provider_id,
    exception_date,
    exception_type,
    start_time,
    end_time,
    note
FROM availability_exceptions
WHERE provider_id = '08fbcd34-cd5f-425c-85bd-1aeeffbe9694'
  AND exception_date = '2025-09-16';

-- Test 5: Comprehensive availability check for Dr. Sweeney
-- This simulates what the fixed API should return
WITH provider_availability_check AS (
    SELECT
        p.id as provider_id,
        p.first_name,
        p.last_name,
        pa.day_of_week,
        pa.start_time,
        pa.end_time,
        pa.is_recurring
    FROM providers p
    LEFT JOIN provider_availability pa ON p.id = pa.provider_id
    WHERE p.id = '08fbcd34-cd5f-425c-85bd-1aeeffbe9694'
      AND pa.is_recurring = true
),
test_dates AS (
    SELECT '2025-09-15' as test_date, 0 as day_of_week, 'Should be BLOCKED' as expected_result
    UNION ALL
    SELECT '2025-09-16' as test_date, 1 as day_of_week, 'Should have 2 slots' as expected_result
),
exceptions_check AS (
    SELECT
        provider_id,
        exception_date,
        exception_type,
        start_time,
        end_time
    FROM availability_exceptions
    WHERE provider_id = '08fbcd34-cd5f-425c-85bd-1aeeffbe9694'
      AND exception_date IN ('2025-09-15', '2025-09-16')
)
SELECT
    td.test_date,
    td.expected_result,
    pac.provider_id,
    pac.first_name,
    pac.last_name,
    pac.start_time as regular_start,
    pac.end_time as regular_end,
    ec.exception_type,
    ec.start_time as exception_start,
    ec.end_time as exception_end,
    CASE
        WHEN ec.exception_type IN ('unavailable', 'vacation') THEN 'BLOCKED - No slots should appear'
        WHEN ec.exception_type = 'custom_hours' THEN 'CUSTOM HOURS - Use exception times'
        WHEN ec.exception_type = 'partial_block' THEN 'PARTIAL BLOCK - Filter out blocked time'
        WHEN ec.provider_id IS NULL AND pac.provider_id IS NOT NULL THEN 'AVAILABLE - Use regular schedule'
        ELSE 'NO AVAILABILITY'
    END as api_should_return
FROM test_dates td
LEFT JOIN provider_availability_check pac ON td.day_of_week = pac.day_of_week
LEFT JOIN exceptions_check ec ON ec.exception_date = td.test_date
ORDER BY td.test_date;

-- Test 6: Verify no phantom slots are possible
-- This query finds any availability that would create phantom slots
SELECT
    'POTENTIAL PHANTOM SLOTS' as warning,
    pa.provider_id,
    pa.day_of_week,
    pa.start_time,
    pa.end_time,
    DATE('2025-09-15') + (pa.day_of_week || ' days')::interval as would_generate_for_date,
    ae.exception_type,
    ae.exception_date
FROM provider_availability pa
LEFT JOIN availability_exceptions ae ON (
    pa.provider_id = ae.provider_id
    AND ae.exception_date = DATE('2025-09-15') + (pa.day_of_week || ' days')::interval::date
)
WHERE pa.provider_id = '08fbcd34-cd5f-425c-85bd-1aeeffbe9694'
  AND pa.is_recurring = true
  AND (
    ae.exception_type IN ('unavailable', 'vacation')
    OR ae.provider_id IS NULL
  );

-- Expected Results Summary:
-- Test 1: Should return Dr. Sweeney's record
-- Test 2: Should return Monday availability (17:00-19:00)
-- Test 3: Should return unavailable exception for 2025-09-15
-- Test 4: Should return no exceptions for 2025-09-16
-- Test 5: Should show BLOCKED for 2025-09-15, AVAILABLE for 2025-09-16
-- Test 6: Should identify if any phantom slots could be generated