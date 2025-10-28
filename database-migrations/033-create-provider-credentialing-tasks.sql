-- Migration: Create provider_credentialing_tasks table
-- Description: Tracks credentialing to-do items for each provider-payer relationship
-- Created: 2025-10-28

-- ============================================================================
-- TABLE: provider_credentialing_tasks
-- ============================================================================
-- Individual credentialing tasks for providers. Tasks are generated from
-- payer_credentialing_workflows templates when a provider is selected to be
-- credentialed with a specific payer.

CREATE TABLE IF NOT EXISTS provider_credentialing_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  payer_id UUID REFERENCES payers(id) ON DELETE CASCADE,  -- NULL for general onboarding tasks

  -- Task definition
  task_type TEXT NOT NULL,  -- e.g., 'license_upload', 'npi_verification', 'malpractice_insurance',
                             -- 'caqh_profile', 'payer_application', 'portal_credentials',
                             -- 'excel_submission', 'roster_notification', etc.

  title TEXT NOT NULL,
  description TEXT,

  -- Status tracking
  task_status TEXT NOT NULL DEFAULT 'pending' CHECK (task_status IN (
    'pending',          -- Not started
    'in_progress',      -- Currently being worked on
    'completed',        -- Finished
    'blocked',          -- Waiting on external dependency
    'not_applicable'    -- Not needed for this provider/payer
  )),

  -- Timeline
  due_date DATE,
  completed_date DATE,
  estimated_days INTEGER,  -- How long this task typically takes

  -- Task order (for sequential workflows)
  task_order INTEGER DEFAULT 0,

  -- Additional details
  notes TEXT,
  uploaded_document_url TEXT,  -- Link to uploaded credential document

  -- Assignment
  assigned_to TEXT,  -- Admin email

  -- Application tracking (for payer application tasks)
  application_id TEXT,        -- Reference number from payer portal
  portal_url TEXT,            -- Direct link to application status

  -- Audit trail
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT,
  updated_by TEXT
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_credentialing_tasks_provider ON provider_credentialing_tasks(provider_id);
CREATE INDEX idx_credentialing_tasks_payer ON provider_credentialing_tasks(payer_id);
CREATE INDEX idx_credentialing_tasks_status ON provider_credentialing_tasks(task_status);
CREATE INDEX idx_credentialing_tasks_assigned ON provider_credentialing_tasks(assigned_to);
CREATE INDEX idx_credentialing_tasks_due_date ON provider_credentialing_tasks(due_date) WHERE task_status IN ('pending', 'in_progress');

-- Composite index for common query pattern
CREATE INDEX idx_credentialing_tasks_provider_payer ON provider_credentialing_tasks(provider_id, payer_id);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE provider_credentialing_tasks ENABLE ROW LEVEL SECURITY;

-- Admin read access
CREATE POLICY admin_read_credentialing_tasks
  ON provider_credentialing_tasks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth_profiles
      WHERE auth_profiles.id = auth.uid()
      AND auth_profiles.role = 'admin'
    )
  );

-- Admin write access
CREATE POLICY admin_write_credentialing_tasks
  ON provider_credentialing_tasks
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth_profiles
      WHERE auth_profiles.id = auth.uid()
      AND auth_profiles.role = 'admin'
    )
  );

-- ============================================================================
-- TRIGGER: Update timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_credentialing_task_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_credentialing_task_timestamp
  BEFORE UPDATE ON provider_credentialing_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_credentialing_task_updated_at();

-- ============================================================================
-- TRIGGER: Auto-set completed_date
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_set_task_completed_date()
RETURNS TRIGGER AS $$
BEGIN
  -- Set completed_date when status changes to 'completed'
  IF NEW.task_status = 'completed' AND OLD.task_status != 'completed' THEN
    NEW.completed_date = CURRENT_DATE;
  END IF;

  -- Clear completed_date if status changes away from 'completed'
  IF NEW.task_status != 'completed' AND OLD.task_status = 'completed' THEN
    NEW.completed_date = NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_set_completed_date
  BEFORE UPDATE ON provider_credentialing_tasks
  FOR EACH ROW
  WHEN (OLD.task_status IS DISTINCT FROM NEW.task_status)
  EXECUTE FUNCTION auto_set_task_completed_date();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get credentialing progress for a provider
CREATE OR REPLACE FUNCTION get_provider_credentialing_progress(p_provider_id UUID)
RETURNS TABLE (
  payer_id UUID,
  payer_name TEXT,
  total_tasks INTEGER,
  completed_tasks INTEGER,
  in_progress_tasks INTEGER,
  pending_tasks INTEGER,
  blocked_tasks INTEGER,
  completion_percentage NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pct.payer_id,
    p.name AS payer_name,
    COUNT(*)::INTEGER AS total_tasks,
    COUNT(*) FILTER (WHERE pct.task_status = 'completed')::INTEGER AS completed_tasks,
    COUNT(*) FILTER (WHERE pct.task_status = 'in_progress')::INTEGER AS in_progress_tasks,
    COUNT(*) FILTER (WHERE pct.task_status = 'pending')::INTEGER AS pending_tasks,
    COUNT(*) FILTER (WHERE pct.task_status = 'blocked')::INTEGER AS blocked_tasks,
    ROUND(
      (COUNT(*) FILTER (WHERE pct.task_status = 'completed')::NUMERIC / COUNT(*)::NUMERIC) * 100,
      1
    ) AS completion_percentage
  FROM provider_credentialing_tasks pct
  LEFT JOIN payers p ON pct.payer_id = p.id
  WHERE pct.provider_id = p_provider_id
    AND pct.task_status != 'not_applicable'
  GROUP BY pct.payer_id, p.name
  ORDER BY completion_percentage DESC, p.name;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE provider_credentialing_tasks IS 'Tracks individual credentialing to-do items for provider onboarding with payers';
COMMENT ON COLUMN provider_credentialing_tasks.task_type IS 'Type of credentialing task (license_upload, payer_application, etc.)';
COMMENT ON COLUMN provider_credentialing_tasks.task_order IS 'Order in which tasks should be completed (lower numbers first)';
COMMENT ON COLUMN provider_credentialing_tasks.estimated_days IS 'Estimated number of days to complete this task';
COMMENT ON COLUMN provider_credentialing_tasks.application_id IS 'Reference number from payer portal or CAQH';
