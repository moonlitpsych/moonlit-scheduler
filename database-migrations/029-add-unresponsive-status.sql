/**
 * Migration 029: Add "unresponsive" patient engagement status
 * Created: 2025-10-28
 *
 * Purpose:
 * - Add new status for patients who have not responded when reached out
 *   about a missed or scheduled appointment
 * - Helps track engagement patterns and follow-up needs
 */

-- Step 1: Drop the existing CHECK constraint
ALTER TABLE patient_engagement_status
  DROP CONSTRAINT IF EXISTS patient_engagement_status_status_check;

-- Step 2: Add the new CHECK constraint with 'unresponsive' included
ALTER TABLE patient_engagement_status
  ADD CONSTRAINT patient_engagement_status_status_check
  CHECK (status IN ('active', 'discharged', 'transferred', 'deceased', 'inactive', 'unresponsive'));

-- Step 3: Update comment to document new status
COMMENT ON COLUMN patient_engagement_status.status IS
  'active: default state. unresponsive: patient not responding to outreach. Terminal states (discharged/transferred/deceased/inactive) require manual change by staff.';

-- Verify the change
SELECT
  'Migration 029: Add unresponsive status - COMPLETE' as status,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'patient_engagement_status'
  AND column_name = 'status';
