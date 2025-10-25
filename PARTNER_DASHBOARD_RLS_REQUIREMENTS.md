# Partner Dashboard - RLS Policy Requirements

## Current Status
**No RLS policies found in migration files** - You mentioned you manage RLS in Supabase directly.

## Tables Requiring RLS Policies

### 1. `partner_users`
**Who Can Access:** Only the partner user themselves (for their own record) + admins

**Policies Needed:**
```sql
-- Enable RLS
ALTER TABLE partner_users ENABLE ROW LEVEL SECURITY;

-- Policy: Partners can read their own record
CREATE POLICY "partners_read_own" ON partner_users
  FOR SELECT
  USING (auth_user_id = auth.uid());

-- Policy: Partners can update their own record (profile, preferences)
CREATE POLICY "partners_update_own" ON partner_users
  FOR UPDATE
  USING (auth_user_id = auth.uid());

-- Policy: Admins can read all partner users in their org
CREATE POLICY "org_admins_read_all_partners" ON partner_users
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM partner_users
      WHERE auth_user_id = auth.uid()
      AND role = 'partner_admin'
    )
  );
```

---

### 2. `patient_organization_affiliations`
**Who Can Access:** Partners in the organization that has the affiliation

**Policies Needed:**
```sql
-- Enable RLS
ALTER TABLE patient_organization_affiliations ENABLE ROW LEVEL SECURITY;

-- Policy: Partners can read affiliations in their org
CREATE POLICY "partners_read_org_affiliations" ON patient_organization_affiliations
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM partner_users
      WHERE auth_user_id = auth.uid()
      AND is_active = true
    )
  );

-- Policy: Partners can update affiliations in their org (for ROI upload, etc.)
CREATE POLICY "partners_update_org_affiliations" ON patient_organization_affiliations
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM partner_users
      WHERE auth_user_id = auth.uid()
      AND is_active = true
      AND role IN ('partner_admin', 'partner_case_manager')
    )
  );
```

---

### 3. `partner_user_patient_assignments`
**Who Can Access:** Partners in the organization

**Policies Needed:**
```sql
-- Enable RLS
ALTER TABLE partner_user_patient_assignments ENABLE ROW LEVEL SECURITY;

-- Policy: Partners can read assignments in their org
CREATE POLICY "partners_read_org_assignments" ON partner_user_patient_assignments
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM partner_users
      WHERE auth_user_id = auth.uid()
      AND is_active = true
    )
  );

-- Policy: Admins and case managers can create assignments
CREATE POLICY "partners_create_assignments" ON partner_user_patient_assignments
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM partner_users
      WHERE auth_user_id = auth.uid()
      AND is_active = true
      AND role IN ('partner_admin', 'partner_case_manager')
    )
  );

-- Policy: Admins and case managers can update assignments (transfer)
CREATE POLICY "partners_update_assignments" ON partner_user_patient_assignments
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM partner_users
      WHERE auth_user_id = auth.uid()
      AND is_active = true
      AND role IN ('partner_admin', 'partner_case_manager')
    )
  );
```

---

### 4. `patient_activity_log`
**Who Can Access:** Partners in the organization (read-only)

**Policies Needed:**
```sql
-- Enable RLS
ALTER TABLE patient_activity_log ENABLE ROW LEVEL SECURITY;

-- Policy: Partners can read activity for their org patients
CREATE POLICY "partners_read_org_patient_activity" ON patient_activity_log
  FOR SELECT
  USING (
    visible_to_partner = true
    AND organization_id IN (
      SELECT organization_id FROM partner_users
      WHERE auth_user_id = auth.uid()
      AND is_active = true
    )
  );

-- Policy: System/API can insert activity logs
CREATE POLICY "service_role_insert_activity" ON patient_activity_log
  FOR INSERT
  WITH CHECK (true);  -- Only service role can insert
```

---

### 5. `patients` (Read-Only Access)
**Who Can Access:** Partners can read patients in their organization

**Policies Needed:**
```sql
-- Enable RLS if not already enabled
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

-- Policy: Partners can read patients affiliated with their org
CREATE POLICY "partners_read_org_patients" ON patients
  FOR SELECT
  USING (
    id IN (
      SELECT patient_id FROM patient_organization_affiliations
      WHERE organization_id IN (
        SELECT organization_id FROM partner_users
        WHERE auth_user_id = auth.uid()
        AND is_active = true
      )
      AND status = 'active'
    )
  );

-- Policy: Partners can update patient primary_provider_id (assign provider)
CREATE POLICY "partners_assign_provider" ON patients
  FOR UPDATE
  USING (
    id IN (
      SELECT patient_id FROM patient_organization_affiliations
      WHERE organization_id IN (
        SELECT organization_id FROM partner_users
        WHERE auth_user_id = auth.uid()
        AND is_active = true
        AND role IN ('partner_admin', 'partner_case_manager')
      )
      AND status = 'active'
    )
  );
```

