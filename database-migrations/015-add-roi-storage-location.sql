-- ============================================================================
-- Migration 015: Add ROI Storage Location Tracking
-- Created: 2025-10-16
-- Description: Track where ROI documents are stored (our system vs PracticeQ)
-- ============================================================================

-- Add roi_storage_location column to patient_organization_affiliations
ALTER TABLE patient_organization_affiliations
  ADD COLUMN IF NOT EXISTS roi_storage_location text NULL
    CHECK (roi_storage_location IN ('uploaded', 'practiceq'));

-- Add index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_poa_roi_storage
  ON patient_organization_affiliations(organization_id, roi_storage_location)
  WHERE roi_storage_location IS NOT NULL;

COMMENT ON COLUMN patient_organization_affiliations.roi_storage_location IS 'Where ROI is stored: uploaded (our Supabase Storage) or practiceq (stored in PracticeQ/IntakeQ system)';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

SELECT 'Migration 015: ROI Storage Location Tracking - COMPLETE' as status;
