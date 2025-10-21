/**
 * Migration 017: Add PracticeQ Sync Tracking
 *
 * Purpose:
 * - Track last sync time from PracticeQ for each patient-org affiliation
 * - Allows partner dashboard to show "Last synced: 2 hours ago"
 * - Enables incremental syncs using updatedSince parameter
 */

-- Add last_practiceq_sync_at column to patient_organization_affiliations
ALTER TABLE patient_organization_affiliations
ADD COLUMN last_practiceq_sync_at TIMESTAMPTZ;

COMMENT ON COLUMN patient_organization_affiliations.last_practiceq_sync_at IS
  'Last time appointments were synced from PracticeQ for this patient-org relationship';

-- Create index for efficient queries
CREATE INDEX idx_patient_org_affiliations_last_sync
ON patient_organization_affiliations(last_practiceq_sync_at DESC);
