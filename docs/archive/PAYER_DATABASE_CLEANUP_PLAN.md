# Payer Database Cleanup Plan

**Date:** October 31, 2025
**Goal:** Remove duplicate payer entries and consolidate fragmented records
**Status:** 🟡 READY FOR REVIEW

---

## Current State Analysis

### Total Payers: 37
- **With Contracts:** 14 payers
- **With Plans Defined:** 1 payer (SelectHealth Integrated - 6 plans)

---

## Problem Categories

### 1. TRICARE Duplicates (3 entries)

| Name | ID | Has Contract? | Notes |
|------|-----|---------------|-------|
| TriCare West | `0ff47595-9927-44f6-9d18-d2e779c802a7` | ❌ No | Incorrect spelling |
| TRICARE West | `677e91d3-d6a9-4f72-b8ee-e9b673d2ccfc` | ❌ No (but should) | Correct spelling |
| TriWest | `08fcf2d8-8f4a-48ed-af1b-f29842b1dbdb` | ❌ No | Administrator name |

**Assessment:**
- TriWest Healthcare Alliance = Insurance administrator (not the payer name)
- TRICARE West = Correct patient-facing name
- TriCare West = Typo variant

**Recommendation:**
- **KEEP:** "TRICARE West" (`677e91d3-d6a9-4f72-b8ee-e9b673d2ccfc`)
- **DELETE:** "TriCare West", "TriWest"
- **REASON:** TRICARE West is the official program name; TriWest is just the admin

**Contract Note:**
- Contract signed Oct 23, 2025 (from previous analysis)
- Needs to be linked to "TRICARE West" entry
- Check `provider_payer_networks` for orphaned contract

---

### 2. Payment Type Duplicates (6 entries → 3)

| Name | ID | Has Contract? | Notes |
|------|-----|---------------|-------|
| ACH pay | `0a71c8bb-8520-415f-91c7-e265d4e7336f` | ❌ No | Duplicate 1 |
| ACH pay | `8c22d4d0-54a9-498c-be2d-79c2213b83a2` | ❌ No | Duplicate 2 |
| Cash pay | `6317e5c7-e3fb-48ed-a394-db7a8b94b206` | ❌ No | Duplicate 1 |
| Cash pay | `e8e573ef-f66c-4392-a4d4-309376d25d3d` | ❌ No | Duplicate 2 |
| Credit card pay | `637f0593-b609-4415-8e49-bb0915fe0f19` | ❌ No | Duplicate 1 |
| Credit card pay | `3d655839-33b3-49d0-8df2-780a13430dcb` | ❌ No | Duplicate 2 |

