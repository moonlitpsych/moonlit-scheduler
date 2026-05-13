# Google Meet Link Generation - Testing Guide

**Date:** October 27, 2025
**Status:** Ready for Testing
**Monthly Cost:** $6 (ONE Google Workspace account)

---

## 🎯 What We Built

A system that automatically generates Google Meet links for telehealth appointments using Google Meet REST API. The links are:
- ✅ **OPEN access** - Providers and patients can join with ANY Google account (or no account)
- ✅ **Stored in database** - Visible in admin, provider, and partner dashboards
- ✅ **Synced to calendars** - Automatically flow to Outlook/Google Calendar subscriptions
- ✅ **Parallel with IntakeQ** - Runs alongside IntakeQ's Google Meet integration (both create links)

---

## 📋 Prerequisites

### 1. Google Workspace Setup (ONE-TIME - ~30 minutes)

You need:
- ✅ Google Workspace account (hello@trymoonlit.com) - **you already have this**
- ✅ Google Cloud project - **you may already have this**
- ⏰ Enable Google Meet REST API
- ⏰ Create service account with domain-wide delegation
- ⏰ Download service account key
- ⏰ Add environment variables

**Follow:** `GOOGLE_MEET_SETUP_GUIDE.md` (already created in the repo)

### 2. Environment Variables

Add to `.env.local` (local testing) and Vercel (production):

```env
# Google Meet API Configuration
GOOGLE_MEET_SERVICE_ACCOUNT_KEY=<base64-encoded-service-account-key>
GOOGLE_WORKSPACE_DOMAIN=trymoonlit.com
GOOGLE_MEET_IMPERSONATE_EMAIL=hello@trymoonlit.com
```

---

## 🧪 Testing Plan

### Phase 1: Configuration Test (5 minutes)

**Test if Google Meet service is configured correctly**

1. **Start dev server:**
   ```bash
   npm run dev
   ```

2. **Test configuration endpoint:**
   ```bash
   curl http://localhost:3000/api/debug/test-google-meet
   ```

3. **Expected response:**
   ```json
   {
     "success": true,
     "message": "Google Meet Service is properly configured",
     "details": {
       "domain": "trymoonlit.com",
       "impersonateEmail": "hello@trymoonlit.com",
       "hasServiceAccount": true
     }
   }
   ```

4. **If you see errors:**
   - ❌ `GOOGLE_MEET_SERVICE_ACCOUNT_KEY environment variable not set`
     → Add env variable to `.env.local`
   - ❌ `Invalid service account key format`
     → Check base64 encoding (no line breaks!)
   - ❌ `Permission denied (403)`
     → Enable Google Meet REST API in Google Cloud Console
     → Check domain-wide delegation is configured

---

### Phase 2: Generate Test Meeting Link (5 minutes)

**Test if service can create Google Meet links**

1. **Generate a test link:**
   ```bash
   curl -X POST http://localhost:3000/api/debug/test-google-meet
   ```

2. **Expected response:**
   ```json
   {
     "success": true,
     "message": "Successfully generated Google Meet link",
     "data": {
       "meetingUrl": "https://meet.google.com/abc-defg-hij",
       "appointmentId": "test-1234567890",
       "appointmentTime": "2025-10-28T12:00:00.000Z",
       "note": "This is a test meeting space. You can join it to verify it works."
     }
   }
   ```

3. **Test the meeting link:**
   - Copy the `meetingUrl` from response
   - Open in browser
   - **Try joining with:**
     - ✅ Your personal Google account
     - ✅ Guest mode (no account)
     - ✅ Different browser/device

4. **Expected behavior:**
   - ✅ Meeting page loads successfully
   - ✅ Can join without being logged into hello@trymoonlit.com
   - ✅ Can join as guest (no Google account)
   - ✅ Meeting shows "Organized by hello@trymoonlit.com" or similar

5. **If you see errors:**
   - ❌ `403 Forbidden` → Google Meet REST API not enabled
   - ❌ `401 Unauthorized` → Service account credentials invalid
   - ❌ `404 Not Found` → Check API endpoint is correct

