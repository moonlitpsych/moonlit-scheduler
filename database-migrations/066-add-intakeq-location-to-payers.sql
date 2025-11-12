-- Migration 066: Add IntakeQ Location ID to Payers
-- Purpose: Store IntakeQ widget locationId for each payer to enable payer-specific booking widgets
-- Context: Part of /book-now hybrid flow - Moonlit payer selection → IntakeQ widget
-- Date: 2025-11-12
-- Author: Claude Code Session

-- ============================================================================
-- BACKGROUND
-- ============================================================================
-- IntakeQ (PracticeQ) has different booking widgets for different payers/scenarios.
-- Each widget is identified by a locationId parameter in the embed script.
-- This migration adds the ability to store that locationId per payer.
--
-- Example IntakeQ widget script:
-- <script>
--   window.intakeq = "673cd162794661bc66f3cad1";  // Account ID (constant)
--   window.intakeqLocationId = 7;                  // Location ID (varies by payer)
-- </script>
--
-- Known location mappings:
-- - locationId=1: Out-of-pocket pay (UT)
-- - locationId=5: Housed Medicaid (ID)
-- - locationId=6: Unhoused Medicaid (ID)
-- - locationId=7: SelectHealth (UT)
-- - locationId=8: HMHI BHN (UT)

-- ============================================================================
-- SCHEMA CHANGE
-- ============================================================================

-- Add column to store IntakeQ locationId for each payer
ALTER TABLE payers
ADD COLUMN IF NOT EXISTS intakeq_location_id TEXT;

-- Add comment for documentation
COMMENT ON COLUMN payers.intakeq_location_id IS
  'IntakeQ widget locationId for this payer. Used in /book-now flow to redirect to correct booking widget.';

-- Add index for fast lookups when fetching payer with location
CREATE INDEX IF NOT EXISTS idx_payers_intakeq_location
  ON payers(intakeq_location_id)
  WHERE intakeq_location_id IS NOT NULL;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
    -- Verify column was added
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'payers'
        AND column_name = 'intakeq_location_id'
    ) THEN
        RAISE NOTICE '✅ Column payers.intakeq_location_id added successfully';
    ELSE
        RAISE EXCEPTION '❌ Failed to add column payers.intakeq_location_id';
    END IF;

    -- Show current payers ready for location ID assignment
    RAISE NOTICE '';
    RAISE NOTICE '📋 Next step: Seed IntakeQ location IDs for active payers';
    RAISE NOTICE '   Run the companion migration: 067-seed-intakeq-locations.sql';
    RAISE NOTICE '';
END $$;