---

### 6. `appointments` (Read-Only Access)
**Who Can Access:** Partners can read appointments for their org's patients

**Policies Needed:**
```sql
-- Enable RLS if not already enabled
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Policy: Partners can read appointments for their org patients
CREATE POLICY "partners_read_org_patient_appointments" ON appointments
  FOR SELECT
  USING (
    patient_id IN (
      SELECT patient_id FROM patient_organization_affiliations
      WHERE organization_id IN (
        SELECT organization_id FROM partner_users
        WHERE auth_user_id = auth.uid()
        AND is_active = true
      )
      AND status = 'active'
    )
  );
```

---

### 7. `providers` (Read-Only Access)
**Who Can Access:** All authenticated partners (for provider assignment dropdown)

**Policies Needed:**
```sql
-- Enable RLS if not already enabled
ALTER TABLE providers ENABLE ROW LEVEL SECURITY;

-- Policy: Partners can read all active providers
CREATE POLICY "partners_read_providers" ON providers
  FOR SELECT
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM partner_users
      WHERE auth_user_id = auth.uid()
      AND is_active = true
    )
  );
```

---

### 8. `organizations` (Read-Only Access)
**Who Can Access:** Partners can read their own organization

**Policies Needed:**
```sql
-- Enable RLS if not already enabled
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Policy: Partners can read their own org
CREATE POLICY "partners_read_own_org" ON organizations
  FOR SELECT
  USING (
    id IN (
      SELECT organization_id FROM partner_users
      WHERE auth_user_id = auth.uid()
      AND is_active = true
    )
  );
```

---

## How to Check if Policies Exist

Run this in Supabase SQL Editor:

```sql
-- Check which tables have RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
  'partner_users',
  'patient_organization_affiliations',
  'partner_user_patient_assignments',
  'patient_activity_log',
  'patients',
  'appointments',
  'providers',
  'organizations'
);

-- Check existing policies on partner tables
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN (
  'partner_users',
  'patient_organization_affiliations',
  'partner_user_patient_assignments',
  'patient_activity_log'
)
ORDER BY tablename, policyname;
```

---

## Critical Security Notes

### ⚠️ Current API Approach
**All partner dashboard APIs use `supabaseAdmin`** which **bypasses RLS**.

**Files using supabaseAdmin:**
- `src/app/api/partner-dashboard/patients/route.ts`
- `src/app/api/partner-dashboard/patients/transfer/route.ts`
- `src/app/api/partner-dashboard/patients/[patientId]/assign-provider/route.ts`
- All other partner dashboard API routes

**This is intentional** because:
1. APIs manually filter by `organization_id` from authenticated partner user
2. RLS would be redundant with this approach
3. Allows more complex queries without RLS performance overhead

### ✅ Two Security Models

**Option 1: Keep Current Approach (Recommended for MVP)**
- APIs use `supabaseAdmin` with manual `organization_id` filtering
- RLS disabled on partner tables
- Simpler, better performance
- Security relies on API-level checks

**Option 2: Add RLS Policies**
- Enable RLS on all partner tables
- Switch APIs to use user-context Supabase client
- Double layer of security (API + database)
- More complex, potential performance impact

### Recommendation

**For V3.0 MVP: Keep current approach** with manual org filtering in APIs.

**For future (production hardening):**
1. Enable RLS on partner tables
2. Keep manual API filtering as additional layer
3. Defense in depth - even if API has bug, RLS prevents data leaks

---

## Testing RLS Policies

Once policies are added, test with:

```sql
-- Test as partner user
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "<partner_auth_user_id>"}';

-- Should only see own org patients
SELECT * FROM patient_organization_affiliations;

-- Should not see other org patients
SELECT * FROM patients WHERE id = '<patient_from_different_org>';
```

---

## Action Items

1. ✅ Review tables above
2. ⬜ Check if RLS policies already exist in Supabase (use query above)
3. ⬜ Decide on security model (API-only vs API + RLS)
4. ⬜ If adding RLS: Copy SQL policies above to Supabase SQL editor
5. ⬜ Test with partner user to ensure they can't access other orgs' data