---

### Phase 3: Test New Booking Flow (15 minutes)

**Test that new appointments get Google Meet links automatically**

**IMPORTANT:** This test runs IN PARALLEL with IntakeQ's Google Meet integration. Both systems will create links:
- IntakeQ creates a link (visible in IntakeQ UI)
- Our system creates a link (visible in our dashboards)

1. **Book a test telehealth appointment:**
   - Go to: http://localhost:3000/book
   - Select "Book Now"
   - Choose insurance/payer
   - Select a provider
   - Choose a telehealth time slot
   - Fill in patient info
   - Complete booking

2. **Check the database:**
   ```bash
   npx tsx scripts/check-meeting-url-status.ts
   ```

   **Expected output:**
   ```
   📊 Analysis of X appointments:
   Overall Statistics:
     Total appointments: X
     With meeting_url: 1 (100%)  ← SHOULD SEE AT LEAST 1!
     ...

   ✅ Sample appointments WITH meeting URLs:
     - 10/28/2025, 2:00:00 PM: https://meet.google.com/xyz-abc-def
   ```

3. **Check in Partner Dashboard:**
   - Go to: http://localhost:3000/partner-dashboard/patients
   - Log in as partner user
   - Find the test patient
   - Look for "Next Appointment" section
   - **Expected:** See Google Meet link with copy button

4. **Check in Admin Dashboard:**
   - Go to: http://localhost:3000/dashboard/appointments
   - Find the test appointment
   - **Expected:** See meeting_url field populated

5. **Verify IntakeQ still creates its own link:**
   - Go to IntakeQ UI
   - Find the same appointment
   - **Expected:** IntakeQ ALSO shows a Google Meet link (different from ours)
   - **This is OK!** Both links work, they just create different meeting spaces

---

### Phase 4: Test PracticeQ Sync (15 minutes)

**Test that existing appointments get Google Meet links via sync**

1. **Run bulk sync:**
   - Go to: http://localhost:3000/partner-dashboard/patients
   - Click "Refresh All Appointments" button
   - Wait for sync to complete

2. **Check logs:**
   ```bash
   # Look for Google Meet generation logs
   tail -f .next/server-logs.txt | grep "Google Meet"
   ```

   **Expected logs:**
   ```
   🔗 [Google Meet] Generating link for telehealth appointment abc123...
   ✅ [Google Meet] Generated link for abc123: https://meet.google.com/xyz-abc-def
   ✅ [Google Meet] Saved to database
   ```

3. **Run status check script:**
   ```bash
   npx tsx scripts/check-meeting-url-status.ts
   ```

   **Expected:** Much higher percentage of appointments with meeting URLs:
   ```
   With meeting_url: 25 (75%)  ← Should increase after sync!
   Telehealth with meeting URL: 25 (100%)  ← All telehealth should have links
   ```

4. **Check a few appointments manually:**
   - Go to partner dashboard
   - View different patients
   - **Expected:** All upcoming telehealth appointments have Google Meet links

---

### Phase 5: Test Calendar Sync (20 minutes)

**Test that meeting links flow through to Outlook/Google Calendar subscriptions**

1. **Get calendar feed URL:**
   - Go to: http://localhost:3000/partner-dashboard/calendar
   - Copy the iCal feed URL

2. **Subscribe in Outlook:**
   - Open Outlook (desktop or web)
   - Go to Calendar
   - Click "Add Calendar" → "Subscribe from web"
   - Paste feed URL
   - Click "Import"

3. **Verify appointments appear:**
   - Check that patient appointments show in Outlook calendar
   - Click on an appointment
   - **Expected fields:**
     - ✅ Patient name in title
     - ✅ Provider name in title
     - ✅ Google Meet link in LOCATION field
     - ✅ Google Meet link in DESCRIPTION
     - ✅ Google Meet link in URL field (clickable)

4. **Test clicking the link:**
   - Click the Google Meet link in Outlook
   - **Expected:** Opens meet.google.com with the meeting
   - **Expected:** Can join with any account or as guest

---

