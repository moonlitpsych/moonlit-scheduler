# PracticeQ Automated Sync - Deployment Guide

**Created:** October 24, 2025
**Status:** Ready for Deployment
**Branch:** `feature/practiceq-sync-improvements`

---

## 🎯 What Was Built

### **Problem Statement**

Case managers at recovery centers (like First Step House) need **real-time appointment information** to help patients get to appointments. When appointments change in PracticeQ (time, provider, telehealth link), case managers were seeing stale data, leading to **missed appointments**.

### **Solution: Automated Daily Sync + Bulk Refresh**

1. ✅ **Automated Daily Sync** - Runs every night at 3am MT
2. ✅ **Bulk Refresh Button** - Case managers can manually refresh all patients on-demand
3. ✅ **Sync Logging** - Complete audit trail of all sync operations
4. ✅ **Error Handling** - Graceful failures with detailed logging

---

## 📦 What's Included

### **New Files Created:**

1. **Database Migration:**
   - `/database-migrations/022-create-sync-logs-table.sql`

2. **API Endpoints:**
   - `/src/app/api/cron/sync-practiceq-appointments/route.ts` - Automated cron job
   - `/src/app/api/partner-dashboard/patients/sync-all/route.ts` - Bulk sync endpoint

3. **UI Components:**
   - `/src/components/partner-dashboard/BulkSyncButton.tsx` - Bulk refresh button

4. **Configuration:**
   - `/vercel.json` - Cron schedule configuration
   - `/.env.example` - Environment variable documentation

### **Files Modified:**

1. `/src/app/partner-dashboard/patients/page.tsx` - Added bulk sync button

---

## 🚀 Deployment Steps

### **Step 1: Run Database Migration**

**Option A: Supabase Dashboard** (Recommended)

1. Open: https://supabase.com/dashboard/project/alavxdxxttlfprkiwtrq/sql/new
2. Copy content of `/database-migrations/022-create-sync-logs-table.sql`
3. Paste and execute
4. Verify success:
   ```sql
   SELECT COUNT(*) FROM sync_logs;  -- Should return 0
   SELECT * FROM v_recent_sync_activity LIMIT 5;  -- Should return empty
   ```

**Option B: Local psql**

```bash
psql $DATABASE_URL -f database-migrations/022-create-sync-logs-table.sql
```

**Expected Output:**
```
CREATE TABLE
CREATE INDEX (7 indexes created)
CREATE FUNCTION
CREATE TRIGGER
CREATE VIEW
GRANT
  status  | initial_row_count
----------+-------------------
 sync_logs table created | 0
```

---

### **Step 2: Set Environment Variable**

Add `CRON_SECRET` to your Vercel environment variables:

1. **Generate a secure secret:**
   ```bash
   openssl rand -base64 32
   # Example output: abc123def456ghi789...
   ```

2. **Add to Vercel:**
   - Go to: https://vercel.com/your-team/moonlit-scheduler/settings/environment-variables
   - Add new variable:
     - **Name:** `CRON_SECRET`
     - **Value:** `<paste the generated secret>`
     - **Environment:** Production, Preview, Development

3. **Add to local .env.local:**
   ```bash
   CRON_SECRET=<same secret as above>
   ```

---

### **Step 3: Deploy to Vercel**

```bash
# Commit and push
git add .
git commit -m "feat: Add automated PracticeQ sync with daily cron and bulk refresh

- Create sync_logs table for audit trail
- Build /api/cron/sync-practiceq-appointments for automated daily sync
- Add BulkSyncButton for manual refresh
- Configure vercel.json cron schedule (3am MT daily)
- Add CRON_SECRET for cron endpoint security

Solves: Case managers need real-time appointment data to help
patients get to appointments. Automated sync ensures fresh data
every morning, bulk refresh covers same-day changes.

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>"

git push origin feature/practiceq-sync-improvements
```

**Then on Vercel:**
- Merge to `main` or deploy preview environment
- Vercel will automatically detect `vercel.json` and schedule the cron job

---

### **Step 4: Verify Cron Job is Scheduled**

1. Go to Vercel Dashboard → Your Project → Settings → Cron Jobs
2. Verify you see:
   ```
   Path: /api/cron/sync-practiceq-appointments
   Schedule: 0 9 * * * (9:00 AM UTC / 3:00 AM MT)
   Status: Active
   ```

