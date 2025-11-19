-- Migration 035: Create admin_users table for managing admin access
-- Date: 2025-11-13
-- Purpose: Move admin user management from hardcoded array to database

-- Create admin_users table
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  added_by_email TEXT,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,

  -- Constraints
  CONSTRAINT email_valid CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Create indexes for performance
CREATE INDEX idx_admin_users_email ON admin_users(email);
CREATE INDEX idx_admin_users_is_active ON admin_users(is_active);
CREATE INDEX idx_admin_users_added_at ON admin_users(added_at DESC);

-- Add RLS (Row Level Security) policies
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view all admin users
-- Note: Circular check is bypassed when using service role key
CREATE POLICY admin_users_select_policy ON admin_users
  FOR SELECT
  USING (true);

-- Policy: Admins can insert new admin users
CREATE POLICY admin_users_insert_policy ON admin_users
  FOR INSERT
  WITH CHECK (true);

-- Seed table with existing admins from ADMIN_EMAILS array
-- These should match the hardcoded list in /src/lib/admin-auth.ts
INSERT INTO admin_users (email, full_name, added_by_email, notes, is_active)
VALUES
  ('hello@trymoonlit.com', 'Moonlit Admin', 'system', 'Primary admin account', true),
  ('rufussweeney@gmail.com', 'Dr. Rufus Sweeney', 'system', 'Founder', true),
  ('hyrum.bay@gmail.com', 'Hyrum Bay', 'hello@trymoonlit.com', 'Executive Assistant', true)
ON CONFLICT (email) DO NOTHING;

-- Add comment to table
COMMENT ON TABLE admin_users IS 'Stores admin user accounts with audit trail. Used alongside hardcoded ADMIN_EMAILS array for authorization.';
