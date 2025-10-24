# Partner Dashboard V3.0 - FSH Testing Checklist

Now that you've imported FSH patients, use this checklist to test all V3.0 features with real data.

## 🔑 Test Login Credentials

- **URL:** http://localhost:3000/partner-auth/login
- **Email:** testpartner@example.com
- **Password:** TestPassword123!
- **Organization:** First Step House (FSH)
- **Role:** partner_case_manager (Beth Whipey)

---

## ✅ Testing Checklist

### 1. Authentication & Session Management

- [ ] **Password Login**
  - Log in with credentials above
  - Verify you're redirected to dashboard
  - Check that "Beth Whipey (Test)" appears in header

- [ ] **Magic Link Login** (Optional)
  - Log out
  - Click "Use magic link instead"
  - Enter testpartner@example.com
  - Check email for magic link (or check logs)
  - Verify login works

- [ ] **Persistent Session**
  - After logging in, close browser
  - Reopen and navigate to dashboard
  - Verify you're still logged in (session persists)

---

### 2. Patient Roster

- [ ] **View All FSH Patients**
  - Navigate to "Patients" page
  - Verify all imported FSH patients appear
  - Check patient count matches import

- [ ] **ROI Status Display**
  - Verify ROI status badges appear:
    - 🟢 **Active** (green) - Has consent, not expired
    - 🟡 **Expired** (yellow) - Had consent, now expired
    - 🔴 **Missing** (red) - No consent on file
  - Check expiration dates display correctly

- [ ] **Search Functionality**
  - Search by patient first name
  - Search by patient last name
  - Search by patient email
  - Search by phone number
  - Verify results filter correctly

- [ ] **Filter Tabs**
  - Click "All" - shows all FSH patients
  - Click "My Patients" - shows assigned patients (may be empty initially)
  - Click "ROI Missing" - shows only patients without active ROI

- [ ] **Stats Cards**
  - Verify "Total Patients" count is correct
  - Check "Assigned to Me" count (likely 0 initially)
  - Check "ROI Missing" count matches patients without consent

- [ ] **Upcoming Appointments**
  - If patients have appointments, verify they display
  - Check provider name appears
  - Check date/time formatting

---

### 3. Patient Transfer Functionality

**Note:** You'll need to create a second FSH user to test transfers fully.

- [ ] **Create Second FSH User**
  ```bash
  # Use the invitation API or create directly in database
  # We can help with this if needed
  ```

- [ ] **Assign Patient**
  - On patients page, click "Transfer" button
  - Select destination user from dropdown
  - Add optional notes
  - Click "Transfer Patient"
  - Verify success message

- [ ] **Verify Assignment**
  - Refresh patient list
  - Patient should now show "Assigned" badge
  - Click "My Patients" filter - should show assigned patient

- [ ] **Transfer Between Users**
  - Transfer same patient to different user
  - Check transfer notes are preserved
  - Verify activity log entry created

- [ ] **Team Member Counts**
  - In transfer modal, verify patient counts show for each user
  - Counts should update after transfers

---

### 4. Send Notifications

- [ ] **Appointment Reminder**
  - Click "Notify" button for patient with upcoming appointment
  - Select "Appointment Reminder"
  - Choose appointment from dropdown
  - Add optional message
  - Click "Send Notification"
  - Verify success message
  - Check email was sent (check logs or actual email)

- [ ] **Intake Form Reminder**
  - Click "Notify" for another patient
  - Select "Intake Form Reminder"
  - Choose appointment
  - Add message
  - Send notification
  - Verify success

- [ ] **General Message**
  - Click "Notify" for patient
  - Select "General Message"
  - Enter custom message
  - Send notification
  - Verify it works

- [ ] **ROI Consent Validation**
  - Try to send notification to patient with expired ROI
  - Verify it shows error about expired consent
  - Try patient with no ROI - verify error about missing consent

---

### 5. Activity Timeline

- [ ] **View Organization Activity**
  - Go to Dashboard home page
  - Check activity feed shows recent events
  - Verify you see:
    - Patient referrals (if any)
    - Notifications sent
    - Patient transfers
    - Appointment bookings

- [ ] **Activity Icons**
  - Verify correct icons display for each type:
    - 📅 Calendar - Appointments
    - ✅ CheckCircle - ROI granted
    - 👤 User - Assignments
    - 📧 MessageSquare - Notifications

- [ ] **Relative Timestamps**
  - Check timestamps display as:
    - "Just now" (< 1 min)
    - "5m ago" (< 1 hour)
    - "2h ago" (< 24 hours)
    - "3d ago" (< 7 days)
    - "Jan 15" (> 7 days)

