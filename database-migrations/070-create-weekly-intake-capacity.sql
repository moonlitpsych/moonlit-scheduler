-- Weekly Intake Capacity Table
-- Stores per-provider intake slot counts for each week
-- Updated by Claude during Monday screenshot review sessions

CREATE TABLE IF NOT EXISTS weekly_intake_capacity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL,  -- Monday of the week (ISO week start)
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  slot_count INTEGER NOT NULL DEFAULT 0 CHECK (slot_count >= 0),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Each provider can only have one entry per week
  UNIQUE(week_start, provider_id)
);

-- Index for efficient weekly lookups
CREATE INDEX IF NOT EXISTS idx_weekly_intake_capacity_week
  ON weekly_intake_capacity(week_start);

-- Index for provider lookups
CREATE INDEX IF NOT EXISTS idx_weekly_intake_capacity_provider
  ON weekly_intake_capacity(provider_id);

-- Comment for documentation
COMMENT ON TABLE weekly_intake_capacity IS
  'Tracks weekly intake appointment capacity per provider. Updated each Monday via Claude Code session.';

COMMENT ON COLUMN weekly_intake_capacity.week_start IS
  'Monday of the week (ISO week). Use date_trunc(''week'', date) to get this value.';

COMMENT ON COLUMN weekly_intake_capacity.slot_count IS
  'Number of 60-minute intake slots available for this provider this week.';
