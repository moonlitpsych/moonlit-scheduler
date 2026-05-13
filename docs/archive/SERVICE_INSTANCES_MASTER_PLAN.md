# Service Instances Master Plan

**Date**: October 7, 2025
**Branch**: `oct-6-booking`
**Status**: 📋 PLAN MODE - Review before execution

---

## 🎯 Executive Summary

**Problem**: Only 2 of 31 payers are currently bookable due to missing `service_instances` and `service_instance_integrations` configurations.

**Root Cause**: The admin payer creation flow does NOT automatically create service instances when new payers are added.

**Solution**: Implement automated service instance creation + backfill existing payers.

---

## 📊 Current State Analysis

### What We Have

**service_instances table structure:**
```
- id (uuid, PK)
- service_id (uuid, FK to services)
- payer_id (uuid, FK to payers)
- location (text) - e.g., 'Telehealth'
- pos_code (text) - e.g., '10' for telehealth
```

**service_instance_integrations table structure:**
```
- id (uuid, PK)
- service_instance_id (uuid, FK to service_instances)
- system (text) - 'intakeq' or 'practiceq'
- external_id (text) - IntakeQ service ID
```

### What's Working

✅ **Molina Utah**: 3 service instances with IntakeQ mappings
- Intake (IntakeQ ID: `137bcec9-6d59-4cd8-910f-a1d9c0616319`)
- Follow-up Short (IntakeQ ID: `436ebccd-7e5b-402d-9f13-4c5733e3af8c`)
- Follow-up Extended (IntakeQ ID: `f0490d0a-992f-4f14-836f-0e41e11be14d`)

✅ **Utah Medicaid Fee-for-Service**: 5 service instances (4 unique + 1 duplicate Intake)

### What's Broken

❌ **Aetna**: 1 service instance (Follow-up Short) with NO IntakeQ mapping
❌ **28 other payers**: Zero service instances
❌ **15 orphaned service instances**: `payer_id = null` (garbage data)

---

## 🔍 Requirements Analysis

### For a payer to be bookable, it needs:

1. **At minimum**: 1 Intake service instance
   - `service_id` → points to " Intake" service (`f0a05d4c-188a-4f1b-9600-54d6c27a3f62`)
   - `payer_id` → points to the payer
   - `location` = 'Telehealth'
   - `pos_code` = '10'

2. **IntakeQ integration mapping**:
   - `service_instance_id` → points to the service instance
   - `system` = 'intakeq'
   - `external_id` = `137bcec9-6d59-4cd8-910f-a1d9c0616319` (New Patient Visit - Insurance UT)

3. **Optional**: Follow-up service instances
   - Follow-up Short (30 min)
   - Follow-up Extended (60 min)

### Services Available

Query shows these services exist in the database:
- **" Intake"** (ID: `f0a05d4c-188a-4f1b-9600-54d6c27a3f62`) - PRIMARY REQUIRED
- **"Follow-up (Short)"** (multiple service_ids - need to consolidate)
- **"Follow-up (Extended)"** (multiple service_ids - need to consolidate)
- **"Sublocade Injection"** (specialty service)

### IntakeQ Service IDs

From CLAUDE.md and existing mappings:
- **Intake**: `137bcec9-6d59-4cd8-910f-a1d9c0616319` (New Patient Visit - Insurance UT)
- **Follow-up Short**: `436ebccd-7e5b-402d-9f13-4c5733e3af8c`
- **Follow-up Extended**: `f0490d0a-992f-4f14-836f-0e41e11be14d`

---

## 🚨 Critical Gap: Admin Payer Creation

### Current Admin Flow

When creating a new payer via `/api/admin/payers/comprehensive-update`:
1. ✅ Creates payer record
2. ✅ Creates provider contracts
3. ❌ **Does NOT create service instances**
4. ❌ **Does NOT create IntakeQ mappings**

**Result**: Newly created payers are NOT bookable until service instances are manually seeded.

### What Needs to Happen

When a new payer is created, the system should automatically:
1. Create Intake service instance
2. Create Follow-up service instances (optional but recommended)
3. Create IntakeQ integration mappings for each

---

## 🎯 Proposed Solution

### Phase 1: Backfill Existing Payers (Immediate)

