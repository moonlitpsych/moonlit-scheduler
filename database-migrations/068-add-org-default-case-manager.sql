-- Migration: Add default_case_manager_id to organizations
-- Purpose: Allow organizations to have a default case manager that gets assigned
--          when patients are bulk-affiliated with the organization

-- Add the column
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS default_case_manager_id uuid REFERENCES partner_users(id);

-- Add index for lookup
CREATE INDEX IF NOT EXISTS idx_organizations_default_cm
ON organizations(default_case_manager_id)
WHERE default_case_manager_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN organizations.default_case_manager_id IS
'Default case manager assigned to patients when they are affiliated with this organization. Can be overridden per-affiliation.';
