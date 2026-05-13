# Finance Migrations - Schema Verification Report

**Date**: 2025-10-29
**Verification Endpoint**: `/api/debug/verify-complete-schema`

---

## Critical Finding: TABLE NAME CONFLICTS

### Problem

Migration 041 tries to create two tables that **ALREADY EXIST** but with **COMPLETELY DIFFERENT SCHEMAS**:

1. **`extracted_claims`** (existing) - Document extraction system for CMS-1500 forms
   - Has: `document_id`, `claim_id`, `claim_number`, `patient_name`, `billing_provider_npi`, etc.
   - Does NOT have: `appointment_id` (finance system needs this)

2. **`extracted_remittances`** (existing) - Document extraction system for ERA/EOB
   - Has: `document_id`, `era_id`, `eob_id`, `payer_name`, `check_number`
   - Does NOT have foreign keys to appointments or payers

### Root Cause of Migration 041 Failure

```sql
-- Migration 041 tries to create:
create table if not exists public.extracted_claims (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments(id),  -- ❌ NEW COLUMN
  ...
)
```

**What Happened:**
1. `CREATE TABLE IF NOT EXISTS` succeeds (table exists, so no error)
2. Migration 041 doesn't add the `appointment_id` column (table already exists)
3. Migration 043 tries to join: `extracted_claims.appointment_id`
4. **ERROR**: "column 'appointment_id' does not exist"

---

## Database State Summary

### ✅ Appointments Table
- **Status**: EXISTS
- **Has `id` column**: ✅ YES (primary key)
- **Has `patient_id` column**: ✅ YES (already exists)
- **Ready for foreign keys**: ✅ YES

### ✅ Services Table
- **Status**: EXISTS
- **Has `default_cpt` column**: ❌ NO (migration 041 needs to add it)

### ⚠️ Conflicting Tables

| Table Name | Exists | System | Has `appointment_id`? |
|------------|--------|--------|----------------------|
| `patients` | ✅ YES | Finance/General | N/A |
| `extracted_claims` | ✅ YES | **Document Extraction** | ❌ NO |
| `extracted_remittances` | ✅ YES | **Document Extraction** | ❌ NO |

### ❌ Missing Finance Tables

These tables do NOT exist and need to be created:
- `appointment_ingests`
- `fee_schedule_lines`
- `provider_pay_rules`
- `provider_earnings`
- `provider_pay_periods`
- `provider_pay_runs`
- `provider_pay_run_lines`
- `manual_overrides`

---

## Solution: Rename Finance Tables

To avoid conflicts with the document extraction system, we will rename:

### Old Names → New Names

| Old Name | New Name | Reason |
|----------|----------|--------|
| `extracted_claims` | `finance_claims` | Conflicts with document extraction system |
| `extracted_remittances` | `finance_remittances` | Conflicts with document extraction system |
| `patients` | **KEEP** `patients` | Already exists, shared table |

### Updated Schema

```sql
-- Finance-specific claims (linked to appointments)
create table public.finance_claims (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments(id) on delete cascade,
  claim_control_number text unique,
  member_id text,
  dos date not null,
  provider_npi text,
  billed_amount_cents int,
  status text,
  denial_reason text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Finance-specific remittances (payments from payers)
create table public.finance_remittances (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid references public.finance_claims(id) on delete set null,
  payment_cents int not null,
  adjustment_cents int default 0,
  remark_codes text[],
  check_number text,
  payment_date date,
  payer_id uuid references public.payers(id),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

---

## Files That Need Updates

### 1. Database Migrations

- ✅ **041-create-finance-tables.sql** - Rename tables, skip `patient_id` addition
- ✅ **042-provider-earnings-calc-engine.sql** - Update table references
- ✅ **043-create-appointments-grid-view.sql** - Update table references

### 2. API Endpoints

- ❌ `/api/finance/upload/era/route.ts` - Uses `extracted_remittances`
- ❌ `/api/finance/appointments/route.ts` - May reference old table names

### 3. React Components

- ❌ `AppointmentDetailDrawer.tsx` - May display claims/remittances

---

## Migration 041 Required Changes

### Section 1: Add `services.default_cpt` Column

```sql
-- ✅ REQUIRED - services table needs this column
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
    and table_name = 'services'
    and column_name = 'default_cpt'
  ) then
    alter table public.services add column default_cpt text;
    comment on column public.services.default_cpt is 'Default CPT code for billing';
  end if;
end $$;
```

### Section 2: Skip `appointments.patient_id` Addition

```sql
-- ❌ SKIP - column already exists
-- The conditional check will detect it exists and skip
```

### Section 3: Skip `patients` Table Creation

```sql
-- ❌ SKIP - table already exists
-- CREATE TABLE IF NOT EXISTS will handle this
```

### Section 4: Rename Finance Claims Tables

```sql
-- ✅ RENAME to avoid conflict
create table if not exists public.finance_claims (...)
create table if not exists public.finance_remittances (...)
```

---

## Testing Checklist

After fixing migrations:

- [ ] Run migration 041 (with renamed tables)
- [ ] Verify `services.default_cpt` column added
- [ ] Verify `finance_claims` table created with `appointment_id` column
- [ ] Verify `finance_remittances` table created with `claim_id` foreign key
- [ ] Run migration 042 (calculation engine)
- [ ] Run migration 043 (views) with updated table names
- [ ] Test finance UI at `/admin/finance/appointments`

---

## Recommendation

**PROCEED WITH MIGRATION FIX:**

1. ✅ Rename `extracted_claims` → `finance_claims` in all migrations and code
2. ✅ Rename `extracted_remittances` → `finance_remittances` in all migrations and code
3. ✅ Keep `patients` table as-is (shared resource)
4. ✅ Update API endpoints to use new table names
5. ✅ Test thoroughly before deploying

**Estimated Time**: 30-45 minutes to update all files and test
