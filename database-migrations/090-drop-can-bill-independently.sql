-- 090: Drop providers.can_bill_independently (reverts migration 089)
--
-- Migration 089 added a provider-level can_bill_independently flag to gate
-- credentialing eligibility. That was the wrong model: billing independence is
-- NOT a provider attribute — it is determined by CONTRACT status. A direct
-- provider_payer_networks row means the provider bills independently with that
-- payer; a supervision_relationships row means they bill supervised. That contract
-- data is the single source of truth (see v_bookable_provider_payer), and a resident
-- physician with a direct contract bills independently just like anyone else.
--
-- Credentialing is therefore OPEN for all providers (no provider-level gate), and
-- this flag is removed to avoid a second, contradicting source of truth.
--
-- Run MANUALLY in the Supabase SQL editor. Idempotent.
--
-- NOTE: 089's Godfrey data fix (provider_type='psychologist', role='provider') is
-- intentionally NOT reverted — those values are correct and unrelated to the flag.

BEGIN;

ALTER TABLE providers DROP COLUMN IF EXISTS can_bill_independently;

COMMIT;

-- Verification (column should be gone):
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'providers' AND column_name = 'can_bill_independently';
--   -- expect: 0 rows
