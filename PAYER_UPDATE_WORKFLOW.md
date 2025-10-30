# Patient Payer Update Workflow

## Problem
You found an incorrect payer on an appointment in the finance page. Where do you update it upstream so it's correct for future appointments?

## Data Flow

```
IntakeQ Custom Fields
        ↓
practiceQSyncService.ts
        ↓
patients.primary_payer_id  ← UPSTREAM SOURCE
        ↓
appointments.payer_id  ← DISPLAYED ON FINANCE PAGE
```

---

## Update Locations

### 1. **Upstream Source: Patient Record**
**Table:** `patients.primary_payer_id`
**Update via:**
- SQL (Supabase SQL Editor)
- IntakeQ re-sync (if IntakeQ has correct insurance info)

**SQL Example:**
```sql
-- Find the patient
SELECT id, first_name, last_name, email, primary_payer_id
FROM patients
WHERE email = 'patient@example.com';

-- Find the correct payer ID
SELECT id, name, payer_type
FROM payers
WHERE name ILIKE '%SelectHealth%';

-- Update the patient's payer
UPDATE patients
SET primary_payer_id = 'correct-payer-uuid-here'
WHERE id = 'patient-uuid-here';
```

### 2. **Existing Appointments**
**Table:** `appointments.payer_id`
**Note:** Appointments have their own `payer_id` column - updating the patient record DOES NOT automatically update existing appointments.

**To fix existing appointments:**

**Option A: Update individual appointment (SQL)**
```sql
-- Find the incorrect appointment
SELECT id, start_time, patient_id, payer_id
FROM appointments
WHERE id = 'appointment-uuid-from-finance-page';

-- Update the appointment's payer
UPDATE appointments
SET payer_id = 'correct-payer-uuid-here'
WHERE id = 'appointment-uuid-here';
```

**Option B: Backfill all appointments for a patient (SQL)**
```sql
-- Update ALL appointments for a specific patient to match their current primary payer
UPDATE appointments a
SET payer_id = p.primary_payer_id
FROM patients p
WHERE a.patient_id = p.id
  AND p.email = 'patient@example.com'
  AND p.primary_payer_id IS NOT NULL;
```

**Option C: Re-sync from IntakeQ**
If IntakeQ has the correct insurance information, you can trigger a re-sync:
1. Go to Admin Dashboard → Patients
2. Find the patient
3. Click "Sync Appointments" button (if available)
4. This will re-fetch from IntakeQ and update both patient and appointment payer info

---

## Current UI Support

### Admin Patients Page (`/admin/patients`)
**What it shows:**
- ✅ Patient's `primary_payer_id` (displayed as payer name)
- ✅ Filterable by payer
- ✅ Sortable by payer

**What it DOESN'T support yet:**
- ❌ Inline editing of payer (no UI to change it)
- ❌ Individual appointment payer editing

**Workaround:** Update via SQL (see examples above)

### Finance Appointments Page (`/admin/finance/appointments`)
**What it shows:**
- ✅ Appointment's `payer_id` (from appointments table)
- ✅ Expected gross based on fee schedules

**What it DOESN'T support yet:**
- ❌ Inline editing of appointment payer

**Workaround:** Update via SQL (see Option A above)

---

## Recommended Workflow

### For a Single Incorrect Appointment:

1. **Identify the patient and appointment**
   - Note the appointment ID from finance page
   - Note the patient email/name

2. **Find correct payer**
   ```sql
   SELECT id, name, payer_type FROM payers ORDER BY name;
   ```

3. **Update the patient record (for future)**
   ```sql
   UPDATE patients
   SET primary_payer_id = 'correct-payer-uuid'
   WHERE email = 'patient@example.com';
   ```

4. **Update the specific appointment (for current)**
   ```sql
   UPDATE appointments
   SET payer_id = 'correct-payer-uuid'
   WHERE id = 'appointment-uuid-from-finance-page';
   ```

5. **Refresh finance page** to verify correct amount displays

### For Multiple Appointments (Same Patient):

1. **Update patient record first**
2. **Backfill all their appointments**
   ```sql
   UPDATE appointments a
   SET payer_id = p.primary_payer_id
   FROM patients p
   WHERE a.patient_id = p.id
     AND p.email = 'patient@example.com'
     AND p.primary_payer_id IS NOT NULL;
   ```

---

## IntakeQ Sync Behavior

### Current Implementation (from practiceQSyncService.ts)

The `practiceQSyncService.ts` was modified to extract payer information from IntakeQ custom fields and populate `appointments.payer_id` during sync.

**IntakeQ Custom Fields → Payer Mapping:**
```typescript
// Extract from IntakeQ custom field
const insuranceCompany = customFields['Insurance Company']

// Map to Supabase payer
const { data: payer } = await supabase
  .from('payers')
  .select('id')
  .ilike('name', insuranceCompany)
  .single()

// Save to appointment
payer_id: payer?.id
```

**When IntakeQ sync updates payer:**
- ✅ New appointments created from IntakeQ get correct payer
- ✅ Patient's `primary_payer_id` gets updated if IntakeQ has different insurance
- ⚠️ Existing appointments are NOT updated by default (would need re-sync)

---

## Future Enhancements (Not Yet Built)

### Patient Edit UI
Create a patient detail page with inline editing:
- `/admin/patients/[patientId]` page
- Dropdown to select payer
- Save button to update `patients.primary_payer_id`

### Appointment Edit UI
Add inline editing to finance appointments table:
- Click payer cell to edit
- Dropdown to select correct payer
- Auto-save on change
- Recalculate expected gross immediately

### Bulk Update Tool
Create admin tool for bulk payer corrections:
- Select multiple appointments
- Change payer for all selected
- Preview expected gross changes
- Confirm and apply

---

## Quick Reference

| What You Want | Where to Update | Method |
|---------------|-----------------|--------|
| Fix future appointments for a patient | `patients.primary_payer_id` | SQL or IntakeQ re-sync |
| Fix single existing appointment | `appointments.payer_id` | SQL (Option A) |
| Fix all appointments for a patient | `appointments.payer_id` | SQL (Option B - backfill) |
| Sync from IntakeQ source of truth | Trigger re-sync | Admin UI (if available) or SQL |

---

## Example: Complete Fix for Patient "Rufus Sweeney"

**Scenario:** Rufus Sweeney's appointment shows "Cash" but he has SelectHealth insurance.

```sql
-- Step 1: Find Rufus's patient ID
SELECT id, first_name, last_name, email, primary_payer_id
FROM patients
WHERE first_name = 'Rufus' AND last_name = 'Sweeney';
-- Result: id = '123abc...'

-- Step 2: Find SelectHealth Integrated payer ID
SELECT id, name FROM payers WHERE name ILIKE '%SelectHealth%';
-- Result: id = '456def...'

-- Step 3: Update patient record (for future appointments)
UPDATE patients
SET primary_payer_id = '456def...'
WHERE id = '123abc...';

-- Step 4: Update all Rufus's existing appointments
UPDATE appointments
SET payer_id = '456def...'
WHERE patient_id = '123abc...';

-- Step 5: Verify the fix
SELECT
  a.id,
  a.start_time,
  p.name as payer_name,
  py.first_name || ' ' || py.last_name as patient_name
FROM appointments a
JOIN patients py ON py.id = a.patient_id
LEFT JOIN payers p ON p.id = a.payer_id
WHERE a.patient_id = '123abc...'
ORDER BY a.start_time DESC;
```

After running these queries, refresh the finance page - Rufus's appointments should now show correct SelectHealth rates ($188.76, $249.11, etc.) instead of Cash rates ($400, $133, $266).
