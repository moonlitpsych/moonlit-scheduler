-- Migration 026: Create Regence BlueCross BlueShield supervision relationships
-- Using CORRECT provider IDs from the actual database

BEGIN;

-- Create supervision relationships with Dr. Miriam Admin as the supervisor
-- Note: Anthony Privratsky has a direct contract, so he's not supervised
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
    'e10bae12-2d42-47f0-b554-b6cd688719d7'::uuid, -- Dr. Miriam Admin (supervisor)
    provider_id::uuid,                              -- The resident being supervised
    'b9e556b7-1070-47b8-8467-ef1ee5c68e4e'::uuid, -- Regence BCBS payer ID
    'general',
    '2025-11-01'::date,
    true,
    'sign_off_only',
    'Created via migration 026 - Regence BCBS supervision with correct provider IDs',
    NOW(),
    NOW()
FROM (VALUES
    ('1f28a0e5-ead8-4ae0-8d3e-f6d0680558b8'), -- Mitchell Allen
    ('db9ccc5b-0451-4a80-bb66-5cbcfa643460'), -- Gisele Braga
    ('19efc9c8-3950-45c4-be1d-f0e04615e0d1'), -- Tatiana Kaehler
    ('35ab086b-2894-446d-9ab5-3d41613017ad'), -- Travis Norseth
    ('bc0fc904-7cc9-4d22-a094-6a0eb482128d'), -- Merrick Reynolds
    ('9b093465-e514-4d9f-8c45-22dcd0eb1811'), -- Doug Sirutis
    ('08fbcd34-cd5f-425c-85bd-1aeeffbe9694')  -- Rufus Sweeney
) AS providers(provider_id)
ON CONFLICT ON CONSTRAINT uq_supervision DO NOTHING;

-- Verify the insertions
SELECT
    COUNT(*) as supervision_count,
    'Regence BlueCross BlueShield supervision relationships created' as message
FROM supervision_relationships
WHERE payer_id = 'b9e556b7-1070-47b8-8467-ef1ee5c68e4e'::uuid
AND supervisor_provider_id = 'e10bae12-2d42-47f0-b554-b6cd688719d7'::uuid;

COMMIT;
