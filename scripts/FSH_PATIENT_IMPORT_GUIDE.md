# FSH Patient Import Guide

This guide explains how to import patients from PracticeQ (IntakeQ) and affiliate them with First Step House (FSH).

## Quick Start

1. **Export patient data from PracticeQ**
2. **Format as CSV** using the template below
3. **Run the import script**

## CSV Format

Create a CSV file with the following columns:

```csv
first_name,last_name,email,phone,date_of_birth,roi_consent,consent_expires,pq_client_id
Sarah,Johnson,sarah.johnson@example.com,801-555-0101,1992-05-15,true,2026-01-15,abc123
Michael,Chen,michael.chen@example.com,801-555-0102,1988-11-20,true,2025-12-31,def456
Emily,Rodriguez,emily.rodriguez@example.com,801-555-0103,1995-03-08,false,,ghi789
```

### Column Descriptions

| Column | Required | Description | Example |
|--------|----------|-------------|---------|
| `first_name` | ✅ Yes | Patient first name | Sarah |
| `last_name` | ✅ Yes | Patient last name | Johnson |
| `email` | ✅ Yes | Patient email (used for matching) | sarah@example.com |
| `phone` | ❌ No | Patient phone number | 801-555-0101 |
| `date_of_birth` | ❌ No | Birth date (YYYY-MM-DD) | 1992-05-15 |
| `roi_consent` | ❌ No | ROI consent on file? | true / false / yes / no / 1 / 0 |
| `consent_expires` | ❌ No | ROI expiration date (YYYY-MM-DD) | 2026-01-15 |
| `pq_client_id` | ❌ No | PracticeQ client ID | abc123 |

## Step-by-Step Instructions

### 1. Export from PracticeQ

In PracticeQ/IntakeQ:
1. Go to **Clients** page
2. Use filters to select FSH patients
3. Click **Export** and download as CSV
4. Save the file (e.g., `fsh-patients-export.csv`)

### 2. Clean the CSV

Open the CSV in Excel or a text editor and:

- **Keep only needed columns** (remove extra PracticeQ columns)
- **Rename columns** to match the required format:
  - `First Name` → `first_name`
  - `Last Name` → `last_name`
  - `Email` → `email`
  - `Phone` → `phone`
  - `Birth Date` → `date_of_birth`
- **Add ROI columns** if you have this data:
  - `roi_consent` (true/false)
  - `consent_expires` (YYYY-MM-DD)
- **Add PracticeQ ID** if available:
  - `pq_client_id` (from PracticeQ)

**Important Date Formats:**
- Date of birth: `YYYY-MM-DD` (e.g., `1992-05-15`)
- ROI expiration: `YYYY-MM-DD` (e.g., `2026-01-15`)

### 3. Run the Import Script

```bash
npx tsx scripts/import-fsh-patients.ts path/to/your-patients.csv
```

**Example:**
```bash
npx tsx scripts/import-fsh-patients.ts ~/Downloads/fsh-patients-cleaned.csv
```

### 4. Review the Output

The script will show:
- Progress for each patient
- Whether patient was created or already existed
- Any errors encountered
- Final summary with counts

**Example output:**
```
📥 Importing FSH patients from CSV...

Found 10 patients to import

[1/10] Processing: Sarah Johnson
  ✓ Created new patient: Sarah Johnson (abc-123-xyz)
  ✓ Created FSH affiliation (ROI: Yes)

[2/10] Processing: Michael Chen
  ✓ Found existing patient: Michael Chen (def-456-uvw)
  ⚠️  Affiliation already exists (active)

============================================================
📊 Import Summary
============================================================
Total processed: 10
✅ Created: 6
✓ Updated: 4
❌ Errors: 0

✅ Import complete!
```

## Smart Matching

The script uses **strong matching** to prevent duplicates:

- **Matches on:** Email + First Name + Last Name + Date of Birth
- **If no match:** Creates new patient record
- **If match found:** Uses existing patient, creates affiliation

This is the same matching logic used in the booking flow.

## What Gets Created

For each patient, the script:

1. **Creates/finds patient record** in `patients` table
2. **Creates FSH affiliation** in `patient_organization_affiliations`:
   - Links patient to First Step House organization
   - Sets affiliation type: `partner_referral`
   - Records ROI consent status
   - Sets status: `active`
3. **Preserves PracticeQ ID** (if provided) for future syncing

## After Import

Once imported, patients will:

- ✅ Appear in FSH Partner Dashboard
- ✅ Show ROI consent status (Active/Expired/Missing)
- ✅ Be available for patient transfers
- ✅ Receive notifications from case managers
- ✅ Appear in activity timeline
- ✅ Be included in calendar feeds

## Testing the Import

You can test with the sample template:

```bash
npx tsx scripts/import-fsh-patients.ts scripts/fsh-patients-template.csv
```

This will import 4 test patients to FSH.

## Troubleshooting

### "Missing required fields"
- Check that `first_name`, `last_name`, and `email` are filled in for all rows
- Remove any empty rows at the end of the CSV

### "Failed to create patient"
- Check date formats (must be YYYY-MM-DD)
- Check for special characters in names or emails

### "Affiliation already exists"
- This is normal if you're re-running the import
- The script won't duplicate affiliations
- Patients are already set up correctly

### Date format issues
- Excel often changes date formats
- Save as "CSV UTF-8" to preserve formatting
- Manually format dates as: `1992-05-15` (not `5/15/1992`)

## Need Help?

Run the script without arguments to see usage:

```bash
npx tsx scripts/import-fsh-patients.ts
```

This shows the CSV format and example usage.

## Next Steps After Import

1. **Log in to Partner Dashboard**
   - URL: http://localhost:3000/partner-auth/login
   - Email: testpartner@example.com
   - Password: TestPassword123!

2. **View imported patients**
   - Go to "Patients" page
   - You should see all imported FSH patients

3. **Verify ROI status**
   - Check that ROI badges are correct (Active/Expired/Missing)

4. **Test functionality**
   - Try transferring a patient
   - Send a test notification
   - Generate calendar feed

---

**Note:** This script is safe to run multiple times. It won't create duplicate patients or affiliations.
