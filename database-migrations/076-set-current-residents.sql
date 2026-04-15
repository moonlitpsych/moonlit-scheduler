-- Migration 076: Stamp residency graduation dates on the five current
-- Moonlit residents and seed their /admin/transitions rows.
--
-- INTENTIONALLY DOES NOT TOUCH providers.role — those values were already
-- meaningful (provider / psychiatrist / null) and we preserve them. The
-- transitions cron + admin API treat "resident" as "has residency_grad_year
-- with the graduation date still in the future", so the role text is not
-- needed for detection.
--
-- Provider IDs verified against the live DB before writing this migration:
--   Tatiana Kaehler   19efc9c8-3950-45c4-be1d-f0e04615e0d1   grad 2026-06
--   Rufus Sweeney     08fbcd34-cd5f-425c-85bd-1aeeffbe9694   grad 2027-06
--   Doug Sirutis      9b093465-e514-4d9f-8c45-22dcd0eb1811   grad 2027-06
--   Gisele Braga      db9ccc5b-0451-4a80-bb66-5cbcfa643460   grad 2027-06
--   Merrick Reynolds  bc0fc904-7cc9-4d22-a094-6a0eb482128d   grad 2028-06

-- ============================================================
-- 1. Stamp residency graduation date on each provider
-- ============================================================

UPDATE providers SET residency_grad_year = 2026, residency_grad_month = 6
WHERE id = '19efc9c8-3950-45c4-be1d-f0e04615e0d1';   -- Tatiana Kaehler

UPDATE providers SET residency_grad_year = 2027, residency_grad_month = 6
WHERE id = '08fbcd34-cd5f-425c-85bd-1aeeffbe9694';   -- Rufus Sweeney

UPDATE providers SET residency_grad_year = 2027, residency_grad_month = 6
WHERE id = '9b093465-e514-4d9f-8c45-22dcd0eb1811';   -- Doug Sirutis

UPDATE providers SET residency_grad_year = 2027, residency_grad_month = 6
WHERE id = 'db9ccc5b-0451-4a80-bb66-5cbcfa643460';   -- Gisele Braga

UPDATE providers SET residency_grad_year = 2028, residency_grad_month = 6
WHERE id = 'bc0fc904-7cc9-4d22-a094-6a0eb482128d';   -- Merrick Reynolds

-- ============================================================
-- 2. Seed provider_transitions rows for residents outside the cron's
--    4-month detection window so /admin/transitions is immediately
--    useful for planning. Tatiana already has a manually-created row;
--    WHERE NOT EXISTS prevents duplicates and makes this idempotent.
-- ============================================================

INSERT INTO provider_transitions (
  provider_id, transition_type, status, effective_date, detected_by
)
SELECT '08fbcd34-cd5f-425c-85bd-1aeeffbe9694', 'residency_graduation', 'upcoming', DATE '2027-07-01', 'migration:076'
WHERE NOT EXISTS (
  SELECT 1 FROM provider_transitions
  WHERE provider_id = '08fbcd34-cd5f-425c-85bd-1aeeffbe9694'
    AND transition_type = 'residency_graduation'
    AND status IN ('upcoming','in_progress','bridged','deferred')
);

INSERT INTO provider_transitions (
  provider_id, transition_type, status, effective_date, detected_by
)
SELECT '9b093465-e514-4d9f-8c45-22dcd0eb1811', 'residency_graduation', 'upcoming', DATE '2027-07-01', 'migration:076'
WHERE NOT EXISTS (
  SELECT 1 FROM provider_transitions
  WHERE provider_id = '9b093465-e514-4d9f-8c45-22dcd0eb1811'
    AND transition_type = 'residency_graduation'
    AND status IN ('upcoming','in_progress','bridged','deferred')
);

INSERT INTO provider_transitions (
  provider_id, transition_type, status, effective_date, detected_by
)
SELECT 'db9ccc5b-0451-4a80-bb66-5cbcfa643460', 'residency_graduation', 'upcoming', DATE '2027-07-01', 'migration:076'
WHERE NOT EXISTS (
  SELECT 1 FROM provider_transitions
  WHERE provider_id = 'db9ccc5b-0451-4a80-bb66-5cbcfa643460'
    AND transition_type = 'residency_graduation'
    AND status IN ('upcoming','in_progress','bridged','deferred')
);

INSERT INTO provider_transitions (
  provider_id, transition_type, status, effective_date, detected_by
)
SELECT 'bc0fc904-7cc9-4d22-a094-6a0eb482128d', 'residency_graduation', 'upcoming', DATE '2028-07-01', 'migration:076'
WHERE NOT EXISTS (
  SELECT 1 FROM provider_transitions
  WHERE provider_id = 'bc0fc904-7cc9-4d22-a094-6a0eb482128d'
    AND transition_type = 'residency_graduation'
    AND status IN ('upcoming','in_progress','bridged','deferred')
);
