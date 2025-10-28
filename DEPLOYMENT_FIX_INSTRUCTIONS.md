# Production Fix: Feature Flag Configuration

## Issue
The feature flag `INTAKE_HIDE_NON_INTAKE_PROVIDERS` is set in `.env.local` but NOT in the Vercel deployment environment, causing providers who don't accept new patients to appear in the booking flow.

## Required Action
Set the following environment variable in your Vercel deployment:

### Vercel Dashboard Steps:
1. Go to https://vercel.com/your-project/settings/environment-variables
2. Add new environment variable:
   - **Name:** `INTAKE_HIDE_NON_INTAKE_PROVIDERS`
   - **Value:** `true`
   - **Environment:** Check all (Production, Preview, Development)
3. Click "Save"
4. **Important:** Redeploy the application for changes to take effect
   - Go to Deployments tab
   - Click "..." on latest deployment
   - Click "Redeploy"

## What This Fixes
- ✅ Dr. Tatiana Kaehler (accepts_new_patients: false) will be HIDDEN
- ✅ Dr. Travis Norseth (accepts_new_patients: false) will be HIDDEN
- ✅ Only providers accepting new patients will show: Sweeney, Privratsky, Reynolds

## Code Fixes Included
1. **Removed hardcoded 4-provider limit** - CalendarView.tsx line 1100
   - Before: `.slice(0, 4)` capped provider list at 4
   - After: Shows all providers returned by API

2. This ensures Dr. Reynolds (5th provider) will display once feature flag is enabled

## Verification After Deployment
1. Visit booking flow and select HMHI BHN
2. Confirm only 3 providers show: Sweeney, Privratsky, Reynolds
3. Tatiana and Travis should NOT appear
4. Check browser devtools Network tab:
   - `/api/patient-booking/providers-for-payer` should return `total_providers: 3`

## Current Behavior (Before Fix)
- API returns 5 providers (including 2 who don't accept new patients)
- UI shows only 4 due to `.slice(0, 4)` limit
- Dr. Reynolds (5th) is cut off

## Expected Behavior (After Fix)
- API returns 3 providers (only those accepting new patients)
- UI shows all 3 without limit
- Dr. Reynolds IS included