**Goal**: Make all 31 payers bookable ASAP

**Approach**: Create SQL seed script that:
1. Identifies payers missing Intake service instances
2. Creates service_instances for each payer:
   - Intake (Telehealth, POS 10)
   - Follow-up Short (Telehealth, POS 10)
   - Follow-up Extended (Telehealth, POS 10)
3. Creates service_instance_integrations for each instance
4. Cleans up 15 orphaned instances (payer_id = null)

**Pros**:
- ✅ Makes all payers immediately bookable
- ✅ One-time SQL script, easy to execute
- ✅ No code changes required

**Cons**:
- ❌ Doesn't prevent future gaps
- ❌ Manual process

**Estimated Time**: 1-2 hours

---

### Phase 2: Automate Service Instance Creation (Permanent Fix)

**Goal**: Ensure future payers are automatically bookable

**Approach**: Update `/api/admin/payers/comprehensive-update` to:
1. After creating payer, automatically create service instances
2. Create IntakeQ mappings using default service IDs
3. Log all creations to audit trail

**Implementation**:

```typescript
// In /api/admin/payers/comprehensive-update/route.ts
// After creating payer (line 68):

// Create default service instances for new payer
const defaultServices = [
  {
    name: 'Intake',
    serviceId: 'f0a05d4c-188a-4f1b-9600-54d6c27a3f62',
    intakeqId: '137bcec9-6d59-4cd8-910f-a1d9c0616319'
  },
  {
    name: 'Follow-up (Short)',
    serviceId: '4b6e81ed-e30e-4127-ba71-21aa9fac8cd1',
    intakeqId: '436ebccd-7e5b-402d-9f13-4c5733e3af8c'
  },
  {
    name: 'Follow-up (Extended)',
    serviceId: 'a6cdf789-41f7-484d-a948-272547eb566e',
    intakeqId: 'f0490d0a-992f-4f14-836f-0e41e11be14d'
  }
]

for (const service of defaultServices) {
  // Create service_instance
  const { data: instance, error: instanceError } = await supabase
    .from('service_instances')
    .insert({
      service_id: service.serviceId,
      payer_id: newPayer.id,
      location: 'Telehealth',
      pos_code: '10'
    })
    .select()
    .single()

  if (instanceError) {
    console.error(`❌ Failed to create ${service.name} instance:`, instanceError)
    continue
  }

  // Create IntakeQ integration mapping
  const { error: integrationError } = await supabase
    .from('service_instance_integrations')
    .insert({
      service_instance_id: instance.id,
      system: 'intakeq',
      external_id: service.intakeqId
    })

  if (integrationError) {
    console.error(`❌ Failed to create IntakeQ mapping for ${service.name}:`, integrationError)
  } else {
    console.log(`✅ Created ${service.name} service instance with IntakeQ mapping`)
  }

  // Log to audit trail
  auditEntries.push({
    actorUserId: mockUserId,
    action: 'create_service_instance',
    entity: 'service_instances',
    entityId: instance.id,
    before: null,
    after: instance,
    note: `Auto-created ${service.name} service instance for new payer`
  })
}
```

**Pros**:
- ✅ Prevents future gaps
- ✅ Fully automated
- ✅ Maintains audit trail
- ✅ Works for all new payers

**Cons**:
- ❌ Requires code changes
- ❌ Need to handle errors gracefully
- ❌ What if IntakeQ service IDs change?

**Estimated Time**: 2-3 hours

---

### Phase 3: Admin UI for Service Instance Management (Optional)

**Goal**: Allow admins to manage service instances per payer

**Approach**: Add UI to payer editor modal to:
- View current service instances
- Add/remove service instances
- Edit IntakeQ mappings
- See which payers are bookable at a glance

**Pros**:
- ✅ Full control over service instances
- ✅ Can handle edge cases (payer-specific services, different IntakeQ IDs)
- ✅ Better visibility

**Cons**:
- ❌ Significant UI work
- ❌ Complex state management
- ❌ Not immediately necessary

**Estimated Time**: 8-12 hours

**Priority**: LOW (can defer to future sprint)

---

## 🗺️ Execution Plan

### Recommended Approach: Phase 1 + Phase 2

