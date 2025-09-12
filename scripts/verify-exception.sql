-- Script to verify Dr. Sweeney's exception for 2025-09-13
-- Run this against the production database to confirm the exception exists

-- Check if Dr. Sweeney exists and get his ID
SELECT 
    id, 
    first_name, 
    last_name,
    is_active,
    is_bookable
FROM providers
WHERE id = '08fbcd34-cd5f-425c-85bd-1aeeffbe9694';

-- Check for exceptions on 2025-09-13
SELECT 
    id,
    provider_id,
    exception_date,
    exception_type,
    start_time,
    end_time,
    created_at,
    CASE 
        WHEN start_time IS NULL AND end_time IS NULL THEN 'All day exception'
        ELSE 'Time-based exception'
    END as exception_scope
FROM availability_exceptions
WHERE provider_id = '08fbcd34-cd5f-425c-85bd-1aeeffbe9694'
  AND exception_date = '2025-09-13';

-- Check Dr. Sweeney's regular Saturday availability
SELECT 
    day_of_week,
    start_time,
    end_time,
    is_recurring
FROM provider_availability
WHERE provider_id = '08fbcd34-cd5f-425c-85bd-1aeeffbe9694'
  AND day_of_week = 6  -- Saturday
  AND is_recurring = true;

-- Check what the patient-facing API would see (simulating the fix)
-- This shows what slots WOULD be generated without exceptions
WITH base_availability AS (
    SELECT 
        provider_id,
        day_of_week,
        start_time,
        end_time
    FROM provider_availability
    WHERE provider_id = '08fbcd34-cd5f-425c-85bd-1aeeffbe9694'
      AND day_of_week = 6
      AND is_recurring = true
),
exceptions AS (
    SELECT 
        provider_id,
        exception_date,
        exception_type,
        start_time,
        end_time
    FROM availability_exceptions
    WHERE provider_id = '08fbcd34-cd5f-425c-85bd-1aeeffbe9694'
      AND exception_date = '2025-09-13'
)
SELECT 
    CASE 
        WHEN e.provider_id IS NOT NULL THEN 'BLOCKED BY EXCEPTION'
        ELSE 'AVAILABLE'
    END as status,
    ba.start_time as regular_start,
    ba.end_time as regular_end,
    e.exception_type,
    e.start_time as exception_start,
    e.end_time as exception_end
FROM base_availability ba
LEFT JOIN exceptions e ON ba.provider_id = e.provider_id;