/**
 * Migration 030: Add test patient flag
 * Created: 2025-10-28
 *
 * Purpose:
 * - Add flag to mark patients as test data
 * - Allows filtering out test patients from production views
 * - Avoids need to delete test data from PracticeQ
 */

-- Step 1: Add is_test_patient column to patients table
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS is_test_patient boolean NOT NULL DEFAULT false;

-- Step 2: Create index for fast filtering
CREATE INDEX IF NOT EXISTS idx_patients_test_flag
  ON patients(is_test_patient)
  WHERE is_test_patient = false;

-- Step 3: Update comment
COMMENT ON COLUMN patients.is_test_patient IS
  'Flag to mark test/demo patients. These are filtered out of production views by default.';

-- Verify the change
SELECT
  'Migration 030: Add test patient flag - COMPLETE' as status,
  COUNT(*) FILTER (WHERE is_test_patient = true) as test_patients,
  COUNT(*) FILTER (WHERE is_test_patient = false) as real_patients
FROM patients;