**Step 1**: Backfill existing payers (SQL seed script)
**Step 2**: Automate future payer creation (code changes)
**Step 3**: Test end-to-end (create new payer, verify bookability)

---

## 📋 Phase 1: SQL Backfill Script

### Backfill Strategy

**Safe Approach** (RECOMMENDED):
- Only create Intake service instances for payers that have provider contracts
- Use existing service_id and IntakeQ external_id from Molina/Utah Medicaid
- Skip payers with status_code = 'suspended' or 'rejected'
- Clean up orphaned instances at end

**Aggressive Approach**:
- Create instances for ALL payers regardless of contracts
- Assumes all payers will eventually have contracts

**Hybrid Approach**:
- Create instances for active payers (have contracts OR status_code = 'approved')
- Mark others for manual review

---

## 🔍 Pre-Flight Checks

Before executing, verify:

### 1. Services Table Check
```sql
SELECT id, name FROM services
WHERE name ILIKE '%intake%' OR name ILIKE '%follow%';
```

**Expected**:
- " Intake" → `f0a05d4c-188a-4f1b-9600-54d6c27a3f62`
- "Follow-up (Short)" → `4b6e81ed-e30e-4127-ba71-21aa9fac8cd1`
- "Follow-up (Extended)" → `a6cdf789-41f7-484d-a948-272547eb566e`

### 2. IntakeQ Service IDs Verification

Visit IntakeQ admin panel and confirm service IDs still match:
- https://intakeq.com/admin/services

### 3. Payer Contracts Check

```sql
SELECT p.id, p.name, COUNT(ppn.id) as contract_count
FROM payers p
LEFT JOIN provider_payer_networks ppn ON p.id = ppn.payer_id
GROUP BY p.id, p.name
ORDER BY p.name;
```

**Use this to determine which payers should get service instances first.**

### 4. Duplicate Service Check

```sql
SELECT service_id, payer_id, COUNT(*) as count
FROM service_instances
WHERE payer_id IS NOT NULL
GROUP BY service_id, payer_id
HAVING COUNT(*) > 1;
```

**Expected**: 0 rows (no duplicates)
**If duplicates exist**: Decide which to keep before backfill

---

## 🎬 Execution Steps

### Step 1: Create Debug API Endpoints ✅ DONE

- [x] `/api/debug/check-payer-service-instances` - Shows which payers are bookable
- [x] `/api/debug/check-service-instances` - Shows all service instances

### Step 2: Verify Services Table

Create endpoint: `/api/debug/check-services`

Returns:
- All services with IDs
- Duration information
- Which are Intake vs Follow-up

### Step 3: Generate Backfill SQL Script

Options:
A. **Manual SQL script** - Write and review before execution
B. **API endpoint** - `/api/admin/backfill-service-instances` (dry-run mode)
C. **Migration file** - Proper database migration

**RECOMMENDATION**: Use Option A (manual SQL) for safety and auditability.

### Step 4: Execute Backfill

1. Test on staging/dev database first
2. Verify with debug endpoint
3. Test booking with newly configured payer
4. Execute on production
5. Verify all payers bookable

### Step 5: Update Admin Payer Creation Flow

1. Add service instance creation logic to `/api/admin/payers/comprehensive-update`
2. Test by creating new payer
3. Verify service instances auto-created
4. Verify IntakeQ mappings present
5. Test booking with new payer

### Step 6: Documentation

Update CLAUDE.md:
- Document service instance requirements
- Document IntakeQ service ID mappings
- Document backfill process
- Document admin flow changes

---

## ⚠️ Risks & Mitigation

### Risk 1: IntakeQ Service IDs Change

**Impact**: Bookings fail with "service not found" errors

**Mitigation**:
- Store IntakeQ IDs in environment variables
- Add validation step in booking flow
- Create admin UI to update mappings

### Risk 2: Duplicate Service Instances Created

**Impact**: Booking resolver picks wrong instance, unpredictable behavior

**Mitigation**:
- Add UNIQUE constraint: `(service_id, payer_id, location, pos_code)`
- Check for existing instances before creating
- Implement upsert logic (INSERT ... ON CONFLICT)

### Risk 3: Backfill Creates Instances for Invalid Payers

