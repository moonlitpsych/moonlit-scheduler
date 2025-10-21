# PracticeQ Sync Enhancements - Oct 21, 2025

## Summary

Enhanced the PracticeQ sync service to automatically extract and map patient insurance information from IntakeQ custom fields.

## Problem Identified

**Initial Issue:** After syncing from PracticeQ, patient payer data was not being updated.

- Only **15 of 93 patients** had payer information
- User confirmed insurance data exists in IntakeQ (e.g., patient Hyrum Bay has DMBA)
- But sync was not pulling this data

## Root Cause Analysis

Through investigation, we discovered:

1. **IntakeQ API Limitations:**
   - GET `/appointments` - Returns appointments but NO insurance data in main fields ❌
   - GET `/clients/{id}` - Returns HTML errors (endpoint not accessible) ❌
   - GET `/intakes` - Not supported (405 Method Not Allowed) ❌

2. **The Solution - Custom Fields:**
   - Insurance data **IS** available in IntakeQ! ✅
   - Stored in `CustomFields` array on appointment responses
   - Field label: "What is the name of your insurance company?"
   - Found in 37 out of 100 appointments

3. **Why Only Some Patients:**
   - Patients who **book through intake forms** → Have custom fields with insurance ✅
   - Patients **scheduled directly by providers** → No custom fields ❌

## Implementation

### 1. Enhanced IntakeQ Interface

Added `CustomFields` to `IntakeQAppointment` interface:

```typescript
interface IntakeQAppointment {
  // ... existing fields
  CustomFields?: Array<{
    Label?: string
    Name?: string
    Value?: string
    Answer?: string
  }>
}
```

### 2. Insurance Extraction Method

`extractInsuranceFromCustomFields()` - Finds and extracts insurance company name from custom fields:

```typescript
private extractInsuranceFromCustomFields(appointment: IntakeQAppointment): string | null
```

### 3. Insurance Name → Payer ID Mapping

`mapInsuranceToPayer()` - Maps free-text insurance names to structured payer IDs:

**Mapping Table:**
| IntakeQ Name | Database Payer |
|---|---|
| DMBA | DMBA |
| HCU / Health Choice | Health Choice Utah |
| UUHP | HealthyU (UUHP) |
| Utah Medicaid / Medicaid | Utah Medicaid Fee-for-Service |
| TAM / TAMS | Utah Medicaid Fee-for-Service |
| Molina | Molina Utah |
| SelectHealth | SelectHealth Integrated |
| HMHI | HMHI BHN |
| Optum | Optum Commercial BH |
| United | United Healthcare |
| Aetna, Cigna, Regence, etc. | Respective payers |

### 4. Patient Payer Update

`updatePatientPayer()` - Updates `patients.primary_payer_id` when insurance is found:

```typescript
private async updatePatientPayer(patientId: string, appointment: IntakeQAppointment): Promise<void>
```

### 5. Integration into Sync Loop

Modified `syncPatientAppointments()` to call `updatePatientPayer()` for each appointment processed.

## Files Modified

- `/src/lib/services/practiceQSyncService.ts` - Added insurance extraction and mapping logic

## Expected Results

When syncing patients from PracticeQ:

1. **Patients with custom fields** (37 out of 100 appointments):
   - ✅ Insurance extracted from custom fields
   - ✅ Mapped to payer in database
   - ✅ `primary_payer_id` updated automatically

2. **Patients without custom fields** (like Hyrum Bay):
   - ⚠️ No custom fields available
   - ⚠️ Payer not updated
   - 💡 Requires manual payer assignment or IntakeQ client profile access

## Sample Insurance Data Found in IntakeQ

From `scripts/check-custom-fields.ts` output:

```
Michael Sweitzer: What is the name of your insurance company? = Medicaid
Patrick Meacham: What is the name of your insurance company? = Medicaid
Charles Haynes: What is the name of your insurance company? = Utah Medicaid
RYLEE TRUJILLO: What is the name of your insurance company? = Health Choice of Utah - Integrated Medicaid
Sione Lavaka: What is the name of your insurance company? = UUHP
Matthew Reese: What is the name of your insurance company? = Targeted Adult Medicaid
Luis Rivas: What is the name of your insurance company? = TAM Medicaid
Kaelin Hale: What is the name of your insurance company? = Medicaid
Michael Moore: What is the name of your insurance company? = HCU
Ryan Burke: What is the name of your insurance company? = TAMS medicaid
Savannah Cheshire: What is the name of your insurance company? = DMBA
```

## Testing

Run sync for patients with known insurance in custom fields:

1. **Savannah Cheshire** - Has "DMBA" → Should map to DMBA payer
2. **Michael Sweitzer** - Has "Medicaid" → Should map to Utah Medicaid Fee-for-Service
3. **Sione Lavaka** - Has "UUHP" → Should map to HealthyU (UUHP)

## Limitations

1. **Only works for patients with custom fields** - Patients scheduled directly by providers won't have insurance in appointment custom fields
2. **Fuzzy matching** - Some insurance names may not map correctly and will log warnings
3. **No client profile access** - IntakeQ doesn't expose client profile insurance via API

## Next Steps

For patients like Hyrum Bay without custom fields:

**Option 1:** Manual payer assignment via UI
**Option 2:** Bulk update script based on external data source
**Option 3:** Create UI for providers/admin to update patient payers
**Option 4:** Investigate IntakeQ API for client profile access (may require different endpoint/auth)

## Admin Sync Fix (Bonus)

Also fixed admin/provider sync to skip organization affiliation check:

- Admin users can now sync ANY patient (no organization requirement)
- Provider users can sync patients assigned to them
- Partner users still require organization affiliation

**Files Modified:**
- `/src/lib/services/practiceQSyncService.ts` - Made `organizationId` parameter nullable
- Added conditional organization check (skip when null)
- Updates `patients.last_intakeq_sync` instead of affiliation sync time for admin/provider
