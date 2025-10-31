# Implementation Guide: Multi-Plan Network Architecture

**Status:** ✅ Code Complete - Ready for Migration
**Branch:** `dev/session-oct-31-2025`
**Date:** October 31, 2025

## Executive Summary

This implementation adds plan-level insurance verification to prevent booking errors when patients belong to specific sub-plans or networks within the same payer (e.g., Regence BHPN vs Traditional, SelectHealth Advantage vs Traditional).

### Problem Solved
- **Before:** System only tracked payer-level relationships (e.g., "Provider in network with Regence")
- **After:** System tracks network AND plan-level relationships (e.g., "Provider in Regence BHPN network for PPO plans")
- **Impact:** Prevents incorrect bookings for patients whose specific plan/network doesn't match provider's contract

---

## What Was Built

### 1. Database Schema (7 Migration Files)

| Migration | Purpose | Tables/Functions |
|-----------|---------|------------------|
| `022-add-payer-network-and-plan-tables.sql` | Core schema | 4 new tables: `payer_networks`, `payer_plans`, `payer_plan_aliases`, `payer_plan_routing_ids` |
| `023-extend-provider-payer-networks-for-plans.sql` | Link providers to networks | Added `network_id`, `plan_id` columns to `provider_payer_networks` |
| `024-create-plan-resolution-functions.sql` | Plan matching logic | 3 functions: `resolve_plan_to_network()`, `is_provider_in_network_for_plan()`, `get_bookable_providers_for_plan()` |
| `025-update-bookable-view-with-networks.sql` | Extend canonical view | Updated `v_bookable_provider_payer` with network/plan columns |
| `026-seed-big3-payer-networks-and-plans.sql` | Initial data | Seeds networks and plans for Regence, SelectHealth, Aetna |
| `027-update-booking-trigger-for-plan-validation.sql` | Booking validation | Updated `enforce_bookable_provider_payer()` trigger to check plans |

### 2. API Updates

**File:** `src/app/api/patient-booking/book/route.ts`

- Added `planName` field to `IntakeBookingRequest` interface
- Stores `plan_name` in `appointments.insurance_info` JSONB
- Logs plan information for debugging

### 3. TypeScript Types

**File:** `src/types/database.ts`

- Added types for 4 new tables
- Updated `provider_payer_networks` with `network_id`, `plan_id`, `network_notes`

---

## How It Works

### Data Flow: Plan Resolution

```
1. Patient enters insurance info
   ↓
2. Booking API receives plan_name (e.g., "REGENCE BCBS")
   ↓
3. resolve_plan_to_network() function:
   - Looks up in payer_plan_aliases
   - Finds canonical plan (e.g., "Regence BlueShield PPO (BHPN)")
   - Returns network_id for BHPN network
   ↓
4. Booking trigger validates:
   - Checks provider_payer_networks for provider + payer + network
   - If network_id = NULL → provider accepts all networks (legacy)
   - If network_id matches → booking allowed
   - If no match → booking rejected with helpful error
   ↓
5. Success: Appointment created with plan_name stored in insurance_info
```

### Backward Compatibility

- **Existing contracts:** `network_id = NULL` means "all networks under this payer"
- **No breaking changes:** Legacy payer-level validation still works
- **Graceful degradation:** If plan_name not provided, falls back to payer-level check

---

## Running the Migrations

### Prerequisites

1. **Database access:** Supabase admin credentials
2. **Backup:** Create database backup before running migrations
3. **Maintenance window:** Recommended but not required (brief downtime acceptable per user)

### Migration Order (Run in Sequence)

```bash
# Navigate to migrations directory
cd /Users/miriam/CODE/moonlit-scheduler-session-oct-31/database-migrations

# Run migrations via Supabase CLI or SQL editor
supabase db execute -f 022-add-payer-network-and-plan-tables.sql
supabase db execute -f 023-extend-provider-payer-networks-for-plans.sql
supabase db execute -f 024-create-plan-resolution-functions.sql
supabase db execute -f 025-update-bookable-view-with-networks.sql
supabase db execute -f 026-seed-big3-payer-networks-and-plans.sql
supabase db execute -f 027-update-booking-trigger-for-plan-validation.sql
```