---

## 🧪 Testing

### **Test 1: Manual Cron Trigger (Local)**

```bash
# Generate test cron secret
export CRON_SECRET=$(openssl rand -base64 32)

# Start dev server
npm run dev

# In another terminal, trigger cron manually
curl -X POST http://localhost:3000/api/cron/sync-practiceq-appointments \
  -H "Authorization: Bearer $CRON_SECRET"
```

**Expected Response:**
```json
{
  "success": true,
  "syncLogId": "uuid-here",
  "stats": {
    "totalPatients": 12,
    "patientsProcessed": 12,
    "patientsFailed": 0,
    "totalAppointments": {
      "new": 3,
      "updated": 5,
      "unchanged": 42,
      "errors": 0
    },
    "duration": 15230
  }
}
```

**Verify in Supabase:**
```sql
SELECT * FROM sync_logs ORDER BY created_at DESC LIMIT 1;
SELECT * FROM v_recent_sync_activity LIMIT 5;
```

---

### **Test 2: Bulk Sync Button (UI)**

1. **Login as Partner User:**
   - Go to: http://localhost:3000/partner-auth/login
   - Login with First Step House credentials

2. **Navigate to Patients:**
   - Click "Patients" in header
   - You should see "Refresh All Appointments" button in top right

3. **Click Bulk Sync:**
   - Modal should open showing "Syncing Appointments..."
   - Wait 30-60 seconds
   - Should show success summary:
     ```
     Successfully Synced 12 Patients
     New: 3 | Updated: 5 | Unchanged: 42
     ```

4. **Verify Data Updated:**
   - Patient list should refresh automatically
   - Check "Last synced" timestamps (should show "Just now")

---

### **Test 3: Verify Cron Runs on Schedule (Production)**

**After deploying to production:**

1. **Wait until next day at 3:00 AM MT (9:00 AM UTC)**

2. **Check sync logs:**
   ```sql
   SELECT
     sync_type,
     status,
     started_at,
     patients_processed,
     appointments_new,
     appointments_updated,
     duration_ms
   FROM sync_logs
   WHERE sync_type = 'automated_daily'
   ORDER BY started_at DESC
   LIMIT 5;
   ```

3. **Check Vercel Logs:**
   - Go to: Vercel Dashboard → Your Project → Deployments → [Latest] → Functions
   - Search for: `sync-practiceq-appointments`
   - Verify cron executed successfully

---

## 🔍 Monitoring

### **Key Metrics to Track:**

1. **Sync Success Rate:**
   ```sql
   SELECT
     DATE(started_at) as sync_date,
     COUNT(*) as total_syncs,
     SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful,
     SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
   FROM sync_logs
   WHERE started_at >= NOW() - INTERVAL '7 days'
   GROUP BY DATE(started_at)
   ORDER BY sync_date DESC;
   ```

2. **Appointment Discovery Rate:**
   ```sql
   SELECT
     DATE(started_at) as sync_date,
     SUM(appointments_new) as new_appointments,
     SUM(appointments_updated) as updated_appointments,
     SUM(patients_processed) as patients_synced
   FROM sync_logs
   WHERE started_at >= NOW() - INTERVAL '7 days'
   GROUP BY DATE(started_at)
   ORDER BY sync_date DESC;
   ```

3. **Average Sync Duration:**
   ```sql
   SELECT
     sync_type,
     AVG(duration_ms) / 1000 as avg_duration_seconds,
     MAX(duration_ms) / 1000 as max_duration_seconds,
     MIN(duration_ms) / 1000 as min_duration_seconds
   FROM sync_logs
   WHERE started_at >= NOW() - INTERVAL '30 days'
   GROUP BY sync_type;
   ```

---

## 🚨 Troubleshooting

### **Problem: Cron Job Not Running**

**Symptoms:** No entries in `sync_logs` after 3am

**Diagnosis:**
1. Check Vercel Cron Jobs dashboard
2. Verify `vercel.json` is in repository root
3. Check deployment logs for cron trigger

**Fix:**
```bash
# Verify vercel.json is correct
cat vercel.json

# Re-deploy to trigger cron registration
git commit --allow-empty -m "Trigger re-deploy for cron registration"
git push origin main
```

---

