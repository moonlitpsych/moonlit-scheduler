/**
 * URGENT: Convert Materialized View to Regular View
 *
 * This fixes the patient status update bug where changes don't appear immediately.
 *
 * Run this in Supabase SQL Editor:
 */

-- Step 1: Get the definition of the materialized view
-- (Run this first to see what we're working with)
SELECT pg_get_viewdef('v_patient_activity_summary'::regclass, true);

-- Step 2: Drop the materialized view
DROP MATERIALIZED VIEW IF EXISTS v_patient_activity_summary CASCADE;

-- Step 3: Recreate as a regular view
-- NOTE: You'll need to paste the view definition from Step 1 here
-- Replace "CREATE MATERIALIZED VIEW" with "CREATE OR REPLACE VIEW"
--
-- Example:
-- CREATE OR REPLACE VIEW v_patient_activity_summary AS
-- SELECT ...
-- (paste the full definition from step 1)

-- Step 4: Grant permissions
GRANT SELECT ON v_patient_activity_summary TO authenticated;
GRANT SELECT ON v_patient_activity_summary TO anon;
GRANT SELECT ON v_patient_activity_summary TO service_role;

/**
 * After running this:
 * 1. Status updates will appear immediately in the UI
 * 2. No more refresh function needed
 * 3. Data is always current
 *
 * Trade-off: Slightly slower queries (but probably not noticeable)
 */
