-- Migration 069: Add staff RLS policy to partner_users table
-- Purpose: Allow Moonlit staff/admins to read all partner users for impersonation
-- Date: 2025-11-27

-- The partner_users table lacks a policy for staff to read all partners.
-- This prevents the admin partner impersonation feature from working.

-- Add policy allowing staff to SELECT all partner_users
CREATE POLICY partner_users_staff_select_all
ON partner_users
FOR SELECT
TO authenticated
USING (is_staff(auth.uid()));

-- Verify the policy was created
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'partner_users'
    AND policyname = 'partner_users_staff_select_all'
  ) THEN
    RAISE NOTICE 'SUCCESS: partner_users_staff_select_all policy created';
  ELSE
    RAISE EXCEPTION 'FAILED: Policy was not created';
  END IF;
END $$;
