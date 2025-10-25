# How to Run Migration 019: Patient Engagement Status System

## Option 1: Supabase Dashboard (Recommended)

1. **Open Supabase SQL Editor:**
   ```
   https://supabase.com/dashboard/project/alavxdxxttlfprkiwtrq/sql/new
   ```

2. **Copy the migration file contents:**
   - File: `/database-migrations/019-patient-engagement-status.sql`

3. **Paste into SQL editor and run**

4. **Verify success - you should see:**
   ```
   Migration 019: Patient Engagement Status System - COMPLETE
   patients_with_status: <count>
   view_patient_count: <count>
   patients_with_future_appt: <count>
   active_patients: <count>
   ```

---

## Option 2: Supabase CLI

If you have Supabase CLI installed:

```bash
supabase db execute --file database-migrations/019-patient-engagement-status.sql
```

---

## Option 3: Direct psql Connection

If you have direct database access:

```bash
psql "<your-database-connection-string>" -f database-migrations/019-patient-engagement-status.sql
```

---

## What This Migration Does

1. **Creates Tables:**
   - `patient_engagement_status` - Global patient engagement state
   - `patient_engagement_status_history` - Audit trail of all changes

2. **Creates Views:**
   - `v_patient_activity_summary` - Materialized view combining engagement status with appointment data

3. **Creates Functions:**
   - `tg_log_engagement_status_change()` - Trigger function for auto-logging
   - `refresh_patient_activity_summary()` - Helper function for refreshing view

4. **Creates Triggers:**
   - Auto-logs status changes to history table
   - Auto-updates updated_at timestamps

5. **Migrates Data:**
   - Sets all existing patients to "active" status
   - Initializes materialized view

6. **Sets Permissions:**
   - Grants appropriate access to authenticated users

---

## After Running Migration

### Verify Tables Exist

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('patient_engagement_status', 'patient_engagement_status_history');
```

Expected: 2 rows

### Verify View Exists

```sql
SELECT matviewname, last_refresh
FROM pg_matviews
WHERE matviewname = 'v_patient_activity_summary';
```

Expected: 1 row

### Check Patient Count

```sql
SELECT COUNT(*) as total_patients
FROM patient_engagement_status;
```

Should match total number of patients in system.

### Sample Data from View

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
LIMIT 10;
```

---

## Rollback (If Needed)

If something goes wrong, you can rollback:

```sql
-- Drop view
DROP MATERIALIZED VIEW IF EXISTS v_patient_activity_summary CASCADE;

-- Drop function
DROP FUNCTION IF EXISTS refresh_patient_activity_summary();
DROP FUNCTION IF EXISTS tg_log_engagement_status_change();

-- Drop tables
DROP TABLE IF EXISTS patient_engagement_status_history CASCADE;
DROP TABLE IF EXISTS patient_engagement_status CASCADE;
```

Then re-run the migration after fixing any issues.

---

## Troubleshooting

### Error: "relation already exists"

If you see this error, the migration has already been run. You can either:
1. Skip it (tables already exist)
2. Drop tables and re-run (see Rollback section)

### Error: "column does not exist"

This likely means the `patients` or `appointments` table structure doesn't match expectations. Check:
- `patients` table has `id`, `first_name`, `last_name`, `status`, `practiceq_id` columns
- `appointments` table has `patient_id`, `start_time`, `status`, `provider_id` columns

### Error: "permission denied"

Make sure you're using the service role key (not anon key) when running migrations.