### **Problem: "Unauthorized" Error on Cron Endpoint**

**Symptoms:** Cron returns 401 Unauthorized

**Diagnosis:**
- `CRON_SECRET` environment variable not set or incorrect

**Fix:**
1. Generate new secret: `openssl rand -base64 32`
2. Update in Vercel environment variables
3. Redeploy

---

### **Problem: Sync Taking Too Long (>2 minutes)**

**Symptoms:** Sync times out or is very slow

**Diagnosis:**
- Too many patients (>100)
- IntakeQ API rate limiting
- Network issues

**Fix:**
1. Check patient count:
   ```sql
   SELECT COUNT(DISTINCT patient_id)
   FROM patient_organization_affiliations
   WHERE status = 'active';
   ```

2. If >100 patients, consider:
   - Batch processing (sync 50 patients at a time)
   - Increase delay between requests (currently 100ms)
   - Use `updatedSince` parameter for incremental syncs

---

### **Problem: Many Patients Failing to Sync**

**Symptoms:** `patients_failed` > 5

**Diagnosis:**
- Missing email addresses
- IntakeQ API issues
- Provider mapping errors

**Fix:**
1. Check error details:
   ```sql
   SELECT
     metadata->'errors' as errors
   FROM sync_logs
   WHERE status = 'partial_success'
   ORDER BY started_at DESC
   LIMIT 1;
   ```

2. Common issues:
   - **"Patient has no email"** → Add email to patient record
   - **"Unknown practitioner"** → Map practitioner in `provider_intakeq_settings`
   - **"Failed to fetch from PracticeQ"** → Check IntakeQ API key

---

## 📊 Expected Results

### **First Sync (Day 1):**
- Patients processed: All active patients (~12 for FSH)
- New appointments: 15-30 (depending on how many were already in system)
- Updated appointments: 5-10 (recent changes)
- Unchanged: 20-40 (appointments already up-to-date)
- Duration: 15-30 seconds

### **Subsequent Syncs (Daily):**
- Patients processed: Same
- New appointments: 0-3 (newly scheduled)
- Updated appointments: 2-5 (time changes, cancellations)
- Unchanged: Most appointments
- Duration: 10-20 seconds

---

## ✅ Success Criteria

Your automated sync is working correctly when:

1. ✅ `sync_logs` table shows daily entries at 3:00 AM MT
2. ✅ All entries have `status = 'completed'` (or `partial_success` with <5 failures)
3. ✅ Case managers see "Last synced" timestamps updating automatically
4. ✅ Bulk refresh button shows success modal with appointment counts
5. ✅ New appointments appear in partner dashboard without manual sync

---

## 🔮 Future Enhancements

### **Phase 3: Real-Time Webhooks** (Next)

When you're ready for instant updates:

1. Complete `/api/webhooks/intakeq/route.ts` implementation
2. Configure webhook in IntakeQ dashboard
3. Add webhook signature verification
4. Test with real appointment changes

**Estimated Time:** 6-8 hours

---

### **Phase 4: Enhanced Appointment Display**

To show telehealth links and locations:

1. Extract `MeetingUrl` from IntakeQ API
2. Add `meeting_url` column to `appointments` table
3. Display link in partner dashboard patient roster
4. Add copy-to-clipboard button for easy sharing

**Estimated Time:** 3-4 hours

---

## 📝 Notes

- **IntakeQ API Limit:** 500 requests/day
- **Current Usage:** ~12 patients × 1 request = 12 requests per automated sync
- **Safety Margin:** Can handle 40+ syncs per day (automated + manual)

- **Cron Timing:** 3:00 AM MT chosen because:
  - Before case managers start work (~8am)
  - After most provider schedule changes (end of business day)
  - Low traffic time (faster API responses)

- **Date Range:** Default 90 days past + 90 days future
  - Captures historical appointments
  - Covers all upcoming appointments
  - Balances data freshness with API efficiency

---

## 🎉 You're Done!

Your automated PracticeQ sync is now live! Case managers will wake up to fresh appointment data every morning, and can manually refresh anytime they need the latest information.

**Questions or issues?** Check the troubleshooting section above or review the sync logs in Supabase.

---

**Last Updated:** October 24, 2025
**Author:** Claude Code
**Contact:** miriam@trymoonlit.com
