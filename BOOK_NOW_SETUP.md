# /book-now Setup Guide

This guide explains how to activate the new hybrid booking flow that combines Moonlit's payer selection with IntakeQ booking widgets.

## 🎯 Overview

**New Patient Journey:**
1. Patient clicks "Book Now" on homepage → `/book-now`
2. Patient selects insurance using Moonlit's fuzzy search payer selection
3. Patient is redirected to → `/book-widget?payer_id=xxx`
4. IntakeQ booking widget loads with correct locationId for that payer
5. Patient completes booking through IntakeQ

## ✅ What's Been Built

### 1. Database Schema
- **Migration 066**: Added `intakeq_location_id` column to `payers` table
- **Migration 067**: Seed script template for location mappings (needs payer name verification)

### 2. Components
- **`IntakeQWidget.tsx`**: Reusable widget component that dynamically injects IntakeQ script
- Accepts `locationId` prop
- Uses constant account ID: `673cd162794661bc66f3cad1`

### 3. Pages
- **`/book-now`**: Payer selection page (reuses `PayerSearchView` from book-dev)
- **`/book-widget`**: Displays IntakeQ widget for selected payer
- Error handling for missing payers or location IDs

### 4. Updated Links
- **Homepage** (`src/app/page.tsx`): Both CTA buttons now point to `/book-now`
- **Header & Footer**: Use `NEXT_PUBLIC_BOOK_NAV_PATH` env var (see Configuration below)

## 🚀 Deployment Steps

### Step 1: Verify Payer Names (Required)

Before running migrations, verify exact payer names in database match the seed script patterns.

**From IntakeQ widget screenshot, you have:**
- locationId=1: Out-of-pocket pay (UT)
- locationId=5: Housed Medicaid (ID)
- locationId=6: Unhoused Medicaid (ID)
- locationId=7: SelectHealth (UT)
- locationId=8: HMHI BHN (UT)

**Action needed:**
1. Query your database to get exact payer names
2. Update `database-migrations/067-seed-intakeq-locations.sql` with correct name patterns
3. The seed script uses wildcards (e.g., `%SelectHealth%`) for flexible matching

**Example query to check payers:**
```sql
SELECT id, name, state, status_code
FROM payers
WHERE status_code = 'approved'
ORDER BY state, name;
```

### Step 2: Run Database Migrations

```bash
# Run migration 066 (add column)
psql $DATABASE_URL -f database-migrations/066-add-intakeq-location-to-payers.sql

# Update seed script with correct payer names (see Step 1)
# Then run migration 067 (seed location IDs)
psql $DATABASE_URL -f database-migrations/067-seed-intakeq-locations.sql
```

**Verify migration success:**
```sql
-- Should show payers with location IDs
SELECT name, state, intakeq_location_id
FROM payers
WHERE intakeq_location_id IS NOT NULL;
```

### Step 3: Update Environment Variables (Optional)

To update Header/Footer navigation links:

**Add to `.env.local`:**
```bash
NEXT_PUBLIC_BOOK_NAV_PATH=/book-now
```

If not set, Header/Footer will default to `/see-a-psychiatrist-widget` (old behavior).

### Step 4: Update TypeScript Types (Already Done)

The `payers` table type in `src/types/database.ts` has been updated to include `intakeq_location_id`.

### Step 5: Deploy and Test

```bash
# Build and test locally
npm run build
npm run dev

# Test flow:
# 1. Visit http://localhost:3000
# 2. Click "Book now" → Should go to /book-now
# 3. Search for "SelectHealth" → Select it
# 4. Should redirect to /book-widget?payer_id=xxx
# 5. IntakeQ widget should load with locationId=7
```

**Test each payer:**
- [ ] Self-Pay/Out-of-Pocket → locationId=1
- [ ] SelectHealth → locationId=7
- [ ] HMHI BHN → locationId=8
- [ ] Housed Medicaid (ID) → locationId=5
- [ ] Unhoused Medicaid (ID) → locationId=6

## 🔧 Configuration Details

### IntakeQ Account Configuration

**Constant values (same for all payers):**
- Account ID: `673cd162794661bc66f3cad1`
- Script URL: `https://intakeq.com/js/widget.min.js?1`

**Variable values (per payer):**
- `locationId`: Stored in `payers.intakeq_location_id`

### Adding New Payers

When adding a new payer with IntakeQ booking:

1. Get the locationId from IntakeQ:
   - Login to IntakeQ > Bookings > Settings > Widget tab
   - Find the booking page link for the payer
   - Extract `intakeqLocationId=X` from the embed code

2. Update the payer in database:
   ```sql
   UPDATE payers
   SET intakeq_location_id = 'X'
   WHERE name ILIKE '%Payer Name%';
   ```

3. Test the booking flow for that payer

## 📝 Files Changed

### New Files
- `database-migrations/066-add-intakeq-location-to-payers.sql`
- `database-migrations/067-seed-intakeq-locations.sql`
- `src/components/booking/IntakeQWidget.tsx`
- `src/app/book-now/page.tsx`
- `src/app/book-widget/page.tsx`
- `BOOK_NOW_SETUP.md` (this file)

### Modified Files
- `src/types/database.ts` - Added `intakeq_location_id` to payers type
- `src/app/page.tsx` - Updated homepage CTA buttons to `/book-now`

### Unchanged (Legacy Routes)
- `/see-a-psychiatrist-widget` - Still exists (current production behavior)
- `/book-dev` - Still exists (full Moonlit booking flow for testing)
- Header/Footer - Use env var, can point to either old or new flow

## 🎨 Design Notes

All pages use Moonlit design system:
- Background: `#FEF8F1` (warm beige)
- Primary: `#BF9C73` (gold)
- Text: `#091747` (navy)
- Font: 'Newsreader' (serif)

## 🐛 Troubleshooting

**Widget not loading:**
- Check browser console for IntakeQ script errors
- Verify `intakeq_location_id` is set for the payer
- Check locationId matches IntakeQ configuration

**Payer not found:**
- Verify payer exists in database
- Check `status_code = 'approved'` for active payers
- Verify payer has `intakeq_location_id` set

**"Booking Not Available" message:**
- Payer exists but `intakeq_location_id` is NULL
- Run seed migration or manually update payer

## 📞 Support

Questions? Contact hello@trymoonlit.com

---

**Created:** 2025-11-12
**Author:** Claude Code Session
**Branch:** session/nov-12-2025