### Post-Migration Verification

```sql
-- Verify tables created
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('payer_networks', 'payer_plans', 'payer_plan_aliases', 'payer_plan_routing_ids');
-- Expected: 4 rows

-- Check seed data
SELECT payer.name, pn.network_name, COUNT(pp.id) AS plan_count
FROM payer_networks pn
JOIN payers payer ON pn.payer_id = payer.id
LEFT JOIN payer_plans pp ON pn.id = pp.network_id
GROUP BY payer.name, pn.network_name
ORDER BY payer.name, pn.network_name;
-- Expected: Regence (2 networks), SelectHealth (4 networks), Aetna (2 networks)

-- Verify functions exist
SELECT proname FROM pg_proc
WHERE proname IN ('resolve_plan_to_network', 'is_provider_in_network_for_plan', 'get_bookable_providers_for_plan');
-- Expected: 3 rows

-- Check trigger updated
SELECT prosrc LIKE '%is_provider_in_network_for_plan%' AS uses_plan_validation
FROM pg_proc WHERE proname = 'enforce_bookable_provider_payer';
-- Expected: TRUE
```

---

## Assigning Providers to Networks

### Step 1: Identify Providers Needing Assignment

```sql
-- View all Big 3 payer contracts without network assignment
SELECT * FROM v_providers_needing_network_assignment
ORDER BY assignment_priority DESC, provider_name;
```

### Step 2: Update Provider Contracts with Network IDs

**Option A: Update Existing Contracts**

```sql
-- Example: Assign Dr. Privratsky to Regence BHPN network
UPDATE provider_payer_networks
SET network_id = (
    SELECT id FROM payer_networks
    WHERE payer_id = (SELECT id FROM payers WHERE name ILIKE '%regence%')
      AND network_code = 'BHPN'
)
WHERE provider_id = '504d53c6-54ef-40b0-81d4-80812c2c7bfd'  -- Dr. Privratsky
  AND payer_id = (SELECT id FROM payers WHERE name ILIKE '%regence%');
```

**Option B: Create Network-Specific Contracts**

If a provider is in multiple networks under the same payer, create separate contracts:

```sql
-- Example: Provider in both BHPN and Traditional networks
INSERT INTO provider_payer_networks (
    provider_id,
    payer_id,
    network_id,
    effective_date,
    status
) VALUES
-- BHPN network contract
(
    '[provider-id]',
    (SELECT id FROM payers WHERE name ILIKE '%regence%'),
    (SELECT id FROM payer_networks WHERE network_code = 'BHPN'),
    '2024-01-01',
    'active'
),
-- Traditional network contract
(
    '[provider-id]',
    (SELECT id FROM payers WHERE name ILIKE '%regence%'),
    (SELECT id FROM payer_networks WHERE network_code = 'TRAD'),
    '2024-01-01',
    'active'
);
```

### Step 3: Verify Assignment

```sql
-- Check provider's network assignments
SELECT
    p.first_name || ' ' || p.last_name AS provider_name,
    payer.name AS payer_name,
    pn.network_name,
    ppn.effective_date,
    ppn.expiration_date,
    ppn.status
FROM provider_payer_networks ppn
JOIN providers p ON ppn.provider_id = p.id
JOIN payers payer ON ppn.payer_id = payer.id
LEFT JOIN payer_networks pn ON ppn.network_id = pn.id
WHERE p.id = '[provider-id]'
ORDER BY payer.name, pn.network_name;
```

---

## Testing the Implementation

### Test 1: Plan Resolution Function

```sql
-- Test resolving "REGENCE BCBS" to canonical plan
SELECT * FROM resolve_plan_to_network(
    (SELECT id FROM payers WHERE name ILIKE '%regence%'),
    'REGENCE BCBS'
);

-- Expected output:
-- plan_id | network_id | plan_name | confidence
-- [uuid]  | [uuid]     | Regence BlueShield PPO (BHPN) | high
```

