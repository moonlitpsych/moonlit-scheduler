-- Admin Action Logs Table
-- Tracks all actions performed by admins on behalf of providers during impersonation

CREATE TABLE IF NOT EXISTS admin_action_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_email TEXT NOT NULL,
    provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    description TEXT NOT NULL,
    table_name TEXT,
    record_id TEXT,
    changes JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for efficient querying by admin
CREATE INDEX idx_admin_action_logs_admin_email ON admin_action_logs(admin_email);

-- Index for efficient querying by provider
CREATE INDEX idx_admin_action_logs_provider_id ON admin_action_logs(provider_id);

-- Index for efficient querying by action type
CREATE INDEX idx_admin_action_logs_action_type ON admin_action_logs(action_type);

-- Index for efficient querying by date
CREATE INDEX idx_admin_action_logs_created_at ON admin_action_logs(created_at DESC);

-- Comments for documentation
COMMENT ON TABLE admin_action_logs IS 'Audit log of all admin actions performed on behalf of providers during impersonation';
COMMENT ON COLUMN admin_action_logs.admin_email IS 'Email of the admin who performed the action';
COMMENT ON COLUMN admin_action_logs.provider_id IS 'ID of the provider whose account was being impersonated';
COMMENT ON COLUMN admin_action_logs.action_type IS 'Type of action (e.g., impersonation_start, impersonation_switch, availability_update, profile_update)';
COMMENT ON COLUMN admin_action_logs.description IS 'Human-readable description of the action';
COMMENT ON COLUMN admin_action_logs.table_name IS 'Database table affected by the action (if applicable)';
COMMENT ON COLUMN admin_action_logs.record_id IS 'ID of the record that was modified (if applicable)';
COMMENT ON COLUMN admin_action_logs.changes IS 'JSON object containing before/after values for auditing';