- [ ] **Refresh Button**
  - Click refresh icon
  - Verify feed updates with latest activity

---

### 6. Calendar Subscription

- [ ] **Generate Calendar Token**
  - Navigate to "Calendar" page
  - Verify feed URL displays
  - Copy feed URL

- [ ] **Subscribe in Calendar App**
  - **Google Calendar:**
    - Click "+ Other calendars" → "From URL"
    - Paste feed URL
    - Verify calendar appears

  - **Outlook:**
    - Calendar → Add Calendar → Subscribe from web
    - Paste feed URL
    - Verify it works

  - **Apple Calendar:**
    - File → New Calendar Subscription
    - Paste feed URL
    - Verify it works

- [ ] **Verify Appointments Show**
  - Check that FSH patient appointments appear in calendar
  - Verify appointment details are correct:
    - Patient name
    - Provider name
    - Date/time
    - Appointment type

- [ ] **Regenerate Token**
  - Click "Regenerate" button
  - Confirm the action
  - Verify new feed URL is generated
  - Old URL should stop working

---

### 7. Navigation & UI

- [ ] **Header Navigation**
  - Click "Dashboard" - goes to home
  - Click "Patients" - goes to roster
  - Click "Calendar" - goes to calendar subscription page

- [ ] **User Menu**
  - Click user avatar/name in header
  - Verify dropdown appears with:
    - Profile & Settings (may not be implemented)
    - Notifications (may not be implemented)
    - Organization settings (if admin)
    - Logout

- [ ] **Logout**
  - Click Logout
  - Verify redirected to login page
  - Verify session is cleared
  - Try going back to dashboard - should redirect to login

- [ ] **Mobile Responsive**
  - Resize browser to mobile width
  - Verify layout adapts
  - Check tables scroll horizontally
  - Verify all buttons are accessible

---

### 8. Eddie Referral Tracking

**This requires booking an appointment with referral code.**

- [ ] **Book Appointment with Referral**
  - Use booking widget or API
  - Include: `referralCode: "testpartner@example.com"`
  - Complete booking
  - Verify appointment created

- [ ] **Check Referral Tracking**
  - Go to Patients page
  - New patient should appear in roster
  - Check activity feed for referral entry
  - Verify patient has FSH affiliation

- [ ] **Referral in Activity Log**
  - Check dashboard activity feed
  - Should show: "New patient referred and booked first appointment"
  - Shows Beth Whipey as referrer
  - Includes appointment details

---

### 9. Edge Cases & Error Handling

- [ ] **Empty States**
  - Filter to "My Patients" when none assigned
  - Verify friendly "No patients" message
  - Check activity feed with no activity

- [ ] **Missing Patient Email**
  - Try to notify patient without email
  - Verify warning message appears
  - Send button should be disabled

- [ ] **Expired ROI**
  - Try operations on patient with expired ROI
  - Verify appropriate warnings
  - Some actions should be blocked

- [ ] **Long Patient Lists**
  - If you have many patients, scroll through list
  - Verify performance is good
  - Check search remains fast

---

## 🐛 Bug Reporting

If you find any issues during testing:

1. **Note the specific steps** to reproduce
2. **Check browser console** for errors (F12 → Console)
3. **Check terminal logs** for server errors
4. **Take a screenshot** if it's a UI issue
5. **Report with details:**
   - What you expected
   - What actually happened
   - Any error messages

---

## ✅ Sign-Off

Once all tests pass:

- [ ] All authentication methods work
- [ ] Patient roster displays correctly
- [ ] Transfers work between users
- [ ] Notifications send successfully
- [ ] Activity timeline shows events
- [ ] Calendar subscription works
- [ ] Referral tracking captures properly
- [ ] No major bugs or errors

**Testing completed by:** _________________
**Date:** _________________
**Status:** ☐ Pass ☐ Pass with minor issues ☐ Fail

---

## 📝 Notes

Use this section for any additional observations or issues found:

```
[Your notes here]
```

---

## 🚀 Next Steps After Testing

Once testing is complete:

1. **Merge to main branch**
   ```bash
   git checkout main
   git merge partner-dashboard-v3-mvp
   ```

2. **Deploy to production**
   - Push to main (auto-deploys)
   - Verify in production environment

3. **Create FSH users in production**
   - Invite Beth Whipey and other case managers
   - Send magic link invitations

4. **Import production FSH patients**
   - Run import script with production data
   - Verify affiliations created

5. **Train FSH team**
   - Walk through dashboard features
   - Provide login credentials
   - Answer questions

**Partner Dashboard V3.0 is ready for production! 🎉**
