# 🚨 Migration Required Before Testing

## Issue
The `primary_payer_id` column doesn't exist in the `patients` table yet.

## Fix
Run this migration in Supabase SQL Editor:

```sql
-- File: database-migrations/013-v2-add-primary-payer-id.sql

-- Add primary_payer_id column
ALTER TABLE patients
ADD COLUMN IF NOT EXISTS primary_payer_id UUID REFERENCES payers(id);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_patients_primary_payer_id
ON patients(primary_payer_id);

-- Add comment
COMMENT ON COLUMN patients.primary_payer_id IS 'Primary insurance payer selected at first booking (V2.0)';
```

## Steps
1. Open Supabase Dashboard → SQL Editor
2. Copy/paste the SQL above
3. Run the query
4. Verify: `SELECT column_name FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'primary_payer_id';`
5. Should return one row with `primary_payer_id`

## After Migration
Once the column exists, we can re-enable the payer persistence code in `book-v2/route.ts`.

For now, I've temporarily removed it so bookings work immediately.

## Status
- ✅ Column migration script created: `database-migrations/013-v2-add-primary-payer-id.sql`
- ✅ **Migration completed** - `primary_payer_id` column added to `patients` table
- ✅ **Payer persistence code re-enabled** in `book-v2/route.ts`
- ✅ **Dev server restarted** with fresh cache
- ✅ **READY FOR TESTING** - All 5 fixes are now active!
