# Database Cleanup Summary - Ready to Execute

**Date:** October 31, 2025
**Status:** ✅ READY FOR USER APPROVAL
**Risk Level:** 🟢 LOW (all duplicates unused, no foreign key references)

---

## What Was Found

### Current Database State:
- **37 total payers**
- **8 duplicate entries** (verified as completely unused)
- **14 payers with contracts** (will be preserved)
- **1 payer with plans** (SelectHealth - will be preserved)

### Duplicate Categories:

#### 1. TRICARE Variants (3 entries → 1)
- ❌ DELETE: "TriCare West" (incorrect spelling)
- ❌ DELETE: "TriWest" (administrator name, not payer)
- ✅ KEEP: "TRICARE West" (correct official name)

#### 2. Payment Type Duplicates (6 entries → 3)
- ❌ DELETE: ACH pay #2, Cash pay #2, Credit card pay #2
- ✅ KEEP: ACH pay, Cash pay, Credit card pay (first instances)

#### 3. SelectHealth Fragments (4 entries → 1)
- ❌ DELETE: "SelectHealth Care" (this is a plan name, not payer)
- ❌ DELETE: "SelectHealth Med" (this is a plan name, not payer)
- ❌ DELETE: "SelectHealth Value" (this is a plan name, not payer)
- ✅ KEEP: "SelectHealth Integrated" (correct payer name with 6 plans)

---

## What Was Built

### 1. Analysis Document
**File:** `PAYER_DATABASE_CLEANUP_PLAN.md`

Comprehensive 200+ line plan documenting:
- Current state analysis
- Problem categories with UUIDs
- Consolidation strategy
- Risk assessment
- Migration approach

### 2. Verification Script
**File:** `scripts/verify-duplicate-usage.js`

Node.js script that checks if duplicates are referenced in:
- `provider_payer_networks` (contracts)
- `payer_plans` (plan definitions)
- `provider_payer_accepted_plans` (junction table)

**Result:** ✅ All 8 duplicates are completely unused - safe to delete

### 3. Migration SQL
**File:** `database-migrations/034-cleanup-duplicate-payers.sql`

