# IntakeQ Integration Setup Guide

## Current Status

✅ **Working:**
- Appointments create successfully in Supabase database
- Double-booking prevention working
- Conflict detection functional
- Provider availability system operational

⚠️ **Not Working:**
- Appointments not syncing to IntakeQ
- Missing IntakeQ Service IDs and Location IDs in provider records

## Problem

The V2 appointment creation route (`/api/patient-booking/create-appointment-v2`) successfully creates appointments in the Supabase database, but fails to sync them to IntakeQ with the error:

```
❌ V2 - IntakeQ creation failed: IntakeQ API error: 400 Bad Request - {"Message":"Invalid ServiceId."}
```

## Root Cause

Each provider needs **two additional pieces of information** from IntakeQ:
1. **Service ID** - Which service type the appointment is for (e.g., "Initial Consultation", "Follow-up Visit")
2. **Location ID** - Which location/office the appointment is at

These IDs are unique to your IntakeQ account and cannot be auto-discovered through the API.

## Solution Steps

### Step 1: Add Database Columns

Run this SQL in your Supabase SQL Editor:

```sql
ALTER TABLE providers
ADD COLUMN IF NOT EXISTS intakeq_service_id TEXT,
ADD COLUMN IF NOT EXISTS intakeq_location_id TEXT;

COMMENT ON COLUMN providers.intakeq_service_id IS 'IntakeQ Service ID from Dashboard → Settings → Services';
COMMENT ON COLUMN providers.intakeq_location_id IS 'IntakeQ Location ID from Dashboard → Settings → Locations';
```

**OR** use the migration endpoint:
```bash
curl -X POST http://localhost:3000/api/admin/migrate-intakeq-fields
```

### Step 2: Get Service and Location IDs from IntakeQ

1. Log into your IntakeQ Dashboard: https://intakeq.com
2. Navigate to **Settings → Services**
   - You'll see a list of services (e.g., "Initial Consultation", "Follow-up Visit")
   - Each service has an ID (usually looks like `01JDQR0MT6MGADAMR7N8XHGZQ1`)
   - Copy the Service ID you want to use for new patient appointments
3. Navigate to **Settings → Locations**
   - You'll see a list of locations/offices
   - Each location has an ID
   - Copy the Location ID for your primary location

### Step 3: Update Provider Records

For each bookable provider, update their record with the IntakeQ IDs:

```bash
# Example for Tatiana Kaehler
curl -X POST http://localhost:3000/api/admin/update-provider-intakeq-ids \
  -H "Content-Type: application/json" \
  -d '{
    "provider_id": "19efc9c8-3950-45c4-be1d-f0e04615e0d1",
    "intakeq_service_id": "YOUR_SERVICE_ID_FROM_INTAKEQ",
    "intakeq_location_id": "YOUR_LOCATION_ID_FROM_INTAKEQ"
  }'
```

Repeat for each provider:
- Tatiana Kaehler: `19efc9c8-3950-45c4-be1d-f0e04615e0d1`
- Travis Norseth: `35ab086b-2894-446d-9ab5-3d41613017ad`
- Merrick Reynolds: `bc0fc904-7cc9-4d22-a094-6a0eb482128d`
- Rufus Sweeney: `08fbcd34-cd5f-425c-85bd-1aeeffbe9694`

### Step 4: Verify Setup

Check that all providers have the required IDs:

```bash
curl http://localhost:3000/api/admin/update-provider-intakeq-ids
```

You should see:
```json
{
  "providers": [
    {
      "name": "Tatiana Kaehler",
      "practitioner_id": "6838a1c65752f5b216563846",
      "service_id": "YOUR_SERVICE_ID",
      "location_id": "YOUR_LOCATION_ID",
      "ready_for_intakeq": true
    }
  ]
}
```

### Step 5: Test Appointment Creation

1. Go to http://localhost:3000/book-dev
2. Complete the booking flow
3. Check:
   - ✅ Appointment appears in Supabase `appointments` table
   - ✅ Appointment appears in IntakeQ dashboard
   - ✅ No errors in browser console or server logs

## Technical Details

### How It Works

The V2 route (`create-appointment-v2/route.ts`) follows this flow:

```typescript
// STEP 1: Check conflicts in Supabase
// STEP 2: Check conflicts in IntakeQ
// STEP 3: Insert appointment in Supabase
// STEP 4: Create in IntakeQ (if provider has service_id and location_id)

if (provider.intakeq_practitioner_id && createInEMR && !isTest) {
  const { data: providerWithSettings } = await supabase
    .from('providers')
    .select('intakeq_service_id, intakeq_location_id')
    .eq('id', providerId)
    .single()

  if (!providerWithSettings?.intakeq_service_id || !providerWithSettings?.intakeq_location_id) {
    console.log('⚠️ Provider missing intakeq_service_id or intakeq_location_id, skipping IntakeQ creation')
  } else {
    // Create appointment in IntakeQ
    intakeQAppointmentId = await intakeQService.createAppointment({
      practitionerId: provider.intakeq_practitioner_id,
      serviceId: providerWithSettings.intakeq_service_id,
      locationId: providerWithSettings.intakeq_location_id,
      // ... other appointment data
    })
  }
}
```

### Why Can't This Be Automated?

The IntakeQ API doesn't provide a `/services` or `/locations` endpoint to fetch these IDs programmatically. According to their API documentation, these must be obtained from the dashboard.

## Troubleshooting

### "Invalid ServiceId" Error
- Double-check the Service ID from IntakeQ dashboard
- Make sure you're copying the ID, not the name
- Verify the service is active in IntakeQ

### "Invalid LocationId" Error
- Verify the Location ID from IntakeQ dashboard
- Make sure the location is active

### Appointments Still Not Syncing
1. Check server logs for specific error messages
2. Verify `intakeq_practitioner_id` is set for the provider
3. Verify `createInEMR` is `true` in the booking request
4. Verify `isTest` is `false`

## Summary

Once you complete these steps, appointments will:
1. ✅ Create in Supabase database
2. ✅ Sync to IntakeQ EMR system
3. ✅ Prevent double-booking across both systems
4. ✅ Send email notifications
5. ✅ Display in both admin dashboard and IntakeQ

This completes the full end-to-end booking integration!
