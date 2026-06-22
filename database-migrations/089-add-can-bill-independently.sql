-- 089: Add providers.can_bill_independently
--
-- Explicit per-provider flag. TRUE = independently-licensed (attending-equivalent);
-- the provider can credential/bill on their own. Replaces the old role-string
-- matching ("role contains 'psychiatrist'") that decided credentialing eligibility,
-- which blocked non-MD providers (PhD psychologists, LCSWs) from credentialing with
-- payers flagged requires_attending.
--
-- This also reframes payers.requires_attending to mean "requires an independently-
-- licensed provider (no trainees)" — the column name is unchanged, only its meaning
-- and the UI labels. Independent non-MDs now satisfy it.
--
-- Run MANUALLY in the Supabase SQL editor (this project has no SQL-exec RPC).
-- Idempotent.

BEGIN;

-- 1. Column. Conservative default: FALSE (trainees / unknowns are not independent).
ALTER TABLE providers
  ADD COLUMN IF NOT EXISTS can_bill_independently boolean NOT NULL DEFAULT false;

-- 2. Backfill from provider_type (matches the fallback used in selection-stats route).
UPDATE providers SET can_bill_independently = true
  WHERE provider_type IN ('attending physician', 'psychologist');

UPDATE providers SET can_bill_independently = false
  WHERE provider_type IN ('resident physician', 'social worker');
  -- NOTE: existing LICENSED social workers (LCSW) also land here as FALSE, because
  -- provider_type cannot distinguish LCSW from a pre-licensure CSW. Flip any real
  -- LCSW to TRUE individually after reviewing the audit query below.

-- 3. Targeted fix for Donald "Andy" Godfrey (PhD). Migration 078 seeded him with
--    provider_type/role NULL. Natural key = NPI. COALESCE keeps any value already set.
UPDATE providers
SET provider_type          = COALESCE(provider_type, 'psychologist'),
    role                   = COALESCE(role, 'provider'),
    can_bill_independently = true,
    modified_date          = NOW()
WHERE npi = '1548077837';

COMMIT;

-- ── Verification ────────────────────────────────────────────────────────────
-- Godfrey should read: psychologist | provider | t
--   SELECT first_name, last_name, provider_type, role, can_bill_independently
--   FROM providers WHERE npi = '1548077837';
--
-- Distribution audit (sanity-check the backfill, spot LCSWs that should be TRUE):
--   SELECT provider_type, can_bill_independently, count(*)
--   FROM providers GROUP BY 1, 2 ORDER BY 1, 2;
--
-- Physician-eligibility regression audit — expect ZERO rows. Any row is a provider
-- whose credentialing eligibility changed vs. the old role-string logic; review each:
--   SELECT id, first_name, last_name, role, provider_type, can_bill_independently
--   FROM providers
--   WHERE (lower(coalesce(role,'')) LIKE '%psychiatrist%'
--          AND lower(coalesce(role,'')) NOT LIKE '%resident%')
--         <> can_bill_independently;
