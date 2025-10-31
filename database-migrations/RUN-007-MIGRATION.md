# Run Migration 007: Add Alternate Emails

## Quick Start

**Option 1: Via Supabase Dashboard (Recommended)**

1. Open Supabase SQL Editor: https://supabase.com/dashboard/project/alavxdxxttlfprkiwtrq/sql/new
2. Copy and paste the contents of `007-add-alternate-emails-to-patients.sql`
3. Click "Run"

**Option 2: Via Command Line**

```bash
# From project root
pbcopy < database-migrations/007-add-alternate-emails-to-patients.sql
# Then open: https://supabase.com/dashboard/project/alavxdxxttlfprkiwtrq/sql/new
# Paste and run
```

## After Migration

Once the column is added, run this SQL to add Matthew Reese's alternate email:

```sql
-- Find Matthew Reese's patient ID
SELECT id, first_name, last_name, email
FROM patients
WHERE first_name = 'Matthew' AND last_name = 'Reese';

-- Add alternate email (replace {patient_id} with actual ID from above)
UPDATE patients
SET alternate_emails = '["bwhipkey+16@firststephouse.org"]'::jsonb
WHERE id = '{patient_id}';

-- Verify it worked
SELECT first_name, last_name, email, alternate_emails
FROM patients
WHERE id = '{patient_id}';
```

## Then Test the Sync

Go to the partner dashboard and click the sync button for Matthew Reese. You should see in the console logs:

```
📧 [PracticeQ Sync] Checking 2 email(s): m47732414@gmail.com, bwhipkey+16@firststephouse.org
📧 [PracticeQ Sync] Querying IntakeQ for email: m47732414@gmail.com
📥 [PracticeQ Sync] Found X appointment(s) for m47732414@gmail.com
📧 [PracticeQ Sync] Querying IntakeQ for email: bwhipkey+16@firststephouse.org
📥 [PracticeQ Sync] Found X appointment(s) for bwhipkey+16@firststephouse.org
```

His appointments should now appear in the partner dashboard!
