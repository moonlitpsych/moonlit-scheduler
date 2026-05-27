-- Migration 087: Fix infinite recursion in partner_users RLS policies
--
-- Problem: Five SELECT/INSERT/UPDATE/DELETE policies on partner_users contain
-- subqueries of the form `EXISTS (SELECT ... FROM partner_users ...)` or
-- `IN (SELECT ... FROM partner_users ...)`. Postgres re-applies the table's
-- RLS to those inner reads, which re-evaluates the same policy, producing
-- "infinite recursion detected in policy for relation 'partner_users'"
-- (SQLSTATE 42P17). This breaks the admin dashboard, which queries
-- partner_users from the browser via auth-context.ts.
--
-- Fix: Move the self-referential reads into SECURITY DEFINER functions.
-- SECURITY DEFINER functions run with the function-owner's privileges and
-- bypass RLS on the inner query, so the recursion is broken.
--
-- Affected policies (all dropped and recreated):
--   - partner_users_admin_delete_org_safe
--   - partner_users_admin_insert_org_safe
--   - partner_users_admin_read_org_safe
--   - partner_users_admin_update_org_safe
--   - partner_users_select_self_or_staff
--
-- Unchanged (already safe — no self-reference):
--   - partner_users_select_own, partner_users_self_read (duplicates),
--     partner_users_self_update, partner_users_staff_select_all

-- 1. Helper: is the current user a partner_admin of the given org?
CREATE OR REPLACE FUNCTION public.is_partner_admin_for_org(target_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM partner_users
    WHERE auth_user_id = auth.uid()
      AND organization_id = target_org_id
      AND role = 'partner_admin'
      AND is_active = true
  );
$$;

REVOKE ALL ON FUNCTION public.is_partner_admin_for_org(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_partner_admin_for_org(uuid) TO authenticated;

-- 2. Helper: org_ids the current user belongs to (used by select_self_or_staff)
CREATE OR REPLACE FUNCTION public.my_partner_org_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM partner_users
  WHERE auth_user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.my_partner_org_ids() FROM public;
GRANT EXECUTE ON FUNCTION public.my_partner_org_ids() TO authenticated;

-- 3. Helper: does ANY partner_users row exist? (used by the "bootstrap"
-- branch of the *_org_safe policies — they allow the very first insert
-- when the table is empty)
CREATE OR REPLACE FUNCTION public.partner_users_is_empty()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (SELECT 1 FROM partner_users LIMIT 1);
$$;

REVOKE ALL ON FUNCTION public.partner_users_is_empty() FROM public;
GRANT EXECUTE ON FUNCTION public.partner_users_is_empty() TO authenticated;

-- 4. Drop the recursive policies
DROP POLICY IF EXISTS partner_users_admin_delete_org_safe ON partner_users;
DROP POLICY IF EXISTS partner_users_admin_insert_org_safe ON partner_users;
DROP POLICY IF EXISTS partner_users_admin_read_org_safe ON partner_users;
DROP POLICY IF EXISTS partner_users_admin_update_org_safe ON partner_users;
DROP POLICY IF EXISTS partner_users_select_self_or_staff ON partner_users;

-- 5. Recreate them using the SECURITY DEFINER helpers
CREATE POLICY partner_users_admin_delete_org_safe
ON partner_users
FOR DELETE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    partner_users_is_empty()
    OR is_partner_admin_for_org(organization_id)
  )
);

CREATE POLICY partner_users_admin_insert_org_safe
ON partner_users
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    partner_users_is_empty()
    OR is_partner_admin_for_org(organization_id)
  )
);

CREATE POLICY partner_users_admin_read_org_safe
ON partner_users
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    partner_users_is_empty()
    OR is_partner_admin_for_org(organization_id)
  )
);

CREATE POLICY partner_users_admin_update_org_safe
ON partner_users
FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    partner_users_is_empty()
    OR is_partner_admin_for_org(organization_id)
  )
);

CREATE POLICY partner_users_select_self_or_staff
ON partner_users
FOR SELECT
TO authenticated
USING (
  auth.uid() = auth_user_id
  OR organization_id IN (SELECT my_partner_org_ids())
);

-- 6. Sanity check
DO $$
DECLARE
  policy_count int;
BEGIN
  SELECT count(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'partner_users'
    AND policyname IN (
      'partner_users_admin_delete_org_safe',
      'partner_users_admin_insert_org_safe',
      'partner_users_admin_read_org_safe',
      'partner_users_admin_update_org_safe',
      'partner_users_select_self_or_staff'
    );
  IF policy_count <> 5 THEN
    RAISE EXCEPTION 'Expected 5 recreated policies on partner_users, found %', policy_count;
  END IF;
  RAISE NOTICE 'SUCCESS: 5 partner_users policies recreated without recursion';
END $$;
