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

-- Example seed data (IntakeQ insurance company names)
-- Note: These are examples - actual values should be verified with IntakeQ API
INSERT INTO payer_external_mappings (payer_id, system, key_name, value, notes)
SELECT
    id,
    'intakeq',
    'insurance_company_name',
    CASE
        WHEN name ILIKE '%molina%' THEN 'Molina Healthcare'
        WHEN name ILIKE '%pehp%' THEN 'PEHP'
        WHEN name ILIKE '%select health%' THEN 'Select Health'
        WHEN name ILIKE '%university of utah%' THEN 'University of Utah Health Plans'
        WHEN name ILIKE '%regence%' THEN 'Regence'
        ELSE name -- Default to payer name if no specific mapping
    END,
    'Auto-generated mapping - verify with IntakeQ'
FROM payers
WHERE payer_type = 'insurance'
ON CONFLICT (payer_id, system, key_name) DO NOTHING;

-- Verification query
SELECT
    p.name AS payer_name,
    pem.system,
    pem.key_name,
    pem.value AS external_value,
    pem.notes
FROM payer_external_mappings pem
JOIN payers p ON p.id = pem.payer_id
ORDER BY p.name;
