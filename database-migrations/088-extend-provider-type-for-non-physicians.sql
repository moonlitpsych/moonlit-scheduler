-- 088: Extend providers.provider_type to admit non-physician clinicians
--
-- Context: Moonlit is now onboarding non-MD providers (social workers, psychologists)
-- in addition to MD/DO physicians. The existing CHECK constraint only allowed
-- 'resident physician' and 'attending physician', which blocked creation of any
-- non-physician provider row (discovered while onboarding Cameron Stocking, CSW).
--
-- This widens the allowed set. role/title remain unconstrained. No existing rows
-- are affected (the two physician values are preserved).
--
-- Verification before running:
--   SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conrelid = 'providers'::regclass AND conname = 'providers_provider_type_check';
-- Should currently return:
--   CHECK ((provider_type = ANY (ARRAY['resident physician'::text, 'attending physician'::text])))

BEGIN;

ALTER TABLE providers DROP CONSTRAINT IF EXISTS providers_provider_type_check;

ALTER TABLE providers ADD CONSTRAINT providers_provider_type_check
  CHECK (provider_type = ANY (ARRAY[
    'resident physician'::text,
    'attending physician'::text,
    'social worker'::text,
    'psychologist'::text
  ]));

COMMIT;

-- Post-check (should list all four allowed values):
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conrelid = 'providers'::regclass AND conname = 'providers_provider_type_check';
