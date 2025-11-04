--
-- Eligibility Check Logs Table
--
-- Purpose: Store complete history of Office Ally eligibility checks including:
-- - Raw X12 270 requests and X12 271 responses
-- - Parsed rejection reasons and subscriber relationships
-- - Full audit trail for billing and support purposes
--
-- Created: 2025-11-03
-- Author: Claude Code
--

CREATE TABLE IF NOT EXISTS eligibility_check_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who ran the check
  admin_email TEXT NOT NULL,

  -- Patient information
  patient_first_name TEXT,
  patient_last_name TEXT,
  patient_dob DATE,
  patient_gender TEXT,
  patient_member_id TEXT,
  patient_group_number TEXT,

  -- Payer information
  payer_id UUID REFERENCES payers(id),
  office_ally_payer_id TEXT NOT NULL,
  payer_display_name TEXT,

  -- Eligibility result
  is_eligible BOOLEAN NOT NULL,
  coverage_status TEXT,

  -- Financial information (JSONB for flexibility)
  copay_amounts JSONB,
  deductible_info JSONB,
  extracted_patient_data JSONB,

  -- X12 rejection analysis
  parsed_rejection_reason TEXT, -- User-friendly message
  subscriber_relationship TEXT, -- 'subscriber', 'dependent', or 'unknown'
  technical_details JSONB, -- AAA, INS, MSG segments for admin debugging

  -- Raw transaction data (for debugging and compliance)
  raw_x12_270_request TEXT NOT NULL,
  raw_x12_271_response TEXT NOT NULL,

  -- Performance tracking
  response_time_ms INTEGER,

  -- Audit timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for common queries
CREATE INDEX idx_eligibility_logs_admin_email ON eligibility_check_logs(admin_email);
CREATE INDEX idx_eligibility_logs_payer ON eligibility_check_logs(payer_id);
CREATE INDEX idx_eligibility_logs_office_ally_payer ON eligibility_check_logs(office_ally_payer_id);
CREATE INDEX idx_eligibility_logs_created_at ON eligibility_check_logs(created_at DESC);
CREATE INDEX idx_eligibility_logs_patient_name ON eligibility_check_logs(patient_first_name, patient_last_name);

-- Add comment for documentation
COMMENT ON TABLE eligibility_check_logs IS 'Complete audit log of all Office Ally eligibility checks including raw X12 transactions and parsed rejection analysis';
COMMENT ON COLUMN eligibility_check_logs.technical_details IS 'JSONB containing raw AAA (rejection), INS (subscriber), and MSG (message) segments for technical debugging';
COMMENT ON COLUMN eligibility_check_logs.parsed_rejection_reason IS 'User-friendly explanation of why eligibility check failed (e.g., "Patient appears to be a dependent")';
COMMENT ON COLUMN eligibility_check_logs.subscriber_relationship IS 'Whether patient is subscriber, dependent, or unknown based on INS segment';