### Phase 6: End-to-End User Journey (30 minutes)

**Simulate real case manager workflow**

**Scenario:** Case manager Beth needs to help patient join their telehealth appointment

1. **Patient books appointment** (via booking widget)
   - Patient: John Doe
   - Provider: Dr. Reynolds
   - Time: Tomorrow at 2pm MT
   - Type: Telehealth

2. **Case manager views in Partner Dashboard:**
   - Beth logs into partner dashboard
   - Goes to Patients page
   - Finds John Doe
   - Sees "Next Appointment: Tomorrow 2pm with Dr. Reynolds"
   - **Sees Google Meet link with copy button** ✅

3. **Case manager subscribes to calendar:**
   - Beth goes to Calendar page
   - Copies feed URL
   - Adds to her Outlook calendar
   - **Sees John's appointment in Outlook with Google Meet link** ✅

4. **Day of appointment:**
   - Beth opens Outlook
   - Sees appointment reminder
   - Clicks Google Meet link in Outlook
   - **Meeting opens successfully** ✅
   - Beth joins as herself (using her work Google account)
   - **Beth can join successfully** ✅

5. **Patient joins:**
   - Patient receives email with meeting link
   - Clicks link
   - **Can join as guest (no Google account)** ✅
   - Patient and provider both in meeting
   - **Everything works!** ✅

---

## 📊 Success Criteria

All checkboxes must be ✅ before deploying to production:

### Google Meet Service:
- [ ] Configuration test passes
- [ ] Can generate test meeting link
- [ ] Test link works (can join with any account or as guest)
- [ ] OPEN access confirmed (not restricted to @trymoonlit.com)

### New Bookings:
- [ ] New telehealth bookings get meeting_url populated
- [ ] Meeting link visible in partner dashboard
- [ ] Meeting link visible in admin dashboard
- [ ] Booking still succeeds if Google Meet generation fails (non-blocking)

### PracticeQ Sync:
- [ ] Bulk sync generates links for existing telehealth appointments
- [ ] Only telehealth appointments get links (not in-person)
- [ ] Doesn't overwrite existing meeting URLs
- [ ] Sync still succeeds if Google Meet generation fails (non-blocking)

### Calendar Integration:
- [ ] iCal feed includes meeting URLs in LOCATION field
- [ ] iCal feed includes meeting URLs in URL field
- [ ] iCal feed includes meeting URLs in DESCRIPTION
- [ ] Outlook subscription works
- [ ] Google Calendar subscription works
- [ ] Links are clickable from calendar apps

### Parallel Operation:
- [ ] IntakeQ still creates its own Google Meet links
- [ ] Our links don't interfere with IntakeQ's links
- [ ] Providers can use either link (both work)
- [ ] Case managers see our links in dashboards
- [ ] No breaking changes to existing workflow

### Access Control:
- [ ] Providers can join with their personal Gmail accounts
- [ ] Patients can join without Google accounts (guest mode)
- [ ] Case managers can join to assist patients
- [ ] Meeting is NOT restricted to @trymoonlit.com domain

---

## 🚫 What Could Go Wrong

### Issue 1: "Permission denied (403)" when generating links

**Symptoms:**
- Test endpoint returns 403 error
- New bookings don't get meeting URLs
- Logs show "Permission denied"

**Fixes:**
1. Verify Google Meet REST API is enabled in Google Cloud Console
2. Check domain-wide delegation is configured in Google Workspace Admin
3. Verify OAuth scopes are correct:
   - `https://www.googleapis.com/auth/meetings.space.created`
   - `https://www.googleapis.com/auth/meetings.space.readonly`

---

### Issue 2: "Only domain users can join" error

**Symptoms:**
- Providers/patients see "You can't join this meeting"
- Error: "Only people with @trymoonlit.com accounts can join"

**Fix:**
- This means `accessType` is set to `TRUSTED` instead of `OPEN`
- Should already be fixed in code (line 129 of googleMeetService.ts)
- Verify the code change was deployed

---

### Issue 3: No meeting URLs in database

