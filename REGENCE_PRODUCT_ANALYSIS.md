# Regence BCBS Utah - Patient Insurance Products Analysis

**Date:** October 31, 2025
**Source:** Regence 2025 Individual & Family Plans Brochure (Official)
**Contract:** Moonlit provider contract effective November 1, 2025

---

## Key Finding: Products vs Networks

### ✅ CORRECT - Patient-Facing Insurance Products (11 total)

These are what patients purchase and see on their insurance cards:

#### Individual & Family Network (IAFN) Plans - 8 products

1. **Bronze Essential 8500** (With 4 Copay No Deductible Office Visits)
   - Deductible: $8,500
   - OOPM: $9,200
   - Type: PPO (Essential tier)
   - Special feature: Virtual Primary Care, 4 office visits before deductible

2. **Regence Standard Bronze 7500** (Marketplace Only)
   - Deductible: $7,500
   - OOPM: $9,200
   - Type: PPO (Standard tier)

3. **Bronze HSA 7000**
   - Deductible: $7,000
   - OOPM: $8,050
   - Type: PPO (HSA-qualified)
   - Special feature: HSA-compatible

4. **Regence Standard Silver 5000** (Marketplace Only)
   - Deductible: $5,000
   - OOPM: $8,000
   - Type: PPO (Standard tier)

5. **Silver 6200**
   - Deductible: $6,200
   - OOPM: $9,200
   - Type: PPO (Traditional tier)
   - Special feature: Individual Assistance Program included

6. **Silver 5000**
   - Deductible: $5,000
   - OOPM: $9,200
   - Type: PPO (Traditional tier)
   - Special feature: Individual Assistance Program included

7. **Gold 2300**
   - Deductible: $2,300
   - OOPM: $9,200
   - Type: PPO (Traditional tier)
   - Special feature: Individual Assistance Program included

8. **Regence Standard Gold 1500** (Marketplace Only)
   - Deductible: $1,500
   - OOPM: $7,800
   - Type: PPO (Standard tier)

#### SaveWell Network Plans - 3 products

9. **SaveWell Standard Bronze 7500**
   - Deductible: $7,500
   - OOPM: $9,200
   - Type: PPO (SaveWell network)
   - Network: Holy Cross Hospitals + CommonSpirit Health

10. **SaveWell Standard Silver 5000**
    - Deductible: $5,000
    - OOPM: $8,000
    - Type: PPO (SaveWell network)

11. **SaveWell Standard Gold 1500**
    - Deductible: $1,500
    - OOPM: $7,800
    - Type: PPO (SaveWell network)

---

### ❌ INCORRECT - Provider Network Tiers (from contract)

These are NOT insurance products patients purchase. These are internal reimbursement routing mechanisms:

1. Participating (standard network)
2. Preferred ValueCare
3. FocalPoint (90% of standard rates)
4. Individual and Family Network (85% of standard rates)
5. RealValue (85% of standard rates)
6. Individual Connect (85% of standard rates)
7. Individual Value (85% of standard rates)
8. Preferred BlueOption
9. Blue High Performance Network (90% of standard rates)
10. SaveWell
11. Regence MedAdvantage PPO (Medicare Advantage - 100% of Medicare rates)

**Why these don't go in `payer_plans` table:**
- Patients don't know these network names
- These affect provider reimbursement, not patient coverage
- Not visible on insurance cards
- Not used for eligibility verification

---

## Critical Distinction

### What Patients Say:
- "I have Regence Silver 6200"
- "I have Regence SaveWell Bronze"
- "I have Regence Gold 2300"

### What Patients DON'T Say:
- "I have FocalPoint" ❌
- "I have Individual Value" ❌
- "I have Blue High Performance Network" ❌

---

## Database Schema Mapping

