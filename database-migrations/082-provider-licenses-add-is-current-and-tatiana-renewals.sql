-- Migration 082: Add is_current to provider_licenses + Tatiana Kaehler license updates
--
-- Part 1 (schema):
--   Adds an is_current BOOLEAN column to provider_licenses so renewals can
--   keep historical rows. Convention: the active license has is_current=true;
--   when renewed, set the old row to is_current=false and insert a new row.
--
-- Part 2 (data) — Tatiana Kaehler (19efc9c8-3950-45c4-be1d-f0e04615e0d1):
--   2a. Re-parent UT MD license 13509690-1205 from Travis Norseth
--       (35ab086b-2894-446d-9ab5-3d41613017ad) to Tatiana, and set its
--       expiration to 2028-01-31. The license number's family
--       (13509690-*) belongs to Tatiana — this row was misattributed.
--   2b. DEA FK3238032 was renewed (per Provider Express 2026-05-07).
--       Mark the existing 2023–2025 row as historical (is_current=false)
--       and insert a new current row covering 2025-12-02 → 2028-12-31.
--   2c. Insert a new WA MD license MD70049370 (2025-10-24 → 2026-11-20).

BEGIN;

-- Part 1: schema change
ALTER TABLE provider_licenses
  ADD COLUMN IF NOT EXISTS is_current BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN provider_licenses.is_current IS
  'True for the currently-effective license. When a license is renewed, set the old row to false and insert a new row with is_current=true.';

-- Part 2a: re-parent UT MD 13509690-1205 from Travis -> Tatiana, set expiry
UPDATE provider_licenses
SET
  provider_id     = '19efc9c8-3950-45c4-be1d-f0e04615e0d1',
  expiration_date = '2028-01-31',
  is_current      = TRUE
WHERE id = '0394ad90-721c-49f5-b735-7fa3043fe5a7'
  AND license_number = '13509690-1205'           -- guard
  AND provider_id    = '35ab086b-2894-446d-9ab5-3d41613017ad'; -- guard

DO $$
DECLARE n INT;
BEGIN
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN
    RAISE EXCEPTION 'Part 2a: expected to update 1 row, updated %', n;
  END IF;
END $$;

-- Part 2b: DEA FK3238032 renewal — mark old row historical, insert new current row
UPDATE provider_licenses
SET is_current = FALSE
WHERE id = '236ba96f-c627-4a5c-8ae7-ac542ef7ea0b'
  AND provider_id    = '19efc9c8-3950-45c4-be1d-f0e04615e0d1'  -- guard
  AND license_number = 'FK3238032';                            -- guard

DO $$
DECLARE n INT;
BEGIN
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN
    RAISE EXCEPTION 'Part 2b (mark old DEA): expected to update 1 row, updated %', n;
  END IF;
END $$;

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

-- Part 2c: WA MD license — new
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

-- Verification (run separately after commit if you'd like to eyeball results):
-- SELECT provider_id, license_type, license_number, issuing_state,
--        start_date, expiration_date, is_current
--   FROM provider_licenses
--  WHERE provider_id IN (
--          '19efc9c8-3950-45c4-be1d-f0e04615e0d1',
--          '35ab086b-2894-446d-9ab5-3d41613017ad'
--        )
--  ORDER BY provider_id, license_type, start_date;
