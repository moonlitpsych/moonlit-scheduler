-- Migration 024: Force schema reload and manually create Regence supervisions
-- This bypasses the PostgREST cache issue by using direct SQL

BEGIN;

-- First, verify the correct columns exist
DO $$
BEGIN
    -- Check supervision_relationships has correct columns
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'supervision_relationships'
        AND column_name = 'supervisor_provider_id'
    ) THEN
        RAISE EXCEPTION 'supervisor_provider_id column does not exist!';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'supervision_relationships'
        AND column_name = 'supervisee_provider_id'
    ) THEN
        RAISE EXCEPTION 'supervisee_provider_id column does not exist!';
    END IF;

    RAISE NOTICE 'Columns verified - supervisor_provider_id and supervisee_provider_id exist';
END $$;

-- Manually insert the 8 Regence BlueCross BlueShield supervision relationships
-- Using ON CONFLICT to make this idempotent
INSERT INTO supervision_relationships (
    supervisor_provider_id,
    supervisee_provider_id,
    payer_id,
    supervision_type,
    start_date,
    is_active,
    supervision_level,
    notes,
    created_at,
    updated_at
)
SELECT
    '504d53c6-54ef-40b0-81d4-80812c2c7bfd'::uuid, -- Miriam Admin (supervisor)
    provider_id::uuid,                              -- The resident
    'b9e556b7-1070-47b8-8467-ef1ee5c68e4e'::uuid, -- Regence BCBS payer
    'general',
    '2025-11-01'::date,
    true,
    'sign_off_only',
    'Created via migration 024 - Regence BCBS supervision setup',
    NOW(),
    NOW()
FROM (VALUES
    ('19efc9c8-3950-45c4-be1d-f0e04615e0d1'), -- Mitchell Allen
    ('5c98f1cd-f7cc-4f68-8ebd-0a24c1d60e7b'), -- Gisele Braga
    ('9aa1e2ad-b1c7-41d6-853d-28a8a3785bd7'), -- Tatiana Kaehler
    ('afa8bd26-2cef-4a3e-b77b-e733e85815fa'), -- Travis Norseth
    -- ('504d53c6-54ef-40b0-81d4-80812c2c7bfd'), -- Anthony Privratsky - REMOVED (he's the supervisor, not supervisee!)
    ('10aab18a-e0c8-46a7-a1ee-3df2c0de1f90'), -- Merrick Reynolds
    ('c88c0be3-a59f-4fae-bcfe-c0a93385d5c8'), -- Doug Sirutis
    ('e6d5f5d1-babc-4b94-89ea-ca7baf4ed851')  -- Rufus Sweeney
) AS providers(provider_id)
ON CONFLICT ON CONSTRAINT uq_supervision DO NOTHING;

-- Get count of inserted rows
DO $$
DECLARE
    supervision_count INT;
BEGIN
    SELECT COUNT(*) INTO supervision_count
    FROM supervision_relationships
    WHERE payer_id = 'b9e556b7-1070-47b8-8467-ef1ee5c68e4e'::uuid;

    RAISE NOTICE 'Total Regence BCBS supervision relationships: %', supervision_count;
END $$;

COMMIT;