**Impact**: Payers without contracts become "bookable" but appointments fail

**Mitigation**:
- Only backfill payers with active contracts
- Add validation in booking flow: check provider-payer relationship
- Already have `v_bookable_provider_payer` view for this

### Risk 4: Manual SQL Script Errors

**Impact**: Database corruption, incorrect data

**Mitigation**:
- Wrap in transaction (BEGIN ... COMMIT)
- Use dry-run mode first (SELECT statements only)
- Test on dev database
- Peer review SQL before execution

---

## 📊 Success Metrics

### Immediate (Post-Backfill)
- ✅ 31/31 payers have at least 1 Intake service instance
- ✅ All Intake instances have IntakeQ mappings
- ✅ Test booking succeeds for Aetna
- ✅ Debug endpoint shows 31 bookable payers

### Short-term (Post-Automation)
- ✅ New payer creation automatically includes service instances
- ✅ Audit trail logs service instance creation
- ✅ Zero manual intervention needed for bookability

### Long-term (Optional Phase 3)
- ✅ Admin UI allows service instance management
- ✅ Payer editor shows bookability status
- ✅ Can handle custom IntakeQ mappings per payer

---

## 🎯 Recommendation

**Execute Phase 1 + Phase 2 now. Defer Phase 3 to future sprint.**

**Reasoning**:
1. Phase 1 solves immediate problem (Aetna bookings failing)
2. Phase 2 prevents future recurrence (new payers auto-bookable)
3. Phase 3 is nice-to-have but not critical for core booking functionality
4. Total time: ~3-5 hours vs 12+ hours with Phase 3

---

## 🔄 Open Questions

1. **Should we create Follow-up service instances for all payers, or just Intake?**
   - Recommendation: Create all 3 (Intake + 2 Follow-ups) to match Molina pattern
   - Reasoning: Most payers will eventually need follow-up bookings

2. **What to do with 15 orphaned service instances (payer_id = null)?**
   - Recommendation: Delete them (they're not referenced by appointments)
   - Need to verify: Check if any appointments reference these instances

3. **Should service instance creation fail if IntakeQ mapping fails?**
   - Recommendation: Create instance but log error, continue
   - Reasoning: Payer record should be created even if IntakeQ integration has issues
   - Can be fixed later via admin UI (Phase 3)

4. **Should backfill include payers with status_code = 'pending'?**
   - Recommendation: Yes, include pending payers
   - Reasoning: They may become approved soon, and we want them ready to book

5. **Should we add database constraints to prevent future issues?**
   - Recommendation: Yes, add UNIQUE constraint on service_instances
   - Constraint: `UNIQUE(service_id, payer_id, location, pos_code)`
   - Prevents accidental duplicates

---

## 📝 Next Actions

**FOR REVIEW**:
1. User reviews this plan
2. User decides on Phase 1+2 vs all 3 phases
3. User answers open questions above
4. User approves execution

**AFTER APPROVAL**:
1. Create `/api/debug/check-services` endpoint
2. Verify services table data
3. Answer open questions
4. Generate backfill SQL script
5. Execute backfill (with user approval)
6. Implement Phase 2 automation
7. Test end-to-end
8. Update documentation

---

## 📚 Reference Data

### Molina Utah Service Instances (Template)

```
Service: " Intake"
service_id: f0a05d4c-188a-4f1b-9600-54d6c27a3f62
IntakeQ external_id: 137bcec9-6d59-4cd8-910f-a1d9c0616319
location: Telehealth
pos_code: 10

Service: "Follow-up (Short)"
service_id: 4b6e81ed-e30e-4127-ba71-21aa9fac8cd1
IntakeQ external_id: 436ebccd-7e5b-402d-9f13-4c5733e3af8c
location: Telehealth
pos_code: 10

Service: "Follow-up (Extended)"
service_id: a6cdf789-41f7-484d-a948-272547eb566e
IntakeQ external_id: f0490d0a-992f-4f14-836f-0e41e11be14d
location: Telehealth
pos_code: 10
```

### Payer Types Distribution (from debug endpoint)

- Private: 13 payers
- Medicaid: 15 payers
- Self-Pay: 3 payers

**Priority**: Focus backfill on Private + Medicaid first, Self-Pay last.