**Assessment:**
- These are payment methods, not insurance payers
- None have contracts (expected - they're not insurance companies)
- Duplicates likely created during multiple data imports

**Recommendation:**
- **KEEP:** First instance of each (alphabetically by UUID)
  - ACH pay: `0a71c8bb-8520-415f-91c7-e265d4e7336f`
  - Cash pay: `6317e5c7-e3fb-48ed-a394-db7a8b94b206`
  - Credit card pay: `3d655839-33b3-49d0-8df2-780a13430dcb`
- **DELETE:** Second instance of each
- **REASON:** No contracts to preserve; arbitrary choice is safe

---

### 3. SelectHealth Fragmentation (4 entries)

| Name | ID | Contracts | Plans | Notes |
|------|-----|-----------|-------|-------|
| SelectHealth Care | `9b0c0548-4f03-4173-b893-c18d473f8f03` | ❌ None | ❌ None | Plan name, not payer |
| SelectHealth Integrated | `d37d3938-b48d-4bdf-b500-bf5413157ef4` | ✅ 1 | ✅ 6 | **ACTIVE** |
| SelectHealth Med | `5f5c8b81-c34b-4454-9cc6-f57abf968a8e` | ❌ None | ❌ None | Plan name, not payer |
| SelectHealth Value | `e964aa50-8b7a-4780-a570-8a035eebd415` | ❌ None | ❌ None | Plan name, not payer |

**Assessment:**
- "SelectHealth Care", "SelectHealth Med", "SelectHealth Value" are PLAN NAMES (products patients buy)
- "SelectHealth Integrated" is the PAYER NAME (insurance company entity)
- These plan names should be in `payer_plans` table, NOT `payers` table
- Only "SelectHealth Integrated" should exist in `payers` table

**Current Plan Data (already in `payer_plans`):**
From earlier output, SelectHealth Integrated has 6 plans defined:
1. Select Choice (PPO)
2. Select Care (PPO)
3. Select Med (PPO)
4. Select Value (HMO)
5. SelectHealth Share (PPO)
6. Select Access (Medicaid/CHIP)

**⚠️ CRITICAL DISTINCTION:**
- "SelectHealth Care" (payer table) ≠ "Select Care" (plan)
- "SelectHealth Med" (payer table) ≠ "Select Med" (plan)
- "SelectHealth Value" (payer table) ≠ "Select Value" (plan)

These payer entries are incorrectly created - likely someone confused plan names with payer names.

**Recommendation:**
- **KEEP:** "SelectHealth Integrated" (`d37d3938-b48d-4bdf-b500-bf5413157ef4`)
- **DELETE:** "SelectHealth Care", "SelectHealth Med", "SelectHealth Value"
- **REASON:** These are plan names, not payer entities; plans already exist in `payer_plans`

**⚠️ Risk Assessment:**
- Check if any appointments or bookings reference the incorrect payer IDs
- Check if any `provider_payer_networks` contracts use the wrong IDs

---

## Cleanup Strategy

### Phase 1: Data Verification (DO FIRST)

**Script:** `scripts/verify-duplicate-usage.js`

Check if duplicate payer IDs are referenced in:
1. `provider_payer_networks` (contracts)
2. `payer_plans` (plan definitions)
3. `provider_payer_accepted_plans` (junction table)
4. `appointments` (historical bookings)
5. `payer_plan_aliases` (plan name mappings)

**If any duplicates have data:**
- Option A: Merge foreign key references to canonical ID
- Option B: Keep both and document reason

---

### Phase 2: Safe Deletion Order

**Order matters** - must respect foreign key constraints:

1. **Delete from `payer_plan_aliases`** (if any aliases point to duplicate payers)
2. **Delete from `provider_payer_accepted_plans`** (junction table entries)
3. **Delete from `payer_plans`** (plan definitions for duplicate payers)
4. **Update `provider_payer_networks`** (reassign contracts to canonical payer)
5. **Update `appointments`** (reassign historical bookings to canonical payer - IF payer_id stored)
6. **Delete from `payers`** (finally remove duplicate entries)

---

### Phase 3: Consolidation Plan

#### TRICARE Consolidation

```sql
-- Step 1: Check for orphaned contracts
SELECT id, provider_id, payer_id, status, effective_date
FROM provider_payer_networks
WHERE payer_id IN (
  '0ff47595-9927-44f6-9d18-d2e779c802a7', -- TriCare West
  '677e91d3-d6a9-4f72-b8ee-e9b673d2ccfc', -- TRICARE West
  '08fcf2d8-8f4a-48ed-af1b-f29842b1dbdb'  -- TriWest
);

-- Step 2: Reassign contracts to canonical ID (if any exist)
UPDATE provider_payer_networks
SET payer_id = '677e91d3-d6a9-4f72-b8ee-e9b673d2ccfc' -- TRICARE West
WHERE payer_id IN (
  '0ff47595-9927-44f6-9d18-d2e779c802a7',
  '08fcf2d8-8f4a-48ed-af1b-f29842b1dbdb'
);

-- Step 3: Delete duplicates
DELETE FROM payers
WHERE id IN (
  '0ff47595-9927-44f6-9d18-d2e779c802a7', -- TriCare West
  '08fcf2d8-8f4a-48ed-af1b-f29842b1dbdb'  -- TriWest
);
```

#### Payment Method Consolidation

```sql
-- These should have no foreign key references (verify first!)

-- Delete ACH duplicate
DELETE FROM payers WHERE id = '8c22d4d0-54a9-498c-be2d-79c2213b83a2';

-- Delete Cash duplicate
DELETE FROM payers WHERE id = 'e8e573ef-f66c-4392-a4d4-309376d25d3d';

-- Delete Credit card duplicate
DELETE FROM payers WHERE id = '637f0593-b609-4415-8e49-bb0915fe0f19';
```

#### SelectHealth Consolidation

```sql
-- Step 1: Verify no contracts exist for plan-name payers
SELECT id, provider_id, payer_id, status
FROM provider_payer_networks
WHERE payer_id IN (
  '9b0c0548-4f03-4173-b893-c18d473f8f03', -- SelectHealth Care
  '5f5c8b81-c34b-4454-9cc6-f57abf968a8e', -- SelectHealth Med
  'e964aa50-8b7a-4780-a570-8a035eebd415'  -- SelectHealth Value
);

-- Step 2: Check for plan definitions (shouldn't exist)
SELECT id, plan_name, payer_id
FROM payer_plans
WHERE payer_id IN (
  '9b0c0548-4f03-4173-b893-c18d473f8f03',
  '5f5c8b81-c34b-4454-9cc6-f57abf968a8e',
  'e964aa50-8b7a-4780-a570-8a035eebd415'
);

-- Step 3: If no references, delete
DELETE FROM payers
WHERE id IN (
  '9b0c0548-4f03-4173-b893-c18d473f8f03', -- SelectHealth Care
  '5f5c8b81-c34b-4454-9cc6-f57abf968a8e', -- SelectHealth Med
  'e964aa50-8b7a-4780-a570-8a035eebd415'  -- SelectHealth Value
);
```

---

## Migration Script Structure

**File:** `database-migrations/034-cleanup-duplicate-payers.sql`

```sql
-- Moonlit Scheduler - Payer Database Cleanup
-- Date: 2025-10-31
-- Purpose: Remove duplicate payer entries and consolidate fragmented records

BEGIN;

-- PHASE 1: Verification checks
DO $$
DECLARE
  tricare_contract_count INT;
  payment_contract_count INT;
  selecthealth_fragment_count INT;
BEGIN
  -- Check TRICARE duplicates for contracts
  SELECT COUNT(*) INTO tricare_contract_count
  FROM provider_payer_networks
  WHERE payer_id IN (
    '0ff47595-9927-44f6-9d18-d2e779c802a7',
    '08fcf2d8-8f4a-48ed-af1b-f29842b1dbdb'
  );

  IF tricare_contract_count > 0 THEN
    RAISE NOTICE 'Found % contracts on TRICARE duplicates - will reassign', tricare_contract_count;
  END IF;

  -- Check payment types for contracts
  SELECT COUNT(*) INTO payment_contract_count
  FROM provider_payer_networks
  WHERE payer_id IN (
    '8c22d4d0-54a9-498c-be2d-79c2213b83a2',
    'e8e573ef-f66c-4392-a4d4-309376d25d3d',
    '637f0593-b609-4415-8e49-bb0915fe0f19'
  );

  IF payment_contract_count > 0 THEN
    RAISE EXCEPTION 'Payment types should not have contracts - aborting';
  END IF;

  -- Check SelectHealth fragments for contracts
  SELECT COUNT(*) INTO selecthealth_fragment_count
  FROM provider_payer_networks
  WHERE payer_id IN (
    '9b0c0548-4f03-4173-b893-c18d473f8f03',
    '5f5c8b81-c34b-4454-9cc6-f57abf968a8e',
    'e964aa50-8b7a-4780-a570-8a035eebd415'
  );

  IF selecthealth_fragment_count > 0 THEN
    RAISE NOTICE 'Found % contracts on SelectHealth fragments - will reassign', selecthealth_fragment_count;
  END IF;
END $$;

-- PHASE 2: Reassign contracts (if any)

-- TRICARE: Reassign to canonical "TRICARE West"
UPDATE provider_payer_networks
SET payer_id = '677e91d3-d6a9-4f72-b8ee-e9b673d2ccfc'
WHERE payer_id IN (
  '0ff47595-9927-44f6-9d18-d2e779c802a7',
  '08fcf2d8-8f4a-48ed-af1b-f29842b1dbdb'
);

-- SelectHealth: Reassign to canonical "SelectHealth Integrated"
UPDATE provider_payer_networks
SET payer_id = 'd37d3938-b48d-4bdf-b500-bf5413157ef4'
WHERE payer_id IN (
  '9b0c0548-4f03-4173-b893-c18d473f8f03',
  '5f5c8b81-c34b-4454-9cc6-f57abf968a8e',
  'e964aa50-8b7a-4780-a570-8a035eebd415'
);

-- PHASE 3: Delete duplicates

-- TRICARE duplicates
DELETE FROM payers WHERE id = '0ff47595-9927-44f6-9d18-d2e779c802a7'; -- TriCare West
DELETE FROM payers WHERE id = '08fcf2d8-8f4a-48ed-af1b-f29842b1dbdb'; -- TriWest

-- Payment type duplicates
DELETE FROM payers WHERE id = '8c22d4d0-54a9-498c-be2d-79c2213b83a2'; -- ACH pay #2
DELETE FROM payers WHERE id = 'e8e573ef-f66c-4392-a4d4-309376d25d3d'; -- Cash pay #2
DELETE FROM payers WHERE id = '637f0593-b609-4415-8e49-bb0915fe0f19'; -- Credit card pay #2

-- SelectHealth fragments
DELETE FROM payers WHERE id = '9b0c0548-4f03-4173-b893-c18d473f8f03'; -- SelectHealth Care
DELETE FROM payers WHERE id = '5f5c8b81-c34b-4454-9cc6-f57abf968a8e'; -- SelectHealth Med
DELETE FROM payers WHERE id = 'e964aa50-8b7a-4780-a570-8a035eebd415'; -- SelectHealth Value

-- PHASE 4: Verification
DO $$
DECLARE
  final_count INT;
  duplicate_check INT;
BEGIN
  SELECT COUNT(*) INTO final_count FROM payers;
  RAISE NOTICE 'Final payer count: %', final_count;

  -- Check for remaining duplicates
  SELECT COUNT(*) INTO duplicate_check
  FROM payers
  GROUP BY name
  HAVING COUNT(*) > 1;

  IF duplicate_check > 0 THEN
    RAISE WARNING 'Still have % duplicate payer names', duplicate_check;
  ELSE
    RAISE NOTICE '✅ No duplicate payer names remaining';
  END IF;
END $$;

COMMIT;
```

---

## Expected Results

### Before Cleanup:
- 37 payers total
- 9 duplicate entries
- 14 payers with contracts

### After Cleanup:
- **28 payers total** (37 - 9 = 28)
- **0 duplicate entries**
- **14 payers with contracts** (preserved)
- **1 payer with plans** (SelectHealth Integrated - unchanged)

---

## Rollback Plan

If cleanup causes issues:

```sql
-- Rollback is built into migration (BEGIN/COMMIT)
-- If script fails, ROLLBACK will automatically occur

-- Manual rollback: restore from before cleanup
-- (User should create database backup before running)
```

---

## Verification Steps

After running cleanup:

1. **Count check:**
   ```bash
   node scripts/check-payers-status.js
   ```
   Expected: 28 payers, 14 with contracts, 1 with plans

2. **Booking test:**
   - Try booking with TRICARE West
   - Try booking with SelectHealth Integrated
   - Verify no errors

3. **Contract check:**
   - Verify all 14 payers with contracts still have contracts
   - Check no orphaned contracts

---

## Next Steps

1. ✅ **Review this plan** with user
2. ⏸️ **Create verification script** (`scripts/verify-duplicate-usage.js`)
3. ⏸️ **Run verification** to check for foreign key references
4. ⏸️ **Create migration** (`034-cleanup-duplicate-payers.sql`)
5. ⏸️ **Take database backup** (user responsibility)
6. ⏸️ **Run migration** on development database
7. ⏸️ **Verify results** using check script
8. ⏸️ **Deploy to production** after testing

---

## Risk Assessment

**LOW RISK:**
- Payment type duplicates (no contracts, no plans)
- SelectHealth fragments (no contracts, plans are on Integrated)

**MEDIUM RISK:**
- TRICARE consolidation (contract exists, need to verify correct payer)

**MITIGATION:**
- Verification script catches foreign key references
- Transaction ensures atomic changes (all or nothing)
- User should backup database before running

---

## Questions for User

1. **TRICARE contract location:** Should we search for the TRICARE contract in `provider_payer_networks` to see which duplicate it's actually on?

2. **Payment types:** Do you actually need ACH/Cash/Credit card as "payers" in the database? These seem like payment methods, not insurance companies.

3. **Backup strategy:** Do you have a database backup process? Should we create a snapshot before running this cleanup?

4. **Testing environment:** Should we run this on a dev/staging database first, or go straight to production?

---

**Status:** 🟡 AWAITING USER REVIEW
