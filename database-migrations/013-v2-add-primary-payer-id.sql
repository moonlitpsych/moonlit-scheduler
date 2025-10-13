-- V2.0: Add primary_payer_id to patients table
-- This tracks the insurance payer selected at first booking

-- Add column if it doesn't exist
ALTER TABLE patients
ADD COLUMN IF NOT EXISTS primary_payer_id UUID REFERENCES payers(id);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_patients_primary_payer_id
ON patients(primary_payer_id);

-- Add comment
COMMENT ON COLUMN patients.primary_payer_id IS 'Primary insurance payer selected at first booking (V2.0)';
