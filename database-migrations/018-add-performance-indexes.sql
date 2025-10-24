/**
 * Migration 018: Add Performance Indexes
 *
 * Purpose: Speed up partner dashboard queries by adding missing indexes
 * Expected Impact: 30-40% faster query performance
 */

-- Index for appointment queries by patient and date
CREATE INDEX IF NOT EXISTS idx_appointments_patient_start
ON appointments(patient_id, start_time DESC);

-- Index for filtering appointments by status and date
CREATE INDEX IF NOT EXISTS idx_appointments_status_start
ON appointments(status, start_time DESC);

-- Index for organization-specific patient lookups
CREATE INDEX IF NOT EXISTS idx_affiliations_org_status
ON patient_organization_affiliations(organization_id, status);

-- Index for assignment queries
CREATE INDEX IF NOT EXISTS idx_assignments_partner_status
ON partner_user_patient_assignments(partner_user_id, status);

-- Index for assignment queries by patient
CREATE INDEX IF NOT EXISTS idx_assignments_patient_status
ON partner_user_patient_assignments(patient_id, status);

-- Composite index for faster provider lookups
CREATE INDEX IF NOT EXISTS idx_patients_provider
ON patients(primary_provider_id)
WHERE primary_provider_id IS NOT NULL;

-- Comments for documentation
COMMENT ON INDEX idx_appointments_patient_start IS
  'Speeds up patient appointment queries ordered by date';

COMMENT ON INDEX idx_affiliations_org_status IS
  'Speeds up organization patient roster queries';

COMMENT ON INDEX idx_assignments_partner_status IS
  'Speeds up partner user assignment lookups';

-- Analyze tables to update statistics
ANALYZE appointments;
ANALYZE patient_organization_affiliations;
ANALYZE partner_user_patient_assignments;
ANALYZE patients;

SELECT 'Performance indexes created successfully' as status;
