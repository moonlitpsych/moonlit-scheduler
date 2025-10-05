# IntakeQ Integration - Ready to Deploy

## Summary

All code changes are complete. The new architecture uses a clean **join table** (`provider_intakeq_settings`) instead of adding columns to the `providers` table.

## What Changed

### 1. Database Schema
- **New table**: `provider_intakeq_settings`
- Stores IntakeQ-specific config (Practitioner ID, Service ID, Location ID)
- One-to-one relationship with `providers` table

### 2. API Code Updated
- `create-appointment-v2/route.ts` now queries `provider_intakeq_settings` join table
- Logs IntakeQ settings being used for each appointment
- Gracefully skips IntakeQ sync if settings missing

### 3. TypeScript Types
- Added `provider_intakeq_settings` table definition to `database.ts`

## Deployment Steps

### Step 1: Run Migration in Supabase

Copy and paste this into **Supabase SQL Editor**:

```sql
-- Create IntakeQ settings table for providers
CREATE TABLE IF NOT EXISTS provider_intakeq_settings (
  provider_id UUID PRIMARY KEY REFERENCES providers(id) ON DELETE CASCADE,
  practitioner_id TEXT,
  service_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_provider_intakeq_settings_provider_id
ON provider_intakeq_settings(provider_id);

-- Add comments
COMMENT ON TABLE provider_intakeq_settings IS 'IntakeQ-specific configuration for providers';
COMMENT ON COLUMN provider_intakeq_settings.practitioner_id IS 'IntakeQ Practitioner ID from IntakeQ dashboard';
COMMENT ON COLUMN provider_intakeq_settings.service_id IS 'Default IntakeQ Service ID (e.g., "New Patient Visit")';
COMMENT ON COLUMN provider_intakeq_settings.location_id IS 'Default IntakeQ Location ID (e.g., "Insurance - UT")';

-- Populate with data for bookable providers
INSERT INTO provider_intakeq_settings (provider_id, practitioner_id, service_id, location_id)
SELECT
  id,
  intakeq_practitioner_id,
  '137bcec9-6d59-4cd8-910f-a1d9c0616319',  -- New Patient Visit (insurance — UT)
  '4'  -- Insurance — UT
FROM providers
WHERE is_bookable = true
  AND intakeq_practitioner_id IS NOT NULL
ON CONFLICT (provider_id) DO UPDATE
SET
  practitioner_id = EXCLUDED.practitioner_id,
  service_id = EXCLUDED.service_id,
  location_id = EXCLUDED.location_id,
  updated_at = NOW();
```

### Step 2: Verify Migration

Run this verification query in Supabase:

```sql
SELECT
  p.first_name,
  p.last_name,
  p.is_bookable,
  pis.practitioner_id,
  pis.service_id,
  pis.location_id
FROM providers p
LEFT JOIN provider_intakeq_settings pis ON p.id = pis.provider_id
WHERE p.is_bookable = true;
```

**Expected result:** 4 rows (Tatiana, Travis, Merrick, Rufus) with all IntakeQ fields populated.

### Step 3: Test Appointment Creation

1. Complete a test booking through the website
2. Check server logs for:
   ```
   📤 V2 - Creating in IntakeQ... {
     practitionerId: "6838a1c65752f5b216563846",
     serviceId: "137bcec9-6d59-4cd8-910f-a1d9c0616319",
     locationId: "4"
   }
   ✅ V2 - IntakeQ appointment created: [appointment_id]
   ```
3. Verify appointment appears in IntakeQ dashboard
4. Check Supabase `appointments` table has the record

## IntakeQ Configuration Used

| Field | Value | Description |
|-------|-------|-------------|
| **Service ID** | `137bcec9-6d59-4cd8-910f-a1d9c0616319` | "New Patient Visit (insurance — UT)" |
| **Location ID** | `4` | "Insurance — for patients seeking to pay for care through their own insurance (UT)" |

These are the same for all 4 providers, as discussed.

## Benefits of This Architecture

✅ **Clean separation** - IntakeQ config isolated from core provider data
✅ **Easy to modify** - Update IntakeQ settings without touching providers table
✅ **Future-proof** - Can easily add provider-specific Service/Location IDs later
✅ **Minimal JOIN cost** - One simple lookup per appointment creation

## Rollback Plan

If something goes wrong, simply drop the table:

```sql
DROP TABLE IF EXISTS provider_intakeq_settings CASCADE;
```

The appointment creation code will gracefully skip IntakeQ sync and only save to Supabase (current behavior).

## Files Modified

- `database-migrations/003-create-provider-intakeq-settings.sql` (new)
- `src/app/api/patient-booking/create-appointment-v2/route.ts` (lines 244-273)
- `src/types/database.ts` (lines 580-614, new table definition)
- `src/lib/services/intakeQService.ts` (added `getBookingSettings()` method)

---

**Status**: ✅ Ready to deploy
**Risk Level**: Low (graceful degradation if table missing)
**Estimated Deploy Time**: 2 minutes
