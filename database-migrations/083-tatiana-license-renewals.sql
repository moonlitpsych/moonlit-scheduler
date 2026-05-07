-- Migration 083: Apply Tatiana Kaehler license updates
--
-- Migration 082 added the is_current column successfully but the data ops
-- failed due to a bug in the row-count guards: GET DIAGNOSTICS in a separate
-- DO block does not see statements outside that block. This migration
-- redoes the data ops with the correct guard pattern (UPDATE inside the
-- DO block, checking FOUND).
--
-- Operations:
--   2a. Re-parent UT MD 13509690-1205 from Travis Norseth -> Tatiana,
--       set expiration_date = 2028-01-31.
--   2b. DEA FK3238032 renewal: mark old row historical, insert new current row.
--   2c. Insert new WA MD MD70049370.

BEGIN;

-- 2a: re-parent UT MD 13509690-1205 to Tatiana with expiration
DO $$
BEGIN
  UPDATE provider_licenses
  SET
    provider_id     = '19efc9c8-3950-45c4-be1d-f0e04615e0d1',
    expiration_date = '2028-01-31',
    is_current      = TRUE
  WHERE id = '0394ad90-721c-49f5-b735-7fa3043fe5a7'
    AND license_number = '13509690-1205'
    AND provider_id    = '35ab086b-2894-446d-9ab5-3d41613017ad';

  IF NOT FOUND THEN
    RAISE EXCEPTION '2a: row 0394ad90 not found in expected state (license=13509690-1205, provider=Travis Norseth). Aborting.';
  END IF;
END $$;

-- 2b: mark old DEA FK3238032 as historical
DO $$
BEGIN
  UPDATE provider_licenses
  SET is_current = FALSE
  WHERE id = '236ba96f-c627-4a5c-8ae7-ac542ef7ea0b'
    AND provider_id    = '19efc9c8-3950-45c4-be1d-f0e04615e0d1'
    AND license_number = 'FK3238032';

  IF NOT FOUND THEN
    RAISE EXCEPTION '2b: row 236ba96f not found in expected state (DEA FK3238032 on Tatiana). Aborting.';
  END IF;
END $$;

-- 2b cont.: insert renewed DEA row
INSERT INTO provider_licenses (
  provider_id, license_type, license_number, issuing_state,
  start_date, expiration_date, is_current
) VALUES (
  '19efc9c8-3950-45c4-be1d-f0e04615e0d1',
  'Federal DEA license',
  'FK3238032',
  'UT',
  '2025-12-02',
  '2028-12-31',
  TRUE
);

-- 2c: insert WA MD license
INSERT INTO provider_licenses (
  provider_id, license_type, license_number, issuing_state,
  start_date, expiration_date, is_current
) VALUES (
  '19efc9c8-3950-45c4-be1d-f0e04615e0d1',
  'State license Physician & Surgeon',
  'MD70049370',
  'WA',
  '2025-10-24',
  '2026-11-20',
  TRUE
);

COMMIT;
