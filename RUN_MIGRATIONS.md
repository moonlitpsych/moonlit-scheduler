# Run Database Migrations

## Overview
Two migrations need to be run to enable the `/book-now` flow:
1. **Migration 066**: Add `intakeq_location_id` column to `payers` table
2. **Migration 067**: Seed location IDs for all 16 payers (from your CSV)

---

## Prerequisites

You'll need your Supabase database connection string. This should be in one of these formats:

```bash
# Direct PostgreSQL connection (preferred)
postgresql://postgres:[password]@[host]:[port]/postgres

# Or from Supabase dashboard:
# Settings > Database > Connection string > Direct connection
```

---

## Option 1: Using psql (Recommended)

### Step 1: Set your database URL

```bash
# Replace with your actual Supabase connection string
export DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT.supabase.co:5432/postgres"
```

### Step 2: Run Migration 066 (Add Column)

```bash
cd /Users/miriam/code/moonlit-scheduler-session-nov-12-2025

psql "$DATABASE_URL" -f database-migrations/066-add-intakeq-location-to-payers.sql
```

**Expected output:**
```
✅ Column payers.intakeq_location_id added successfully
📋 Next step: Seed IntakeQ location IDs for active payers
   Run the companion migration: 067-seed-intakeq-locations.sql
```

### Step 3: Run Migration 067 (Seed Location IDs)

```bash
psql "$DATABASE_URL" -f database-migrations/067-seed-intakeq-locations.sql
```

**Expected output:**
```
🔧 Starting IntakeQ location ID seed...

✅ Aetna (UT) → locationId=14
✅ DMBA (UT) → locationId=9
✅ First Health Network (UT) → locationId=17
✅ Health Choice Utah (UT) (Medicaid) → locationId=10
✅ HMHI BHN (UT) → locationId=8
✅ Idaho (ID) Medicaid → locationId=19
✅ Molina (UT) (Medicaid) → locationId=16
✅ MotivHealth (UT) → locationId=18
✅ Optum Commercial Behavioral Health (UT) → locationId=11
✅ Out-of-pocket pay (UT) → locationId=1
✅ Regence BlueCross BlueShield (UT) → locationId=12
✅ SelectHealth (UT) → locationId=7
✅ University of Utah Health Plans UUHP (UT) → locationId=13
✅ Utah Medicaid Fee-for-Service (UT) → locationId=15
✅ HealthyU Medicaid (UT) → locationId=21
✅ SelectHealth Medicaid (UT) → locationId=20

✅ Migration 067 complete: IntakeQ location IDs seeded
   Payers updated: 16

[Results table showing all payers with location IDs]
```

### Step 4: Verify Success

```bash
psql "$DATABASE_URL" -c "SELECT name, state, intakeq_location_id FROM payers WHERE intakeq_location_id IS NOT NULL ORDER BY name LIMIT 20;"
```

Should show all 16 payers with their location IDs.

---

## Option 2: Using Supabase SQL Editor

If you prefer the Supabase dashboard:

### Step 1: Run Migration 066

1. Go to Supabase Dashboard → SQL Editor
2. Click "New query"
3. Copy/paste contents of `database-migrations/066-add-intakeq-location-to-payers.sql`
4. Click "Run"
5. Check for success message in output

### Step 2: Run Migration 067

1. New query in SQL Editor
2. Copy/paste contents of `database-migrations/067-seed-intakeq-locations.sql`
3. Click "Run"
4. Check that 16 payers were updated

### Step 3: Verify

Run this query:
```sql
SELECT name, state, intakeq_location_id
FROM payers
WHERE intakeq_location_id IS NOT NULL
ORDER BY name;
```

Should return 16 rows.

---

## Option 3: Using Node.js Script

If you want to run via JavaScript:

```bash
cd /Users/miriam/code/moonlit-scheduler-session-nov-12-2025

# Create a quick migration runner
node -e "
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

(async () => {
  // Run migration 066
  const sql066 = fs.readFileSync('database-migrations/066-add-intakeq-location-to-payers.sql', 'utf8');
  const { error: error066 } = await supabase.rpc('exec', { query: sql066 });
  if (error066) console.error('Migration 066 failed:', error066);
  else console.log('✅ Migration 066 complete');

  // Run migration 067
  const sql067 = fs.readFileSync('database-migrations/067-seed-intakeq-locations.sql', 'utf8');
  const { error: error067 } = await supabase.rpc('exec', { query: sql067 });
  if (error067) console.error('Migration 067 failed:', error067);
  else console.log('✅ Migration 067 complete');
})();
"
```

---

## Troubleshooting

### Error: "column already exists"
Migration 066 was already run. Skip to migration 067.

### Error: "payer not found"
Check if payer ID from CSV matches database. The seed script logs which payers were found/missing.

### Connection refused
- Verify database URL is correct
- Check if IP is whitelisted in Supabase (Settings > Database > Connection pooling)
- Try using the connection pooling URL instead

---

## After Migrations Complete

Once both migrations succeed:

1. **Test the flow:**
   ```bash
   cd /Users/miriam/code/moonlit-scheduler-session-nov-12-2025
   npm run dev
   # Visit http://localhost:3000
   # Click "Book now"
   # Select a payer (e.g., SelectHealth)
   # Verify IntakeQ widget loads
   ```

2. **Deploy to production:**
   - Merge this branch to main
   - Migrations can be run on production database
   - Update homepage goes live automatically

---

## What These Migrations Do

### Migration 066
- Adds `intakeq_location_id TEXT` column to `payers` table
- Creates index for faster lookups
- Non-destructive (doesn't modify existing data)

### Migration 067
- Updates 16 payers with their IntakeQ location IDs
- Uses exact payer IDs from your CSV
- Includes verification queries at the end
- Shows summary of updates

---

**Need help?** The migrations are idempotent and safe to re-run.
