# Bookability Tables & Views Audit

**Date**: October 7, 2025
**Status**: ✅ **Complete Analysis**

---

## 🎯 **SINGLE SOURCE OF TRUTH**

### **`v_bookable_provider_payer`** (Canonical View)

**Purpose**: Live view of all bookable provider-payer relationships
**Used By**:
- ✅ Patient booking API (`/api/patient-booking/merged-availability`)
- ✅ Admin dashboard bookability (`/api/admin/bookability`)
- ✅ Admin coverage reports (`/api/admin/bookability/coverage`)
- ✅ Admin health checks (`/api/admin/bookability/health`)
- ✅ Payers contracted API (`/api/payers/contracted`)
- ✅ Provider accepted payments (`/api/providers/[id]/accepted-payments`)

**Schema**: See `src/lib/bookability.ts` interface `BookableProviderPayerView`

**Status**: ✅ **ACTIVE - THIS IS THE SOURCE OF TRUTH**

---

## ⚠️ **PROBLEM TABLES** (Causing Current Issues)

### **`bookable_provider_payers_v2`** (View or Table?)

**Purpose**: Unknown - appears to be a different bookability view with different logic
**Used By**:
- ❌ **Database trigger** `enforce_bookable_provider_payer()` (validates appointments)
- ❓ Debug endpoints only

**Current State**:
- Has **0 rows for Molina payer** (while canonical view has 5 rows)
- Causes "Not bookable for this payer" errors during booking
- **NOT ALIGNED** with `v_bookable_provider_payer`

**Status**: ⚠️ **DEPRECATED OR NEEDS ALIGNMENT**

---

### **`bookable_provider_payers_v2_mv`** (Materialized View)

**Purpose**: Cached/materialized version of some bookability query
**Refresh Function**: `refresh_bookable_provider_payers_v2(p_concurrent boolean)`

**Current State**:
- Has 35 total rows after refresh
- Has **0 rows for Molina payer**
- Not accessible via Supabase PostgREST API (shows as "Unrestricted" in Supabase UI)

**Status**: ⚠️ **STALE AND MISALIGNED**

---

### **`bookable_provider_payers_v2_src`** (Unknown)

**Purpose**: Unknown - possibly source table for MV?
**Used By**: Unknown
**Status**: ❓ **INVESTIGATE OR DEPRECATE**

---

## 📊 **OTHER VIEWS** (Variants or Deprecated)

### **`v_bookable_provider_payer_corrected`**

**Purpose**: Corrected version of canonical view?
**Used By**:
- Admin dashboard (with fallback to canonical)

**Status**: ⚠️ **UNCLEAR - CHECK IF STILL NEEDED**

---

### **`v_bookable_provider_payer_named`**

**Purpose**: Canonical view + provider names
**Referenced In**:
- `src/lib/dbViews.ts` constant
- `src/lib/bookability.ts` interface

**Used By**: Appears unused in actual API calls
**Status**: ⚠️ **POTENTIALLY DEPRECATED**

---

### **`v_bookable_provider_payer_fixed`** ⚠️ Unrestricted

**Purpose**: Unknown fix attempt?
**Used By**: Unknown
**Status**: ❓ **INVESTIGATE OR DEPRECATE**

---

### **`v_bookable_provider_payer_mv`** ⚠️ Unrestricted

**Purpose**: Materialized view of canonical?
**Used By**: Unknown
**Status**: ❓ **INVESTIGATE OR DEPRECATE**

---

### **`v_bookable_provider_payer_v3`** ⚠️ Unrestricted

**Purpose**: Version 3 attempt?
**Used By**: Unknown (grep found 0 matches in codebase)
**Status**: ❌ **DEPRECATED - DELETE**

---

### **`v_bookable_provider_payers_v3_deprecated`**

**Purpose**: Explicitly deprecated
**Used By**: None
**Status**: ❌ **DELETE**

---

### **`v_in_network_bookable`**

**Purpose**: Subset of bookable relationships (in-network only?)
**Used By**: Unknown (grep found 0 matches in codebase)
**Status**: ⚠️ **INVESTIGATE OR DEPRECATE**

---

## 🚨 **CRITICAL ISSUE: AVAILABILITY vs BOOKING MISMATCH**

### The Problem

**Availability API** uses:
```typescript
supabaseAdmin.from('v_bookable_provider_payer')  // ✅ Shows 5 Molina providers
```

**Booking Trigger** uses:
```sql
SELECT * FROM bookable_provider_payers_v2  -- ❌ Shows 0 Molina providers
WHERE payer_id = NEW.payer_id AND ...
```

**Result**: Slots show as available but booking fails with "Not bookable for this payer on the selected date"

---

## ✅ **DEPRECATION PLAN**

### Phase 1: Immediate Fix (TODAY)

1. **Option A: Update Trigger to Use Canonical View**
   ```sql
   -- Change trigger to query v_bookable_provider_payer instead of bookable_provider_payers_v2
   ALTER FUNCTION enforce_bookable_provider_payer() ...
   ```