### Test 2: Provider Network Check

```sql
-- Check if specific provider can see Regence BHPN patients
SELECT * FROM is_provider_in_network_for_plan(
    '504d53c6-54ef-40b0-81d4-80812c2c7bfd',  -- Dr. Privratsky
    (SELECT id FROM payers WHERE name ILIKE '%regence%'),
    'REGENCE BCBS',
    CURRENT_DATE
);

-- Expected: in_network = TRUE if assigned to BHPN network
```

### Test 3: Booking Flow End-to-End

**Step 1: Get available providers for plan**

```bash
curl -X GET 'http://localhost:3000/api/patient-booking/merged-availability?date=2025-11-15&payerId=[regence-payer-id]' \
  -H 'Content-Type: application/json'
```

**Step 2: Book appointment with plan name**

```bash
curl -X POST 'http://localhost:3000/api/patient-booking/book' \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: test-regence-bhpn-12345' \
  -d '{
    "patientId": "[patient-id]",
    "providerId": "[provider-id]",
    "payerId": "[regence-payer-id]",
    "planName": "REGENCE BCBS",
    "start": "2025-11-15T10:00:00.000Z",
    "locationType": "telehealth",
    "memberId": "ABC123456",
    "groupNumber": "GRP789"
  }'
```

**Expected Success Response:**

```json
{
  "success": true,
  "data": {
    "appointmentId": "[uuid]",
    "pqAppointmentId": "[intakeq-id]",
    "status": "scheduled"
  }
}
```

**Expected Error (If Wrong Network):**

```json
{
  "success": false,
  "error": "Provider not in network for plan \"REGENCE BCBS\" on this date. Provider not in BHPN network",
  "code": "NOT_BOOKABLE"
}
```

### Test 4: Verify Database Trigger

Try to insert appointment with invalid network (should be rejected):

```sql
-- This should FAIL if provider not in BHPN network
INSERT INTO appointments (
    provider_id,
    payer_id,
    patient_id,
    service_instance_id,
    start_time,
    end_time,
    status,
    insurance_info
) VALUES (
    '[provider-id]',
    (SELECT id FROM payers WHERE name ILIKE '%regence%'),
    '[patient-id]',
    '[service-instance-id]',
    '2025-11-15 10:00:00-07',
    '2025-11-15 11:00:00-07',
    'scheduled',
    '{"plan_name": "REGENCE BCBS", "payer_name": "Regence"}'::jsonb
);

-- Expected: ERROR: Provider not in network for plan "REGENCE BCBS" on this date
```

---

## Adding New Plan Aliases

As you encounter new plan name variations from 271 responses or insurance cards:

```sql
-- Add new alias for existing plan
INSERT INTO payer_plan_aliases (plan_id, alias_string, source, priority, is_active)
VALUES (
    (SELECT id FROM payer_plans WHERE plan_name = 'Regence BlueShield PPO (BHPN)'),
    'BCBS OF UTAH PPO',  -- New variation seen on insurance card
    'insurance_card',
    85,  -- Priority (higher = preferred)
    TRUE
);
```

---

## Troubleshooting

### Issue: "Provider not in network" error but should be

**Diagnosis:**

```sql
-- Check if provider has ANY contract with payer
SELECT * FROM provider_payer_networks
WHERE provider_id = '[provider-id]'
  AND payer_id = '[payer-id]';

-- Check if network_id is set
SELECT
    ppn.*,
    pn.network_name
FROM provider_payer_networks ppn
LEFT JOIN payer_networks pn ON ppn.network_id = pn.id
WHERE ppn.provider_id = '[provider-id]'
  AND ppn.payer_id = '[payer-id]';
```

**Solution:**

- If `network_id = NULL` → Provider accepts all networks (should work)
- If `network_id` set but doesn't match patient's plan → Need to add network contract
- If no contract found → Need to create provider-payer relationship

