-- Migration: Fix DMBA Office Ally Payer ID
-- Purpose: Update DMBA's office_ally_payer_id from patient member ID to correct payer ID
-- Created: 2025-11-03
-- Issue: DMBA eligibility checks were failing with "INVALID OFFICE ALLY PAYER ID"
--         because we were using the patient's member ID (001076973) instead of
--         the correct Office Ally payer ID (SX105)
--
-- Evidence: PDF showing successful eligibility check (/Users/miriam/Downloads/Eligibility Results _ OA Service Center.pdf)
--           confirmed SX105 is the correct ID from IntakeQ documentation

-- Update DMBA's Office Ally payer ID
UPDATE payer_office_ally_configs
SET office_ally_payer_id = 'SX105',
    updated_at = NOW()
WHERE payer_id = '8bd0bedb-226e-4253-bfeb-46ce835ef2a8' -- DMBA payer UUID
  AND office_ally_payer_id = '001076973'; -- Current incorrect value

-- Verify the update
SELECT
    payer_display_name,
    office_ally_payer_id,
    updated_at
FROM payer_office_ally_configs
WHERE payer_id = '8bd0bedb-226e-4253-bfeb-46ce835ef2a8';