### `payer_plans` table (what to add):
```sql
INSERT INTO payer_plans (payer_id, plan_name, plan_type, is_default, notes)
VALUES
  -- IAFN Bronze tier
  (regence_id, 'Bronze Essential 8500', 'PPO', false, 'Essential tier with Virtual Primary Care'),
  (regence_id, 'Regence Standard Bronze 7500', 'PPO', false, 'Marketplace only'),
  (regence_id, 'Bronze HSA 7000', 'PPO', false, 'HSA-qualified plan'),

  -- IAFN Silver tier
  (regence_id, 'Regence Standard Silver 5000', 'PPO', false, 'Marketplace only'),
  (regence_id, 'Silver 6200', 'PPO', true, 'Traditional tier with IAP'),
  (regence_id, 'Silver 5000', 'PPO', false, 'Traditional tier with IAP'),

  -- IAFN Gold tier
  (regence_id, 'Gold 2300', 'PPO', false, 'Traditional tier with IAP'),
  (regence_id, 'Regence Standard Gold 1500', 'PPO', false, 'Marketplace only'),

  -- SaveWell network
  (regence_id, 'SaveWell Standard Bronze 7500', 'PPO', false, 'SaveWell network'),
  (regence_id, 'SaveWell Standard Silver 5000', 'PPO', false, 'SaveWell network'),
  (regence_id, 'SaveWell Standard Gold 1500', 'PPO', false, 'SaveWell network');
```

### Plan Aliases (for fuzzy matching):
```sql
-- Bronze Essential 8500
INSERT INTO payer_plan_aliases (plan_id, alias_string, source, priority)
VALUES
  (plan_id, 'Bronze Essential 8500', 'insurance_card', 100),
  (plan_id, 'BRONZE ESSENTIAL 8500', '271_response', 100),
  (plan_id, 'Essential Bronze', 'insurance_card', 80),
  (plan_id, 'Regence Bronze Essential', 'insurance_card', 90);

-- SaveWell plans
INSERT INTO payer_plan_aliases (plan_id, alias_string, source, priority)
VALUES
  (plan_id, 'SaveWell Standard Bronze 7500', 'insurance_card', 100),
  (plan_id, 'SAVEWELL BRONZE', '271_response', 90),
  (plan_id, 'SaveWell Bronze', 'insurance_card', 85);
```

---

## Implementation Strategy

### Step 1: Determine Which Plans Moonlit Accepts

**Question for user:** Does Moonlit's Regence contract (effective Nov 1, 2025) accept:
- ✅ All 11 products listed above?
- ⚠️ Only specific network products (IAFN vs SaveWell)?
- ⚠️ Only specific metal tiers (Bronze/Silver/Gold)?

**From contract review:**
- Contract lists "Individual and Family Network" - suggests IAFN products accepted
- Contract lists "SaveWell" - suggests SaveWell products accepted
- Need to confirm: Does contract accept ALL Regence products or only specific ones?

**Recommendation:** If contract doesn't specify exclusions, assume all 11 products are accepted.

### Step 2: Add Products to Database

Create migration script similar to SelectHealth approach:

```bash
scripts/add-regence-plans.mjs
```

### Step 3: Populate Junction Table

Link Moonlit's Regence contract to accepted products:

```bash
scripts/populate-regence-junction-table.mjs
```

### Step 4: Verification

```bash
scripts/verify-regence-plans.ts
```

---

## Comparison to SelectHealth

| Aspect | SelectHealth | Regence |
|--------|-------------|---------|
| **Products in contract** | 6 plans listed explicitly | 11 products available (not explicit in contract) |
| **Contract structure** | Product-based (names plans) | Network-based (names routing tiers) |
| **Default plan** | Select Choice (PPO) | Silver 6200 (most popular) |
| **Metal tiers** | Bronze, Silver, Gold, Platinum (implied) | Bronze, Silver, Gold (no Platinum in UT) |
| **Special products** | Medicaid (Select Access) | HSA-qualified, Essential tier, SaveWell |
| **Network types** | Traditional network | IAFN + SaveWell (narrow network) |

---

## Next Actions

1. **User Decision:** Confirm which Regence products Moonlit accepts
2. **Create migration:** Add 11 Regence products to `payer_plans`
3. **Populate junction:** Link Moonlit's Regence contract to accepted products
4. **Add aliases:** Create fuzzy matching for common card variations
5. **Test:** Verify bookability trigger works with Regence plans

---

## Notes

- **SaveWell network discontinued for 2026:** Brochure mentions SaveWell is being discontinued for 2026 plan year
- **Geographic coverage:** IAFN covers all of Utah; SaveWell only Davis, Salt Lake, and northern Utah County
- **Moonlit location:** Salt Lake City - within both IAFN and SaveWell service areas
- **Plan types:** All Regence Utah products are PPO (no HMO/EPO for individual/family plans)
- **Marketplace vs Direct:** Some plans sold only on Healthcare.gov, others available direct from Regence
- **Individual Assistance Program (IAP):** Only available on Silver 6200, Silver 5000, Gold 2300 (IAFN plans)