2. **Option B: Fix bookable_provider_payers_v2 to Match Canonical**
   - Investigate why v2 excludes Molina
   - Update v2 query logic to match canonical view
   - Refresh MV

**Recommendation**: **Option A** - Simplify by using single source of truth

---

### Phase 2: Clean Up (THIS WEEK)

1. **Drop Unused Views** (after confirming zero usage):
   ```sql
   DROP VIEW IF EXISTS v_bookable_provider_payer_v3;
   DROP VIEW IF EXISTS v_bookable_provider_payers_v3_deprecated;
   DROP VIEW IF EXISTS v_bookable_provider_payer_fixed;  -- if unused
   DROP VIEW IF EXISTS v_bookable_provider_payer_named;  -- if unused
   ```

2. **Update Trigger**:
   ```sql
   -- Modify enforce_bookable_provider_payer() to use v_bookable_provider_payer
   CREATE OR REPLACE FUNCTION enforce_bookable_provider_payer()
   RETURNS TRIGGER AS $$
   DECLARE
     v_row record;
     v_dos date := (NEW.start_time AT TIME ZONE 'America/Denver')::date;
   BEGIN
     IF NEW.payer_id IS NULL THEN
       RETURN NEW;
     END IF;

     -- Use canonical view instead of v2
     SELECT *
     INTO v_row
     FROM public.v_bookable_provider_payer b
     WHERE b.payer_id = NEW.payer_id
       AND b.provider_id = NEW.provider_id
       AND v_dos >= COALESCE(b.bookable_from_date, b.effective_date)
       AND (b.expiration_date IS NULL OR v_dos <= b.expiration_date)
     LIMIT 1;

     IF NOT FOUND THEN
       RAISE EXCEPTION 'Not bookable for this payer on the selected date';
     END IF;

     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;
   ```

3. **Deprecate v2 Tables**:
   ```sql
   -- Once trigger is updated, these become obsolete
   DROP MATERIALIZED VIEW IF EXISTS bookable_provider_payers_v2_mv;
   DROP VIEW IF EXISTS bookable_provider_payers_v2;
   DROP TABLE IF EXISTS bookable_provider_payers_v2_src;  -- if exists
   DROP FUNCTION IF EXISTS refresh_bookable_provider_payers_v2(boolean);
   ```

---

### Phase 3: Update Availability API (THIS WEEK)

Replace manual slot expansion with database function:

```typescript
// Instead of:
// - Query v_bookable_provider_payer
// - Query provider_availability
// - Manually expand slots
// - Filter conflicts

// Use:
const { data: slots } = await supabaseAdmin
  .rpc('list_bookable_slots_for_payer', {
    p_payer_id: payerId,
    p_service_instance_id: serviceInstanceId,
    p_from: startDate,
    p_thru: endDate,
    p_tz: 'America/Denver'
  })
```

**Benefits**:
- Uses same bookability logic as trigger
- No more availability/booking discrepancies
- Single source of truth for "bookable" definition

---

## 📋 **ACTION ITEMS**

### For Miriam (SQL Editor)

1. ✅ Run: `SELECT refresh_bookable_provider_payers_v2(false);` - **DONE** (but didn't help)

2. 🔧 **Update trigger to use canonical view** (see Phase 2 SQL above)

3. 🗑️ **Drop deprecated views**:
   ```sql
   DROP VIEW IF EXISTS v_bookable_provider_payer_v3;
   DROP VIEW IF EXISTS v_bookable_provider_payers_v3_deprecated;
   ```

4. ✅ **Verify canonical view has Molina data**:
   ```sql
   SELECT COUNT(*) FROM v_bookable_provider_payer
   WHERE payer_id = '8b48c3e2-f555-4d67-8122-c086466ba97d';
   -- Should return 5
   ```

---

### For Claude (Code Changes)

1. ✅ Document canonical view as source of truth
2. ⏳ Update `/api/patient-booking/merged-availability` to use `list_bookable_slots_for_payer` RPC
3. ⏳ Remove references to deprecated views from codebase
4. ⏳ Update `CLAUDE.md` with final architecture

---

## 🎯 **FINAL STATE**

**Single Source of Truth**: `v_bookable_provider_payer`

**Used By**:
- ✅ Patient booking availability API
- ✅ Patient booking validation trigger
- ✅ Admin dashboard
- ✅ All bookability queries

**Deprecated/Removed**:
- ❌ `bookable_provider_payers_v2` (all variants)
- ❌ `v_bookable_provider_payer_v3`
- ❌ `v_bookable_provider_payers_v3_deprecated`
- ❌ All materialized view variants (unless we create a SINGLE one from canonical)

**Optional Keep** (if actively used):
- ⚠️ `v_bookable_provider_payer_corrected` (if fixes real issues)
- ⚠️ `v_in_network_bookable` (if used for specific queries)