**Symptoms:**
- Bookings succeed but `meeting_url` is NULL
- `check-meeting-url-status.ts` shows 0 appointments with URLs

**Debug steps:**
1. Check server logs for Google Meet errors
2. Test configuration endpoint: `GET /api/debug/test-google-meet`
3. Check if env variables are set correctly
4. Verify appointments are telehealth (`location_type = 'telehealth'`)

---

### Issue 4: Links don't appear in calendar sync

**Symptoms:**
- Outlook shows appointments but no meeting links
- Calendar events don't have clickable links

**Debug steps:**
1. Check that database has `meeting_url` populated
2. Verify calendar feed API includes meeting URL in SELECT query
3. Test calendar feed directly: `GET /api/partner-dashboard/calendar/feed?token=...`
4. Check if iCal format includes LOCATION and URL fields

---

### Issue 5: Duplicate meeting links

**Symptoms:**
- Patients receive two different Google Meet links
- Confusion about which link to use

**Expected behavior:**
- ✅ This is NORMAL! Both links work:
  - IntakeQ link: In IntakeQ UI and patient email
  - Our link: In our dashboards and calendar sync
- Patients can use either link
- Once you confirm our links work, you can stop using IntakeQ's Google Meet integration

---

## 🎬 Next Steps After Testing

### If All Tests Pass:

1. **Deploy to production:**
   ```bash
   git add .
   git commit -m "feat: Add Google Meet link generation with OPEN access

   - Generate meeting links for all telehealth appointments
   - OPEN access allows any user to join (providers use personal accounts)
   - Links stored in database, visible in all dashboards
   - Automatic generation during booking and PracticeQ sync
   - Links flow through calendar subscriptions to Outlook
   - Runs in parallel with IntakeQ's Google Meet integration

   Cost: $6/month (ONE Google Workspace account)
   "
   git push origin main
   ```

2. **Add env variables to Vercel:**
   - Go to Vercel dashboard
   - Project Settings → Environment Variables
   - Add:
     - `GOOGLE_MEET_SERVICE_ACCOUNT_KEY`
     - `GOOGLE_WORKSPACE_DOMAIN`
     - `GOOGLE_MEET_IMPERSONATE_EMAIL`
   - Redeploy

3. **Test in production:**
   - Run same test plan on production URL
   - Book a test telehealth appointment
   - Verify meeting link generated
   - Test joining the meeting

4. **Monitor for 1 week:**
   - Keep IntakeQ's Google Meet integration running
   - Compare both links (ours vs IntakeQ's)
   - Verify case managers can access our links
   - Confirm providers and patients can join

5. **Optional: Turn off IntakeQ's Google Meet integration**
   - After confirming our links work reliably
   - Keep using our links exclusively
   - Saves confusion (only one link per appointment)

### If Tests Fail:

1. **Document the failure:**
   - Which test failed
   - Error messages
   - Server logs

2. **DO NOT DEPLOY**

3. **Contact me with:**
   - Test that failed
   - Full error output
   - Relevant log lines
   - Environment details

---

## 💰 Cost Summary

**Monthly Recurring:**
- Google Workspace (hello@trymoonlit.com): $6/month
- **Total: $6/month**

**One-Time Setup:**
- Developer time: ~1 hour (Google Cloud setup)
- Your time (testing): ~2 hours
- **Total: ~3 hours**

**Savings vs Alternatives:**
- Individual provider Google Workspace accounts: **$100+/month** ❌
- Manual copy-paste for each appointment: **Hours/week** ❌
- Our solution: **$6/month** ✅

---

## 📞 Support

**Questions during testing?**
- Check `GOOGLE_MEET_SETUP_GUIDE.md` for setup steps
- Check `CALENDAR_SYNC_FINDINGS_AND_OPTIONS.md` for context
- Run `npx tsx scripts/check-meeting-url-status.ts` to diagnose issues

**Found a bug?**
- Document the issue with logs and screenshots
- Do NOT deploy if tests fail
- Keep IntakeQ's Google Meet integration as backup

---

**Ready to test!** Start with Phase 1 (Configuration Test) and work through each phase sequentially.