### Issue: Plan name not resolving

**Diagnosis:**

```sql
-- Check if alias exists
SELECT * FROM payer_plan_aliases
WHERE alias_string ILIKE '%[partial-plan-name]%';

-- Check plan exists
SELECT * FROM payer_plans
WHERE payer_id = '[payer-id]'
  AND plan_name ILIKE '%[partial-name]%';
```

**Solution:**

- Add missing alias to `payer_plan_aliases` table
- Or set a plan as `is_default = TRUE` for fallback

### Issue: Trigger not firing

**Diagnosis:**

```sql
-- Verify trigger exists and is enabled
SELECT
    tgname,
    tgenabled,
    pg_get_triggerdef(oid) AS definition
FROM pg_trigger
WHERE tgname = 'check_bookable_provider_payer';
```

**Solution:**

Re-run migration `027-update-booking-trigger-for-plan-validation.sql`

---

## Future Enhancements

### Short Term (1-2 weeks)

1. **Admin UI for Network Assignment**
   - Build page at `/admin/providers/networks`
   - Allow assigning providers to specific networks via dropdown
   - Show current network assignments in provider list

2. **Booking UI Plan Selection**
   - Add optional plan dropdown in booking flow
   - Populate from patient's 271 eligibility response
   - Save to `insurance_info.plan_name`

3. **Plan Analytics Dashboard**
   - Track which plan names are used most
   - Identify unmatched plan strings
   - Monitor booking success rate by plan

### Medium Term (1-2 months)

1. **271 Eligibility Integration**
   - Auto-populate `planName` from real-time eligibility check
   - Parse plan info from 271 response
   - Pre-filter providers based on patient's actual plan

2. **Clearinghouse Routing**
   - Use `payer_plan_routing_ids` for claims submission
   - Map plans to Office Ally payer IDs
   - Auto-select correct routing ID based on plan

3. **Network Participation Reports**
   - Generate reports of provider network coverage
   - Identify gaps in network participation
   - Track contract effective/expiration dates

---

## Key Files Modified

| File | Changes |
|------|---------|
| `database-migrations/022-027-*.sql` | 6 new migration files |
| `src/app/api/patient-booking/book/route.ts` | Added `planName` parameter, stores in `insurance_info` |
| `src/types/database.ts` | Added 4 new table types, updated `provider_payer_networks` |

## Key Files Created

| File | Purpose |
|------|---------|
| `IMPLEMENTATION_GUIDE_PAYER_NETWORKS.md` | This guide |

---

## Questions & Support

### Common Questions

**Q: Do I need to assign networks to ALL providers?**
A: No. Existing contracts with `network_id = NULL` will continue to work. Only assign networks for Big 3 payers (Regence, SelectHealth, Aetna) where you've had booking errors.

**Q: What if I don't know which network a provider is in?**
A: Leave `network_id = NULL` for now. The system will allow bookings for any plan. Update once you confirm network participation from payer contract docs.

**Q: Can a provider be in multiple networks for the same payer?**
A: Yes! Create separate `provider_payer_networks` rows for each network.

**Q: What happens if patient's plan doesn't match any alias?**
A: The system falls back to the plan marked `is_default = TRUE` for that payer. If none exists, uses payer-level validation (legacy behavior).

---

## Deployment Checklist

- [ ] Review all 6 migration files
- [ ] Create database backup
- [ ] Run migrations in sequence (022 → 027)
- [ ] Verify seed data created (Big 3 payers)
- [ ] Test plan resolution function
- [ ] Test booking with plan_name
- [ ] Update provider network assignments for Big 3 payers
- [ ] Test end-to-end booking flow
- [ ] Monitor logs for plan resolution activity
- [ ] Document any new plan aliases encountered
- [ ] Update CLAUDE.md with completed implementation

---

**Implementation Date:** October 31, 2025
**Status:** ✅ Ready for Migration
**Estimated Migration Time:** 30 minutes
**Estimated Provider Assignment Time:** 1-2 hours (depending on number of providers)

