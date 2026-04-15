-- Migration 075: Provider Transitions System
-- Captures planned provider lifecycle changes (resident graduation,
-- departures, terminations, leaves) so they can be reviewed in advance,
-- audited, and acted on without surprise breakage in supervision /
-- bookability.
--
-- See plan: ~/.claude/plans/starry-spinning-lerdorf.md

-- ============================================================
-- 1. Backfill columns that were added in-session without a migration
--    (residency_grad_year was added directly to the DB; residency_grad_month
--    was added via Supabase MCP `add_residency_grad_month`). Capturing them
--    here makes the schema reproducible from migrations alone.
-- ============================================================

ALTER TABLE providers
  ADD COLUMN IF NOT EXISTS residency_grad_year integer;

ALTER TABLE providers
  ADD COLUMN IF NOT EXISTS residency_grad_month smallint
    CHECK (residency_grad_month IS NULL OR residency_grad_month BETWEEN 1 AND 12);

COMMENT ON COLUMN providers.residency_grad_year IS
  'Calendar year a resident is expected to graduate; nullable for non-residents';
COMMENT ON COLUMN providers.residency_grad_month IS
  'Calendar month (1-12) of residency graduation; pairs with residency_grad_year';

-- ============================================================
-- 2. Provider transition enums + table
-- ============================================================

DO $$ BEGIN
  CREATE TYPE provider_transition_type AS ENUM (
    'residency_graduation',
    'resident_departure',
    'attending_departure',
    'attending_termination',
    'leave_of_absence',
    'return_from_leave',
    'supervision_role_change'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE provider_transition_status AS ENUM (
    'upcoming',     -- detected/created, awaiting admin review
    'in_progress',  -- admin actively working it
    'bridged',      -- supervision extended past effective_date
    'completed',    -- the transition has fully landed
    'deferred',     -- pushed out to a later date
    'cancelled'     -- transition will not happen
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS provider_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  transition_type provider_transition_type NOT NULL,
  status provider_transition_status NOT NULL DEFAULT 'upcoming',
  effective_date date NOT NULL,
  detected_at timestamptz NOT NULL DEFAULT now(),
  detected_by text NOT NULL,
  notes text,
  will_continue_at_moonlit boolean,
  interested_in_supervising boolean,
  bridge_until date,
  resolved_at timestamptz,
  resolved_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE provider_transitions IS
  'Planned provider lifecycle changes: graduations, departures, leaves. Driven by monthly cron + admin-initiated entries.';

-- One open transition per (provider, type). Closed/cancelled rows are
-- ignored by the partial index so a future graduation can be re-detected.
CREATE UNIQUE INDEX IF NOT EXISTS provider_transitions_one_open_per_provider_type
  ON provider_transitions (provider_id, transition_type)
  WHERE status IN ('upcoming', 'in_progress', 'bridged', 'deferred');

CREATE INDEX IF NOT EXISTS idx_provider_transitions_effective_date
  ON provider_transitions (effective_date)
  WHERE status IN ('upcoming', 'in_progress', 'bridged');

CREATE INDEX IF NOT EXISTS idx_provider_transitions_provider
  ON provider_transitions (provider_id);

-- Keep updated_at fresh
CREATE OR REPLACE FUNCTION set_provider_transitions_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_provider_transitions_updated_at ON provider_transitions;
CREATE TRIGGER trg_provider_transitions_updated_at
  BEFORE UPDATE ON provider_transitions
  FOR EACH ROW EXECUTE FUNCTION set_provider_transitions_updated_at();
