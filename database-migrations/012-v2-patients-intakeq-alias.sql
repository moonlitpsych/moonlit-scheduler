-- Migration 012: Add IntakeQ Email Alias Column
-- Purpose: Store the email alias used for IntakeQ client sync when canonical email conflicts
-- Context: IntakeQ enforces unique emails; case managers reuse emails across patients
-- Solution: Use deterministic plus-addressing (e.g., case.manager+mlt-abc1234@domain.com)

BEGIN;

-- Add column to track which email was actually sent to IntakeQ
-- NULL = canonical email was used (no alias needed)
-- Non-NULL = this patient required an alias due to email conflict
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS intakeq_email_alias TEXT;

-- Add comment for documentation
COMMENT ON COLUMN patients.intakeq_email_alias IS
  'The email alias used for IntakeQ sync when canonical email conflicts. NULL if canonical email was used.';

-- Optional: Index for quick lookups when checking for existing aliases
CREATE INDEX IF NOT EXISTS idx_patients_intakeq_email_alias
  ON patients(intakeq_email_alias)
  WHERE intakeq_email_alias IS NOT NULL;

COMMIT;

-- Verification queries (run after migration):
-- 1. Check column exists
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'patients' AND column_name = 'intakeq_email_alias';

-- 2. Verify no existing data conflicts
-- SELECT COUNT(*) as total_patients,
--        COUNT(intakeq_email_alias) as patients_with_alias
-- FROM patients;
