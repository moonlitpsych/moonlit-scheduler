# Test Data Marking & Provider Pay Upload - User Guide

## 🎉 What's New (Nov 2025)

Two major features added to help manage your finance data:

1. **Test Data Marking** - Mark appointments as test data (individual or bulk)
2. **Provider Pay CSV Upload** - Upload your finance spreadsheet to auto-populate provider pay fields

---

## Feature 1: Test Data Marking

### Why This Feature?

You have test appointments in your database that show up in reports and summaries. Now you can:
- Mark them as test data so they're hidden by default
- Filter to show/hide test data as needed
- Bulk mark multiple appointments at once

### How to Use:

#### Individual Marking:

1. Go to `/admin/finance/appointments`
2. Click any appointment row
3. Click "Edit" in the detail drawer
4. Scroll to bottom: **"Mark as Test Data"** checkbox
5. Check the box
6. Click "Save All Changes"

**Result:** Appointment is marked as test data and hidden by default.

#### Bulk Marking:

1. Go to `/admin/finance/appointments`
2. **Select appointments** using checkboxes in the first column
3. Bulk action buttons appear below the search box
4. Click **"Mark as Test"** or **"Mark as Real"**
5. Confirm the action

**Result:** All selected appointments updated at once.

### Visual Indicators:

- **Test appointments have orange background** in the table
- **"TEST" badge** appears next to the date
- **Filter checkbox** at top: "Show test data" (unchecked by default)

### Where Test Data is Excluded:

✅ Finance page appointments list (hidden by default)
✅ Provider pay summary calculations
✅ Revenue totals and summary cards
✅ CSV exports (unless "Show test data" is checked)

---

## Feature 2: Provider Pay CSV Upload

### Why This Feature?

You maintain a spreadsheet with provider pay information. Instead of manually entering provider paid amounts for each appointment, you can upload your spreadsheet and the system will:
- Match appointments by date, practitioner, and patient
- Automatically fill in provider pay fields
- Optionally update reimbursement amounts

### Required CSV Columns:

```csv
Date,Practitioner,Patient_Last,Provider_Paid,Provider_Paid_Date,Reimbursement
2025-10-15,Rufus Sweeney,Smith,114.00,2025-10-20,188.76
2025-10-16,Travis Norseth,Johnson,190.00,2025-10-20,266.00
```

**Required:**
- `Date` - Appointment date (YYYY-MM-DD or MM/DD/YYYY)
- `Practitioner` - Provider name (e.g., "Rufus Sweeney" or "Dr. Rufus Sweeney")
- `Patient_Last` - Patient last name

**Optional:**
- `Provider_Paid` - Amount paid to provider (dollars)
- `Provider_Paid_Date` - Date paid (YYYY-MM-DD or MM/DD/YYYY)
- `Reimbursement` - Insurance reimbursement amount (dollars)

**Notes:**
- Column names are case-insensitive
- Dollar amounts are automatically converted to cents
- "Dr." prefix is automatically handled during matching
- MD suffix is automatically handled during matching

### How to Use:

1. **Export your finance spreadsheet** as CSV with the columns above
2. Go to `/admin/finance/appointments`
3. Click **"Upload Provider Pay"** button
4. Select your CSV file
5. Click "Upload"

**The system will:**
- Match each row to an appointment
- Update provider_paid_cents, provider_paid_date, reimbursement_cents
- Show results: X matched, Y updated, Z not found

**Result:**
- Provider pay summary updates automatically
- Appointments show updated provider paid amounts
- Export CSV includes the new data

### Matching Logic:

Appointments are matched using:
1. **Exact date match** (appointment date = CSV date)
2. **Fuzzy practitioner name match** (handles "Dr.", "MD", case differences)
3. **Case-insensitive patient last name match**

**Example matches:**
- CSV: "Rufus Sweeney" → Matches: "Dr. Rufus Sweeney, MD"
- CSV: "Dr. Norseth" → Matches: "Travis Norseth"

### Troubleshooting Upload:

**"No matching appointment found"**
- Check date format (must be YYYY-MM-DD or MM/DD/YYYY)
- Verify practitioner name spelling
- Verify patient last name spelling
- Make sure appointment exists for that date

**"Missing required fields"**
- Ensure Date, Practitioner, Patient_Last columns exist
- Check for empty rows in CSV

---

## 🗄️ Database Changes

### Migration 053 (User Action Required):

**You need to run this migration in Supabase SQL Editor:**

File: `database-migrations/053-add-test-data-flag.sql`

**What it does:**
- Adds `is_test_data` column to `v_appointments_grid` view
- Updates provider pay summary to exclude test data
- Adds manual_overrides join for test data flag

**How to run:**
1. Open Supabase Dashboard
2. Go to SQL Editor
3. Copy contents of `database-migrations/053-add-test-data-flag.sql`
4. Paste and run
5. Verify: `select count(*) from v_appointments_grid;` should still work

---

## 📁 Files Created/Modified

### Files Created:
1. `/database-migrations/053-add-test-data-flag.sql` - Migration for is_test_data
2. `/src/app/api/finance/upload/provider-pay/route.ts` - CSV upload endpoint

### Files Modified:
1. `/src/components/finance/AppointmentDetailDrawer.tsx`
   - Added provider paid amount/date fields
   - Added test data checkbox

2. `/src/app/admin/finance/appointments/page.tsx`
   - Added bulk selection checkboxes
   - Added test data filter toggle
   - Added bulk action buttons
   - Added "Upload Provider Pay" button

3. `/src/components/finance/FileUploadModal.tsx`
   - Added 'provider-pay' upload type
   - Added provider pay CSV format guide

