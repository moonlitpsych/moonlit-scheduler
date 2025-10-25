-- Verify which provider IDs actually exist in the database

-- Check all the provider IDs from the supervision setup
SELECT
    id,
    first_name,
    last_name,
    CASE
        WHEN id = '504d53c6-54ef-40b0-81d4-80812c2c7bfd' THEN '✓ SUPERVISOR (Anthony Privratsky)'
        WHEN id = '19efc9c8-3950-45c4-be1d-f0e04615e0d1' THEN 'Mitchell Allen'
        WHEN id = '5c98f1cd-f7cc-4f68-8ebd-0a24c1d60e7b' THEN 'Gisele Braga'
        WHEN id = '9aa1e2ad-b1c7-41d6-853d-28a8a3785bd7' THEN 'Tatiana Kaehler'
        WHEN id = 'afa8bd26-2cef-4a3e-b77b-e733e85815fa' THEN 'Travis Norseth'
        WHEN id = '10aab18a-e0c8-46a7-a1ee-3df2c0de1f90' THEN 'Merrick Reynolds'
        WHEN id = 'c88c0be3-a59f-4fae-bcfe-c0a93385d5c8' THEN 'Doug Sirutis'
        WHEN id = 'e6d5f5d1-babc-4b94-89ea-ca7baf4ed851' THEN 'Rufus Sweeney'
        ELSE 'Other provider'
    END as expected_name
FROM providers
WHERE id IN (
    '504d53c6-54ef-40b0-81d4-80812c2c7bfd', -- Anthony Privratsky (supervisor)
    '19efc9c8-3950-45c4-be1d-f0e04615e0d1', -- Mitchell Allen
    '5c98f1cd-f7cc-4f68-8ebd-0a24c1d60e7b', -- Gisele Braga
    '9aa1e2ad-b1c7-41d6-853d-28a8a3785bd7', -- Tatiana Kaehler
    'afa8bd26-2cef-4a3e-b77b-e733e85815fa', -- Travis Norseth
    '10aab18a-e0c8-46a7-a1ee-3df2c0de1f90', -- Merrick Reynolds
    'c88c0be3-a59f-4fae-bcfe-c0a93385d5c8', -- Doug Sirutis
    'e6d5f5d1-babc-4b94-89ea-ca7baf4ed851'  -- Rufus Sweeney
)
ORDER BY last_name, first_name;

-- Show ALL active providers for reference
SELECT
    id,
    first_name,
    last_name,
    is_active
FROM providers
WHERE is_active = true
ORDER BY last_name, first_name;
