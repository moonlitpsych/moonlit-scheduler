-- Migration 079: Seed Andy Godfrey's Utah psychology license
--
-- The provider_licenses table already exists; this just adds his row.
-- Idempotent on (provider_id, license_number, issuing_state).
--
-- Source: his intake form (4/3/2026 response). Start/expiration dates were
-- not captured on the form — verify against his actual license certificate
-- and update the row when known.

BEGIN;

INSERT INTO provider_licenses (
    provider_id, license_type, license_number, issuing_state,
    license_image_url, start_date, expiration_date, created_date
)
SELECT
    p.id,
    'Psychologist',
    '13886997-2501',
    'UT',
    'https://drive.google.com/open?id=1ojtKPqF-y-y2dGcBcMO9iyfwQ8jjCNK0',
    NULL,                                      -- TODO: confirm from license certificate
    NULL,                                      -- TODO: confirm from license certificate
    NOW()
FROM providers p
WHERE p.npi = '1548077837'
  AND NOT EXISTS (
      SELECT 1 FROM provider_licenses pl
      WHERE pl.provider_id = p.id
        AND pl.license_number = '13886997-2501'
        AND pl.issuing_state = 'UT'
  );

COMMIT;

-- Verification:
-- SELECT pl.license_type, pl.license_number, pl.issuing_state, pl.start_date, pl.expiration_date
--   FROM provider_licenses pl
--   JOIN providers p ON p.id = pl.provider_id
--   WHERE p.npi = '1548077837';
