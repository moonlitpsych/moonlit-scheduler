-- Migration: Add is_bookable field to providers table
-- Date: September 1, 2025
-- Purpose: Separate bookability from new patient acceptance

-- Add the is_bookable column
ALTER TABLE providers 
ADD COLUMN is_bookable BOOLEAN DEFAULT true;

-- Add a comment to document the field
COMMENT ON COLUMN providers.is_bookable IS 'Whether this provider can be booked directly by patients. Supervising attendings may be false.';

-- Update Dr. Privratsky to not be bookable (he supervises but doesn't take direct bookings)
UPDATE providers 
SET is_bookable = false 
WHERE last_name = 'Privratsky';

-- Verify the changes
SELECT id, first_name, last_name, is_bookable, accepts_new_patients 
FROM providers 
ORDER BY last_name;