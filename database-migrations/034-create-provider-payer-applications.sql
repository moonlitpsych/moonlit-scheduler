-- Migration: Create provider_payer_applications table
-- Description: Tracks credentialing application status and submission details per provider-payer
-- Created: 2025-10-28

-- ============================================================================
-- TABLE: provider_payer_applications
-- ============================================================================
-- Tracks the application and approval status for each provider-payer relationship.
-- This is separate from provider_payer_networks which tracks the final contract.
-- This table tracks the credentialing journey BEFORE the contract is active.

CREATE TABLE IF NOT EXISTS provider_payer_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  payer_id UUID NOT NULL REFERENCES payers(id) ON DELETE CASCADE,

  -- Application workflow status
  application_status TEXT NOT NULL DEFAULT 'not_started' CHECK (application_status IN (
    'not_started',        -- Provider selected for credentialing but not yet submitted
    'in_progress',        -- Application being prepared
    'submitted',          -- Application submitted to payer
    'under_review',       -- Payer is reviewing application
    'approved',           -- Credentialing approved (ready to create contract)
    'denied',             -- Application denied by payer
    'on_hold',            -- Application paused (missing info, waiting for provider)
    'withdrawn'           -- Provider withdrew application
  )),

  -- Key dates
  application_started_date DATE,              -- When credentialing was initiated
  application_submitted_date DATE,            -- When application was submitted to payer
  expected_decision_date DATE,                -- Expected approval date
  approval_date DATE,                         -- When payer approved
  denial_date DATE,                           -- When payer denied
  effective_date DATE,                        -- When provider can start seeing patients

  -- Application tracking IDs
  caqh_application_id TEXT,                   -- CAQH reference number
  payer_application_id TEXT,                  -- Payer-specific application ID
  portal_reference TEXT,                      -- Portal confirmation number

  -- Denial information
  denial_reason TEXT,
  reapplication_eligible BOOLEAN DEFAULT true,
  reapplication_date DATE,

  -- Contact tracking
  payer_contact_name TEXT,
  payer_contact_email TEXT,
  payer_contact_phone TEXT,
  last_contact_date DATE,

  -- Notes and documentation
  notes TEXT,
  submission_method TEXT,  -- 'online_portal', 'email', 'fax', 'excel_roster'
  confirmation_email_url TEXT,  -- Link to confirmation email/screenshot

  -- Audit trail
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT,
  updated_by TEXT,

  -- Constraints
  CONSTRAINT unique_provider_payer_application UNIQUE(provider_id, payer_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_applications_provider ON provider_payer_applications(provider_id);
CREATE INDEX idx_applications_payer ON provider_payer_applications(payer_id);
CREATE INDEX idx_applications_status ON provider_payer_applications(application_status);
CREATE INDEX idx_applications_submitted_date ON provider_payer_applications(application_submitted_date);
CREATE INDEX idx_applications_expected_decision ON provider_payer_applications(expected_decision_date)
  WHERE application_status IN ('submitted', 'under_review');

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE provider_payer_applications ENABLE ROW LEVEL SECURITY;

-- Admin read access
CREATE POLICY admin_read_applications
  ON provider_payer_applications
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
CREATE POLICY admin_write_applications
  ON provider_payer_applications
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

CREATE OR REPLACE FUNCTION update_application_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_application_timestamp
  BEFORE UPDATE ON provider_payer_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_application_updated_at();

-- ============================================================================
-- TRIGGER: Auto-set status dates
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_set_application_dates()
RETURNS TRIGGER AS $$
BEGIN
  -- Set application_started_date on first non-not_started status
  IF NEW.application_status != 'not_started'
     AND OLD.application_status = 'not_started'
     AND NEW.application_started_date IS NULL
  THEN
    NEW.application_started_date = CURRENT_DATE;
  END IF;

  -- Set application_submitted_date when status changes to 'submitted'
  IF NEW.application_status IN ('submitted', 'under_review')
     AND OLD.application_status IN ('not_started', 'in_progress', 'on_hold')
     AND NEW.application_submitted_date IS NULL
  THEN
    NEW.application_submitted_date = CURRENT_DATE;
  END IF;

  -- Set approval_date when status changes to 'approved'
  IF NEW.application_status = 'approved'
     AND OLD.application_status != 'approved'
     AND NEW.approval_date IS NULL
  THEN
    NEW.approval_date = CURRENT_DATE;
  END IF;

  -- Set denial_date when status changes to 'denied'
  IF NEW.application_status = 'denied'
     AND OLD.application_status != 'denied'
     AND NEW.denial_date IS NULL
  THEN
    NEW.denial_date = CURRENT_DATE;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_set_application_dates
  BEFORE UPDATE ON provider_payer_applications
  FOR EACH ROW
  WHEN (OLD.application_status IS DISTINCT FROM NEW.application_status)
  EXECUTE FUNCTION auto_set_application_dates();

-- ============================================================================
-- TRIGGER: Auto-create contract on approval
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_create_contract_on_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- When application is approved, create a contract in provider_payer_networks
  -- (if one doesn't already exist)
  IF NEW.application_status = 'approved' AND OLD.application_status != 'approved' THEN
    INSERT INTO provider_payer_networks (
      provider_id,
      payer_id,
      status,
      effective_date,
      notes
    )
    VALUES (
      NEW.provider_id,
      NEW.payer_id,
      'in_network',
      COALESCE(NEW.effective_date, CURRENT_DATE),
      'Auto-created from approved credentialing application ' || NEW.id
    )
    ON CONFLICT (provider_id, payer_id) DO UPDATE
    SET
      status = 'in_network',
      effective_date = COALESCE(EXCLUDED.effective_date, provider_payer_networks.effective_date),
      notes = COALESCE(
        provider_payer_networks.notes || E'\n' || 'Updated from approved application ' || NEW.id,
        'Updated from approved application ' || NEW.id
      ),
      updated_at = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_create_contract
  AFTER UPDATE ON provider_payer_applications
  FOR EACH ROW
  WHEN (NEW.application_status = 'approved' AND OLD.application_status != 'approved')
  EXECUTE FUNCTION auto_create_contract_on_approval();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get credentialing pipeline summary
CREATE OR REPLACE FUNCTION get_credentialing_pipeline_summary()
RETURNS TABLE (
  application_status TEXT,
  count INTEGER,
  avg_days_in_status NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ppa.application_status,
    COUNT(*)::INTEGER AS count,
    ROUND(
      AVG(CURRENT_DATE - COALESCE(
        ppa.application_submitted_date,
        ppa.application_started_date,
        ppa.created_at::DATE
      ))
    ) AS avg_days_in_status
  FROM provider_payer_applications ppa
  WHERE ppa.application_status NOT IN ('approved', 'denied', 'withdrawn')
  GROUP BY ppa.application_status
  ORDER BY
    CASE ppa.application_status
      WHEN 'under_review' THEN 1
      WHEN 'submitted' THEN 2
      WHEN 'in_progress' THEN 3
      WHEN 'on_hold' THEN 4
      WHEN 'not_started' THEN 5
      ELSE 6
    END;
END;
$$ LANGUAGE plpgsql;

-- Function to find overdue applications
CREATE OR REPLACE FUNCTION get_overdue_applications()
RETURNS TABLE (
  application_id UUID,
  provider_id UUID,
  provider_name TEXT,
  payer_id UUID,
  payer_name TEXT,
  application_status TEXT,
  days_overdue INTEGER,
  expected_decision_date DATE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ppa.id AS application_id,
    ppa.provider_id,
    (pr.first_name || ' ' || pr.last_name) AS provider_name,
    ppa.payer_id,
    p.name AS payer_name,
    ppa.application_status,
    (CURRENT_DATE - ppa.expected_decision_date)::INTEGER AS days_overdue,
    ppa.expected_decision_date
  FROM provider_payer_applications ppa
  JOIN providers pr ON ppa.provider_id = pr.id
  JOIN payers p ON ppa.payer_id = p.id
  WHERE ppa.expected_decision_date < CURRENT_DATE
    AND ppa.application_status IN ('submitted', 'under_review', 'in_progress')
  ORDER BY days_overdue DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE provider_payer_applications IS 'Tracks credentialing application journey from initiation to approval/denial, before contract activation';
COMMENT ON COLUMN provider_payer_applications.application_status IS 'Current stage of credentialing: not_started, in_progress, submitted, under_review, approved, denied, on_hold, withdrawn';
COMMENT ON COLUMN provider_payer_applications.effective_date IS 'Date when provider can start seeing patients (may differ from approval_date)';
COMMENT ON TRIGGER trigger_auto_create_contract ON provider_payer_applications IS 'Automatically creates provider_payer_networks entry when application is approved';