Production-ready migration with:
- ✅ Pre-deletion verification (checks all 8 duplicates exist)
- ✅ Safe deletion with name checks (won't delete wrong records)
- ✅ Post-deletion verification (ensures correct records preserved)
- ✅ Transaction wrapping (all-or-nothing, auto-rollback on error)
- ✅ Detailed RAISE NOTICE messages for monitoring

**Expected outcome:** 37 payers → 29 payers

### 4. Execution Script
**File:** `scripts/run-cleanup-migration.sh`

Bash script with safety features:
- Checks environment variables
- Shows current state before/after
- Requires explicit "yes" confirmation
- Supports both Supabase CLI and direct psql
- Displays verification results

---

## How to Execute

### Option 1: Using Supabase CLI (Recommended)

```bash
# 1. Review the plan
cat PAYER_DATABASE_CLEANUP_PLAN.md

# 2. Verify duplicates are unused
node scripts/verify-duplicate-usage.js

# 3. Run the cleanup (with confirmation prompt)
./scripts/run-cleanup-migration.sh
```

### Option 2: Manual Execution

```bash
# 1. Verify duplicates
node scripts/verify-duplicate-usage.js

# 2. Execute migration directly
supabase db execute < database-migrations/034-cleanup-duplicate-payers.sql

# 3. Verify results
node scripts/check-payers-status.js
```

### Option 3: Via Supabase Dashboard

1. Open Supabase Dashboard → SQL Editor
2. Copy contents of `database-migrations/034-cleanup-duplicate-payers.sql`
3. Paste and run
4. Check output messages for verification

---

## Safety Features

### ✅ Multiple Verification Layers:

1. **Pre-execution verification script**
   - Confirmed all duplicates are unused
   - No contracts, no plans, no references

2. **Migration pre-checks**
   - Verifies all 8 duplicates exist before starting
   - Aborts if duplicate count doesn't match

3. **Deletion safety**
   - Uses UUID AND name matching (won't delete wrong record)
   - Example: `WHERE id = 'uuid' AND name = 'TriCare West'`

4. **Post-deletion verification**
   - Confirms canonical payers still exist
   - Verifies contract count unchanged (14)
   - Verifies plan count unchanged (1)
   - Checks no duplicate names remain

5. **Transaction wrapping**
   - BEGIN/COMMIT ensures atomic changes
   - Auto-rollback if any check fails

### ⚠️ What Could Go Wrong?

**Scenario 1: Wrong payer deleted**
- **Mitigation:** UUID + name matching prevents this
- **Recovery:** Transaction rolls back, no changes made

**Scenario 2: Canonical payer missing**
- **Mitigation:** Pre-checks verify canonical exists
- **Recovery:** Migration aborts before any deletions

**Scenario 3: Unexpected foreign key references**
- **Mitigation:** Verification script already checked
- **Recovery:** PostgreSQL will prevent deletion, transaction rolls back

---

## Expected Results

### Before:
```
Total payers: 37
Payers with contracts: 14
Payers with plans: 1 (SelectHealth Integrated - 6 plans)

Duplicate issues:
- 3 TRICARE variants
- 6 payment type duplicates
- 4 SelectHealth fragments (plan names in payers table)
```

### After:
```
Total payers: 29 ✅
Payers with contracts: 14 ✅ (unchanged)
Payers with plans: 1 ✅ (SelectHealth Integrated - 6 plans, unchanged)

Clean state:
- 1 TRICARE entry (correct name)
- 3 payment types (no duplicates)
- 1 SelectHealth entry (correct payer name)
```

---

## Next Steps After Cleanup

Once cleanup is complete, continue with plan-level validation for priority payers:

### Tier 1 (Immediate):
1. **Regence BCBS** - Awaiting email response on accepted products
2. **Aetna** - Need contract and product list
3. **United Healthcare** - Verify contract exists first

### Tier 2 (Medium Priority):
4. **Molina Utah** - Government program (1 contract)
5. **Utah Medicaid** - Government program (6 contracts)
6. **Idaho Medicaid** - Government program (3 contracts)

### Tier 3 (Lower Priority):
7. **MotivHealth** - Regional ACA marketplace (7 contracts)
8. **DMBA** - LDS Church benefits (3 contracts)
9. **University of Utah Health Plans** - Academic medical center (1 contract)

---

## Testing After Cleanup

```bash
# 1. Verify payer count
node scripts/check-payers-status.js

# Expected output:
# Total payers: 29
# Payers with contracts: 14
# Payers with plans: 1

# 2. Test booking flow
# - Try booking with TRICARE West (should work if contract exists)
# - Try booking with SelectHealth Integrated (should work)

# 3. Verify no broken references
# - Check admin dashboard loads
# - Check provider dashboard loads
# - Check booking flow works
```

---

## Files Created

| File | Purpose | Lines | Status |
|------|---------|-------|--------|
| `PAYER_DATABASE_CLEANUP_PLAN.md` | Detailed analysis and strategy | 400+ | ✅ Complete |
| `scripts/verify-duplicate-usage.js` | Check foreign key references | 150+ | ✅ Complete |
| `scripts/run-cleanup-migration.sh` | Safe execution wrapper | 80+ | ✅ Complete |
| `database-migrations/034-cleanup-duplicate-payers.sql` | Production migration | 250+ | ✅ Complete |
| `DATABASE_CLEANUP_SUMMARY.md` | This file | 200+ | ✅ Complete |

**Total:** 5 files, 1,000+ lines of documentation and code

---

## Decision Required

**Question:** Should we proceed with the cleanup?

**Options:**
1. ✅ **YES** - Execute cleanup now (`./scripts/run-cleanup-migration.sh`)
2. ⏸️ **REVIEW FIRST** - Read `PAYER_DATABASE_CLEANUP_PLAN.md` in detail
3. ⏸️ **TEST ON STAGING** - Run on dev/staging database first
4. ❌ **NO** - Keep duplicates for now, proceed with Regence/Aetna plan research

**Recommendation:** Option 1 (YES) - All safety checks passed, low risk

---

## Rollback Plan

If issues occur after cleanup:

1. **Automatic rollback:** Migration uses transactions - any error triggers automatic rollback
2. **Manual restore:** Restore from database backup (if taken before cleanup)
3. **Re-add deleted payers:** Use INSERT statements with original UUIDs (documented in plan)

**Best practice:** Take database snapshot before executing (Supabase Dashboard → Settings → Database → Backup)

---

**Status:** 🟢 READY FOR EXECUTION
**Confidence Level:** HIGH (all verifications passed)
**Estimated Execution Time:** 1-2 seconds
**Risk Assessment:** LOW
