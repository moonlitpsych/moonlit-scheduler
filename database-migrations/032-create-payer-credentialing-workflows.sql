-- Migration: Create payer_credentialing_workflows table
-- Description: Stores different credentialing processes and requirements per payer
-- Created: 2025-10-28

-- ============================================================================
-- TABLE: payer_credentialing_workflows
-- ============================================================================
-- Tracks the specific credentialing workflow for each payer, including:
-- - Workflow type (instant network, online portal, excel submission)
-- - Portal URLs and instructions
-- - Contact information
-- - Task templates for automation

CREATE TABLE IF NOT EXISTS payer_credentialing_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payer_id UUID NOT NULL REFERENCES payers(id) ON DELETE CASCADE,

  -- Workflow configuration
  workflow_type TEXT NOT NULL CHECK (workflow_type IN (
    'instant_network',      -- No individual contract needed (practice-level)
    'online_portal',        -- Payer-specific online application portal
    'excel_submission'      -- Excel roster template submission
  )),

  -- Portal information (for online_portal type)
  portal_url TEXT,
  portal_username TEXT,
  portal_instructions TEXT,

  -- Excel template (for excel_submission type)
  excel_template_url TEXT,
  excel_submission_email TEXT,
  excel_submission_instructions TEXT,

  -- Contact information
  credentialing_contact_name TEXT,
  credentialing_contact_email TEXT,
  credentialing_contact_phone TEXT,

  -- Timeline expectations
  typical_approval_days INTEGER,  -- Expected days from submission to approval
  notes TEXT,

  -- Task templates (JSONB array of task definitions)
  -- Each task: { title: string, description: string, order: number, estimated_days: number }
  task_templates JSONB DEFAULT '[]'::jsonb,

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT,
  updated_by TEXT,

  -- Constraints
  CONSTRAINT unique_workflow_per_payer UNIQUE(payer_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_credentialing_workflow_payer ON payer_credentialing_workflows(payer_id);
CREATE INDEX idx_credentialing_workflow_type ON payer_credentialing_workflows(workflow_type);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE payer_credentialing_workflows ENABLE ROW LEVEL SECURITY;

-- Admin read access
CREATE POLICY admin_read_credentialing_workflows
  ON payer_credentialing_workflows
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
CREATE POLICY admin_write_credentialing_workflows
  ON payer_credentialing_workflows
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
-- SEED DATA
-- ============================================================================
-- Populate with example workflows for existing payers

-- Note: This is a placeholder - actual payer IDs should be populated based on production data
-- Run this query to get payer IDs:
-- SELECT id, name, requires_individual_contract FROM payers ORDER BY name;

-- Example seed (uncomment and update with real payer IDs):
/*
INSERT INTO payer_credentialing_workflows (payer_id, workflow_type, task_templates, notes)
VALUES
  (
    (SELECT id FROM payers WHERE name = 'Molina Healthcare of Utah' LIMIT 1),
    'online_portal',
    '[
      {"title": "Obtain portal credentials", "description": "Get login credentials for Molina credentialing portal", "order": 1, "estimated_days": 1},
      {"title": "Submit provider application", "description": "Complete and submit application in Molina portal", "order": 2, "estimated_days": 2},
      {"title": "Record application ID", "description": "Save application reference number from portal confirmation", "order": 3, "estimated_days": 0},
      {"title": "Follow up on application status", "description": "Check portal for approval status after 30 days", "order": 4, "estimated_days": 30}
    ]'::jsonb,
    'Requires CAQH profile to be updated before submission'
  );
*/

-- ============================================================================
-- TRIGGER: Update timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_credentialing_workflow_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_credentialing_workflow_timestamp
  BEFORE UPDATE ON payer_credentialing_workflows
  FOR EACH ROW
  EXECUTE FUNCTION update_credentialing_workflow_updated_at();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE payer_credentialing_workflows IS 'Stores credentialing workflow configuration per payer for provider onboarding automation';
COMMENT ON COLUMN payer_credentialing_workflows.workflow_type IS 'Type of credentialing process: instant_network (no individual contract), online_portal (web application), excel_submission (roster template)';
COMMENT ON COLUMN payer_credentialing_workflows.task_templates IS 'JSONB array of task definitions that will be created when a provider is credentialed with this payer';
COMMENT ON COLUMN payer_credentialing_workflows.typical_approval_days IS 'Expected number of days from application submission to approval';
