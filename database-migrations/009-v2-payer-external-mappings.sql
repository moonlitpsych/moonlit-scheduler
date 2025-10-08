-- Migration: V2.0 Payer External Mappings
-- Purpose: Map internal payer IDs to external system identifiers (e.g., IntakeQ insurance company names)
-- Created: 2025-10-08
-- Feature: PRACTICEQ_ENRICH_ENABLED

-- Create payer_external_mappings table
CREATE TABLE IF NOT EXISTS payer_external_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payer_id UUID NOT NULL REFERENCES payers(id) ON DELETE CASCADE,
    system TEXT NOT NULL, -- 'intakeq', 'athena', etc.
    key_name TEXT NOT NULL, -- 'insurance_company_name', 'payer_code', etc.
    value TEXT NOT NULL, -- The external system's identifier
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT, -- Admin user who created this mapping
    notes TEXT, -- Optional notes about the mapping

    -- Ensure unique mapping per payer/system/key combination
    CONSTRAINT unique_payer_system_key UNIQUE (payer_id, system, key_name)
);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_payer_external_mappings_payer_id
    ON payer_external_mappings(payer_id);

CREATE INDEX IF NOT EXISTS idx_payer_external_mappings_system
    ON payer_external_mappings(system);

CREATE INDEX IF NOT EXISTS idx_payer_external_mappings_lookup
    ON payer_external_mappings(payer_id, system, key_name);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_payer_external_mappings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_payer_external_mappings_updated_at
    BEFORE UPDATE ON payer_external_mappings
    FOR EACH ROW
    EXECUTE FUNCTION update_payer_external_mappings_updated_at();

-- Add helpful comments
COMMENT ON TABLE payer_external_mappings IS 'V2.0: Maps internal payer IDs to external system identifiers for integration enrichment';
COMMENT ON COLUMN payer_external_mappings.system IS 'External system name (intakeq, athena, etc.)';
COMMENT ON COLUMN payer_external_mappings.key_name IS 'Type of mapping (insurance_company_name, payer_code, etc.)';
COMMENT ON COLUMN payer_external_mappings.value IS 'The external system identifier value';

-- NO AUTO-SEEDING
-- Mappings must be added manually via admin UI or direct SQL after verifying with PracticeQ/IntakeQ
--
-- Example manual insert (replace with actual values):
-- INSERT INTO payer_external_mappings (payer_id, system, key_name, value, created_by, notes)
-- VALUES (
--   '<payer_uuid>',
--   'intakeq',
--   'insurance_company_name',
--   '<exact_intakeq_payer_name>',
--   'admin@trymoonlit.com',
--   'Manually mapped on YYYY-MM-DD after verifying in PracticeQ'
-- );
--
-- Based on screenshot of PracticeQ payers (2025-10-08):
-- Available PracticeQ payers and their IDs:
-- - 60054: Aetna Health, Inc.
-- - SX105: Deseret Mutual Benefit Administrators
-- - 60054: First Health Network (same ID as Aetna)
-- - 45399: Health Choice of Utah
-- - SX155: HealthyU Medicaid
-- - SX155: Huntsman Mental Health Institute Behavioral Health Network (HMHI BHN) (same ID as HealthyU)
-- - MCDID: Medicaid Idaho
-- - SKUT0: Medicaid Utah
-- - SX109: Molina Healthcare of Utah (aka American Family Care)
-- - U7632: MotivHealth Insurance Company (duplicated in screenshot)
-- - SX155: University of Utah Health Plans (same ID as HealthyU/HMHI)
--
-- Moonlit payers with provider contracts (from database):
-- - d5bf8ae0-9670-49b8-8a3a-b66b82aa1ba2: Aetna
-- - 8bd0bedb-226e-4253-bfeb-46ce835ef2a8: DMBA
-- - 29e7aa03-6afc-48b0-8d80-50a596aa3565: First Health Network
-- - 62ab291d-b68e-4c71-a093-2d6e380764c3: Health Choice Utah
-- - d218f12b-f8c4-498e-96c4-a03693c322d2: HealthyU (UUHP)
-- - 2db7c014-8674-40bb-b918-88160ffde0a6: HMHI BHN
-- - e66daffe-8444-43e0-908c-c366c5d38ef7: Idaho Medicaid
-- - 8b48c3e2-f555-4d67-8122-c086466ba97d: Molina Utah
-- - 1f9c18ec-f4af-4343-9c1f-515abda9c442: MotivHealth
-- - c9a7e516-4498-4e21-8f7c-b359653d2d69: Optum Commercial Behavioral Health
-- - c238fcff-dd31-4be8-a0b2-292c0800d9c4: University of Utah Health Plans (UUHP)
-- - a01d69d6-ae70-4917-afef-49b5ef7e5220: Utah Medicaid Fee-for-Service
--
-- TO POPULATE: Review each payer and map to correct PracticeQ ID
-- Question for Miriam: Which Moonlit payer names should map to which PracticeQ IDs?

-- Verification query (will show empty until mappings are added)
SELECT
    p.name AS moonlit_payer_name,
    p.id AS moonlit_payer_id,
    pem.system,
    pem.value AS practiceq_id,
    pem.notes,
    pem.created_by,
    pem.created_at
FROM payer_external_mappings pem
JOIN payers p ON p.id = pem.payer_id
ORDER BY p.name;
