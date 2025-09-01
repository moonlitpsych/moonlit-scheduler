-- Migration: Clean up obsolete provider fields
-- Date: September 1, 2025
-- Purpose: Remove obsolete fields after implementing is_bookable + accepts_new_patients system

-- Step 1: Create backup of data before deletion
CREATE TABLE IF NOT EXISTS provider_field_backup_20250901 AS 
SELECT 
    id, 
    first_name, 
    last_name,
    availability,
    created_at as backup_date
FROM providers;

-- Step 2: Verify new system works before cleanup
-- This query shows the old vs new logic side by side
SELECT 
    first_name, 
    last_name,
    is_bookable,
    accepts_new_patients,
    availability as old_availability_field,
    -- New computed status logic
    CASE 
        WHEN NOT is_bookable THEN NULL  -- No status shown for non-bookable
        WHEN is_bookable AND accepts_new_patients THEN 'Accepting New Patients'  
        WHEN is_bookable AND NOT accepts_new_patients THEN 'Established Patients Only'
    END as new_computed_status
FROM providers
ORDER BY last_name;

-- Step 3: Remove obsolete availability column
-- (Uncomment after verifying the query above looks correct)
-- ALTER TABLE providers DROP COLUMN IF EXISTS availability;

-- Step 4: Add comments to document the new system
COMMENT ON COLUMN providers.is_bookable IS 'Whether this provider can be booked directly by patients. Supervising attendings should be false.';
COMMENT ON COLUMN providers.accepts_new_patients IS 'Whether provider is accepting new patients into their panel. Independent of bookability.';

-- Step 5: Verify final table structure
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns 
WHERE table_name = 'providers' 
AND column_name IN ('is_bookable', 'accepts_new_patients', 'availability')
ORDER BY column_name;