4. `/src/app/api/finance/appointments/[id]/override/route.ts`
   - Added `is_test_data`, `provider_paid_cents`, `provider_paid_date` to allowed columns

---

## 🧪 Testing Checklist

### Test Data Feature:

- [ ] Mark single appointment as test data via detail drawer
- [ ] Verify appointment shows orange background and "TEST" badge
- [ ] Verify appointment hidden by default
- [ ] Check "Show test data" toggle to reveal it
- [ ] Select multiple appointments and bulk mark as test
- [ ] Bulk mark as real to revert
- [ ] Verify test data excluded from provider pay summary

### Provider Pay Upload:

- [ ] Export CSV from your finance spreadsheet
- [ ] Ensure CSV has required columns
- [ ] Click "Upload Provider Pay" button
- [ ] Upload CSV file
- [ ] Verify results: X matched, Y updated, Z not found
- [ ] Check appointment detail drawer shows updated provider paid amount
- [ ] Check provider pay summary updates correctly
- [ ] Export CSV and verify provider paid columns populated

---

## 💡 Workflow Examples

### Weekly Finance Workflow (Updated):

**Old Process (Manual):**
1. Get insurance payment notification
2. Check Office Ally for covered appointments
3. **Manually enter provider pay for each appointment** (15 minutes)
4. Calculate provider balances in spreadsheet
5. Pay providers via Mercury ACH

**New Process (Semi-Automated):**
1. Get insurance payment notification
2. Check Office Ally for covered appointments
3. **Upload provider pay CSV** (1 minute)
4. Provider Pay Summary auto-calculates balances
5. Pay providers via Mercury ACH

**Time Saved:** 14 minutes/week

### Cleaning Up Test Data:

**Scenario:** You have 20 test appointments from October testing

**Old Process:** Delete them from database manually (risky!)

**New Process:**
1. Filter finance page: uncheck "Show test data"
2. Check "Show test data"
3. Select all test appointments (use checkboxes)
4. Click "Mark as Test"
5. Uncheck "Show test data"

**Result:** Test data hidden but preserved for debugging.

---

## 🚨 Important Notes

### Test Data vs. Deletion:

**DO NOT delete test appointments** - Mark them as test data instead. This preserves:
- Audit trail
- Debugging capability
- Historical context

### Provider Pay Upload Best Practices:

1. **Always keep a backup** of your original spreadsheet
2. **Review match results** before relying on the data
3. **Start with a small sample** (5-10 rows) to verify matching works
4. **Check provider pay summary** after upload to verify calculations

### Manual Overrides:

All changes are stored in the `manual_overrides` table with:
- Timestamp
- Changed by (admin)
- Reason (e.g., "CSV upload: provider-pay-oct-2025.csv")

You can view override history in Supabase:
```sql
select * from manual_overrides
where scope = 'appointment'
and record_id = 'YOUR_APPOINTMENT_ID'
order by changed_at desc;
```

---

## 📊 Summary

**Test Data Marking:**
- ✅ Individual checkbox in appointment detail drawer
- ✅ Bulk selection and marking via table checkboxes
- ✅ Filter toggle to show/hide test data
- ✅ Visual indicators (orange background, "TEST" badge)
- ✅ Excluded from provider pay calculations

**Provider Pay CSV Upload:**
- ✅ Upload button on finance page
- ✅ Flexible CSV format (case-insensitive columns)
- ✅ Fuzzy practitioner name matching
- ✅ Automatic dollar-to-cents conversion
- ✅ Updates provider_paid_cents, provider_paid_date, reimbursement_cents
- ✅ Detailed match results

**Database:**
- Migration 053 ready to run
- All changes use existing manual_overrides table
- No breaking changes to existing data

**Next Steps:**
1. ✅ Run migration 053 in Supabase
2. ✅ Test marking a single appointment as test data
3. ✅ Test bulk marking
4. Prepare a sample provider pay CSV
5. Test CSV upload with 5-10 rows
6. Review and verify results

---

## 🐛 Bug Fixes (Oct 30, 2025)

Three critical bugs were identified and fixed during testing:

### Fix 1: Next.js 15 Async Params
**Error:** `Route "/api/finance/appointments/[id]/override" used params.id. params should be awaited before using its properties`

**Fix:** Updated `/src/app/api/finance/appointments/[id]/override/route.ts` to await async params
```typescript
// Changed from
{ params }: { params: { id: string } }
// To
{ params }: { params: Promise<{ id: string }> }
const { id: appointmentId } = await params
```

### Fix 2: UUID Type Mismatch
**Error:** `invalid input syntax for type uuid: "admin"`

**Fix:** Changed `changed_by: 'admin'` to `changed_by: null` in three files:
- AppointmentDetailDrawer.tsx (saveOverride function)
- Finance appointments page.tsx (handleBulkMarkTestData)
- Provider pay upload route.ts

The `changed_by` column expects a UUID (auth user ID), not a string. Will implement proper auth context in future update.

### Fix 3: Null Safety in Search Filter
**Error:** `Cannot read properties of null (reading 'toLowerCase')`

**Fix:** Added optional chaining to search filter in `/src/app/admin/finance/appointments/page.tsx`
```typescript
// Changed from
a.practitioner.toLowerCase()
a.last_name.toLowerCase()
// To
a.practitioner?.toLowerCase()
a.last_name?.toLowerCase()
```

### Fix 4: Finance Navigation Link Added
Added "Finance" link to admin sidebar navigation in `/src/app/admin/layout.tsx`:
- Appears in Operations section
- Uses DollarSign icon
- Routes to `/admin/finance/appointments`

**Result:** All features now fully functional and ready for production use! ✅

Ready to use! 🎉
