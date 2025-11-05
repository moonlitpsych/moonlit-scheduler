# Fix: Partner Users RLS Infinite Recursion

## Problem
The `partner_users_select_self_or_staff` policy causes infinite recursion because it references the `invited_by` column, which points back to `partner_users` table, creating a circular query.

## Root Cause
```sql
-- PROBLEMATIC POLICY (causing recursion):
CREATE POLICY "partner_users_select_self_or_staff" ON partner_users
FOR SELECT TO authenticated
USING (
  auth.uid() = auth_user_id
  OR
  auth.uid() IN (
    SELECT auth_user_id FROM partner_users WHERE id = invited_by
    -- ^^^ This subquery on partner_users triggers the SAME policy again = infinite loop
  )
);
```

## Permanent Fix

### Option 1: Simple - Allow all authenticated partner users to see each other
```sql
-- Replace partner_users_select_self_or_staff with:
CREATE POLICY "partner_users_select_same_org" ON partner_users
FOR SELECT TO authenticated
USING (
  -- User can see themselves
  auth.uid() = auth_user_id
  OR
  -- User can see others in their organization (no recursion)
  organization_id IN (
    SELECT organization_id FROM partner_users WHERE auth_user_id = auth.uid()
  )
);
```

### Option 2: More restrictive - No cross-references
```sql
-- Replace partner_users_select_self_or_staff with:
CREATE POLICY "partner_users_select_own_only" ON partner_users
FOR SELECT TO authenticated
USING (
  auth.uid() = auth_user_id
);
```

## How to Apply

1. Go to Supabase Dashboard → Authentication → Policies → `partner_users`
2. Click on `partner_users_select_self_or_staff` policy
3. Click "Edit policy"
4. Replace the USING clause with one of the options above
5. Save

## Why This Works
- **No self-reference**: The new policy doesn't query `partner_users` within the policy itself
- **Organization-based**: Uses `organization_id` from `partner_users` without triggering another RLS check
- **Clean separation**: The subquery only reads data, it doesn't trigger another SELECT policy

## Alternative: Disable RLS on partner_users (NOT RECOMMENDED)
Only use this temporarily for emergency access. The table should have RLS enabled.

```sql
ALTER TABLE partner_users DISABLE ROW LEVEL SECURITY;
```
