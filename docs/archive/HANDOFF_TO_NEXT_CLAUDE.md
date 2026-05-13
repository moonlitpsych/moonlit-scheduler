# Session Handoff: IntakeQ Service/Location ID Integration

## Current Status

✅ **Working:** Appointments create in Supabase, double-booking prevention functional
❌ **Not Working:** Appointments don't sync to IntakeQ (missing service/location IDs)

## What Was Completed This Session

1. **Database Column Verification** - Confirmed `intakeq_service_id` and `intakeq_location_id` DO NOT exist in `providers` table
2. **Created Migration Files** - `/database-migrations/002-add-intakeq-service-location-ids.sql`
3. **Created Admin Tools:**
   - `/api/admin/migrate-intakeq-fields` - Runs migration
   - `/api/admin/update-provider-intakeq-ids` - Updates provider IDs (GET shows status, POST updates)
4. **Created Documentation:**
   - `INTAKEQ_SETUP_GUIDE.md` - Complete setup instructions
   - `COLUMN_VERIFICATION_REPORT.md` - Verification evidence

## Next Steps (REQUIRED - Start Here)

### Step 1: Add Database Columns (MUST DO FIRST)
The columns `intakeq_service_id` and `intakeq_location_id` have been **verified to NOT exist** in the `providers` table.

**ACTION REQUIRED:** Run the migration to add them. Choose ONE method:

**Method A - Use API endpoint (recommended):**
```bash
curl -X POST http://localhost:3000/api/admin/migrate-intakeq-fields
```

**Method B - Run SQL manually in Supabase dashboard:**
```sql
ALTER TABLE providers
ADD COLUMN IF NOT EXISTS intakeq_service_id TEXT,
ADD COLUMN IF NOT EXISTS intakeq_location_id TEXT;
```

### Step 2: Get IntakeQ IDs (User must do this manually)
User needs to:
1. Log into IntakeQ dashboard
2. Go to Settings → Services (copy Service ID)
3. Go to Settings → Locations (copy Location ID)

### Step 3: Update Each Provider
```bash
# Check current status first
curl http://localhost:3000/api/admin/update-provider-intakeq-ids

# Update each provider (user provides IDs from Step 2)
curl -X POST http://localhost:3000/api/admin/update-provider-intakeq-ids \
  -H "Content-Type: application/json" \
  -d '{"provider_id": "...", "intakeq_service_id": "...", "intakeq_location_id": "..."}'
```

### Step 4: Test Booking Flow
Complete a test booking and verify appointment appears in IntakeQ dashboard.

## Important Context

- IntakeQ API doesn't have `/services` endpoint - IDs must be obtained from dashboard manually
- V2 route already has logic to skip IntakeQ sync if service/location IDs are missing
- 4 bookable providers: Tatiana Kaehler, Travis Norseth, Merrick Reynolds, Rufus Sweeney
- All have `intakeq_practitioner_id` populated already ✅

## Key Files Modified

- `src/lib/services/intakeQService.ts` - Added `listServices()` method (but endpoint doesn't exist in IntakeQ API)
- `src/app/api/patient-booking/create-appointment-v2/route.ts` - Already checks for service/location IDs before IntakeQ sync

Read `INTAKEQ_SETUP_GUIDE.md` for complete details.
