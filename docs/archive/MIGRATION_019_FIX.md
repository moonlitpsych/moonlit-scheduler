# Migration 019 Fix - Column Error Resolved ✅

## Problem
Migration 019 failed with error:
```
ERROR: 42703: column p.practiceq_id does not exist
LINE 251: p.practiceq_id,
```

## Root Cause
The migration referenced `practiceq_id` and `practiceq_status` columns that don't exist in the `patients` table. These were removed from the schema in earlier migrations.

## Fix Applied
Removed references to non-existent columns from the materialized view definition in migration 019.

**Changed:**
```sql
-- BEFORE (incorrect):
p.practiceq_id,
p.practiceq_status,

-- AFTER (correct):
-- (removed these lines)
```

---

## How to Run the Fixed Migration

### Option 1: Supabase Dashboard (Recommended)

1. **Open Supabase SQL Editor:**
   ```
   https://supabase.com/dashboard/project/alavxdxxttlfprkiwtrq/sql/new
   ```

2. **Copy the UPDATED migration file:**
   - File: `/database-migrations/019-patient-engagement-status.sql`
   - (The file has been updated with the fix)

3. **Paste into SQL editor and run**

4. **Verify success:**
   You should see output like:
   ```
   Migration 019: Patient Engagement Status System - COMPLETE
   patients_with_status: 150
   view_patient_count: 150
   patients_with_future_appt: 75
   active_patients: 150
   ```

---

### Option 2: If You Already Partially Ran the Migration

If some tables were created before the error, you may need to clean up first:

```sql
-- 1. Drop any partially created objects
DROP MATERIALIZED VIEW IF EXISTS v_patient_activity_summary CASCADE;
DROP FUNCTION IF EXISTS refresh_patient_activity_summary() CASCADE;
DROP FUNCTION IF EXISTS tg_log_engagement_status_change() CASCADE;
DROP TABLE IF EXISTS patient_engagement_status_history CASCADE;
DROP TABLE IF EXISTS patient_engagement_status CASCADE;

-- 2. Then run the updated migration
-- (paste the full content of 019-patient-engagement-status.sql)
```

---

## Verification After Migration

### Check Tables Created
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('patient_engagement_status', 'patient_engagement_status_history');
```
Expected: 2 rows

### Check View Created
```sql
SELECT matviewname, last_refresh
FROM pg_matviews
WHERE matviewname = 'v_patient_activity_summary';
```
Expected: 1 row with recent timestamp

### Sample Data
```sql
SELECT
  patient_id,
  first_name,
  last_name,
  engagement_status,
  last_seen_date,
  next_appointment_date,
  has_future_appointment
FROM v_patient_activity_summary
LIMIT 5;
```
Expected: Rows showing patient data with engagement status

---

## What Changed in the Fix

1. **Removed from view:**
   - `p.practiceq_id` column reference
   - `p.practiceq_status` column reference

2. **Still included:**
   - All patient demographics
   - Engagement status tracking
   - Last seen / next appointment data
   - Organization affiliations
   - All other functionality

**Note:** PracticeQ integration data can be added later if needed, either by:
- Adding columns to the patients table in a future migration
- Joining to external mapping tables in the view
- Querying separately when needed

---

## Ready to Proceed

The migration file has been fixed and is ready to run. Follow Option 1 above to apply it.

After successful migration, proceed to test the API endpoints and UI components per the main implementation guide.
