# Calendar Sync Findings & Options Report

**Date:** October 27, 2025
**Investigation:** Partner Dashboard Calendar Sync & Google Meet Links

---

## 📋 Executive Summary

**GOOD NEWS:** Partner dashboard has a complete calendar subscription system that can sync appointments to Outlook calendars automatically.

**THE PROBLEM:** IntakeQ's API doesn't expose Google Meet links, so even though the calendar sync infrastructure exists, there are no meeting URLs to sync.

**RECOMMENDATION:** Hybrid approach - Use existing calendar sync for appointment times/details, and add a "Copy Meeting Link" button in partner dashboard for case managers to manually access links.

---

## ✅ What's Already Built (Existing Infrastructure)

### 1. **Calendar Subscription System** - FULLY FUNCTIONAL

**Location:** `/partner-dashboard/calendar`

**Features:**
- Generates secure iCal feed URL for each case manager
- Works with Outlook, Google Calendar, Apple Calendar
- Auto-syncs appointments (updates hourly/daily depending on calendar app)
- Includes patient name, provider, appointment time, status

**How it works:**
1. Case manager visits Partner Dashboard → Calendar
2. Gets personalized feed URL with token (e.g., `https://booking.trymoonlit.com/api/partner-dashboard/calendar/feed?token=abc123...`)
3. Adds to Outlook: "Add Calendar → Subscribe from web"
4. Appointments automatically appear in their Outlook calendar
5. Updates automatically when new appointments are booked

**Status:** ✅ COMPLETE - Just needs meeting URLs added to events

### 2. **Calendar Export System** - FULLY FUNCTIONAL

**Components:**
- Download-based export (one-time import)
- Formats: .ics (universal), Outlook CSV, Google CSV
- Export next 90 days of appointments
- Includes all appointment details

**Status:** ✅ COMPLETE - Works today for appointment scheduling

### 3. **PracticeQ Sync System** - WORKING (But Can't Get Meeting URLs)

**Features:**
- Daily automated sync (3am MT)
- Manual "Refresh All Appointments" button
- Syncs appointment times, status, patient/provider info
- Populates `location_info` field with LocationName, PlaceOfService

**Status:** ✅ FUNCTIONAL - But IntakeQ API doesn't expose meeting URLs

---

## ❌ The Core Problem: IntakeQ API Limitation

### What We Discovered

**Database Analysis:**
- 49 appointments in system
- 33 are telehealth appointments
- **0 appointments have meeting_url populated** (0%)
- 100% have location_info (but many empty objects)

**IntakeQ API Response:** (Sample appointment 68f006c4f765ffd7cfd6cb57)
```json
{
  "Id": "68f006c4f765ffd7cfd6cb57",
  "ClientName": "Patrick Meacham",
  "PractitionerName": "Merrick Reynolds",
  "LocationName": "Unhoused Medicaid — telehealth (UT)",
  "PlaceOfService": "02",  // ← Telehealth code
  "TelehealthInfo": null,  // ← ALWAYS NULL
  "Status": "Confirmed",
  // ... 50+ other fields, but NO meeting URL
}
```

**Why TelehealthInfo is null:**
- IntakeQ generates Google Meet links through Google Calendar integration
- Links are stored in Google Calendar, not IntakeQ's database
- IntakeQ's UI queries Google Calendar in real-time to display links
- IntakeQ's API doesn't expose Google Calendar data
- This is by design - IntakeQ treats Calendar as external system

**We checked for alternative field names:**
- ❌ `VideoURL` - doesn't exist
- ❌ `MeetingURL` - doesn't exist
- ❌ `ConferenceLink` - doesn't exist
- ❌ `OnlineURL` - doesn't exist
- ✅ `TelehealthInfo` - exists but always null

---

## 💡 Solutions Analyzed

### Option 1: **Manual Copy-Paste from IntakeQ** ⭐ RECOMMENDED

**How it works:**
1. Case manager logs into Partner Dashboard
2. Views patient roster (already shows all appointments)
3. Clicks "Get Meeting Link" button next to appointment
4. Opens IntakeQ appointment page in new tab (deep link with appointment ID)
5. Copies Google Meet link from IntakeQ UI
6. Returns to Partner Dashboard
7. Optional: Paste into notes field for future reference

**Pros:**
- ✅ Zero cost
- ✅ Works with existing infrastructure
- ✅ No API limitations
- ✅ Case managers already have IntakeQ access for other tasks
- ✅ Can implement in 1 hour

**Cons:**
- ⚠️ Manual step required (not fully automated)
- ⚠️ Requires case manager to have IntakeQ login

**Implementation:**
```typescript
// Add to AppointmentLocationDisplay component
<a
  href={`https://intakeq.com/appointments/${pq_appointment_id}`}
  target="_blank"
  className="text-moonlit-brown hover:underline"
>
  View in IntakeQ (Copy Meet Link)
</a>
```

---

### Option 2: **Direct IntakeQ Access for Case Managers**

**How it works:**
1. Grant each case manager IntakeQ login
2. They view appointments directly in IntakeQ
3. Google Meet links are visible in IntakeQ UI
4. Still use Partner Dashboard for patient roster/ROI/etc.

**Pros:**
- ✅ Zero cost
- ✅ Case managers see meeting links in real-time
- ✅ Works with existing IntakeQ setup

**Cons:**
- ⚠️ Requires IntakeQ user licenses (may have cost)
- ⚠️ Splits workflow between two systems
- ⚠️ IntakeQ UI not optimized for case manager needs

---

### Option 3: **Manual Meeting Link Field in Database**

**How it works:**
1. Add "meeting_link" field to appointment edit form (admin only)
2. After booking, admin copies Google Meet link from IntakeQ
3. Pastes into appointment record in our system
4. Link flows through calendar sync automatically

**Pros:**
- ✅ Zero cost
- ✅ Once entered, link syncs to Outlook calendars
- ✅ Uses existing calendar infrastructure

**Cons:**
- ⚠️ Manual admin work for every appointment
- ⚠️ Increases admin workload (you wanted to decrease this)
- ⚠️ Error-prone (easy to forget/skip)

**User explicitly rejected this approach:** "I would like to decrease admin workload and avoid copying+pasting."

---

### Option 4: **Email Parsing (IntakeQ sends links via email)**

**How it works:**
1. IntakeQ sends confirmation emails with Google Meet links
2. Set up email forwarding to webhook
3. Parse email, extract meeting link
4. Auto-populate meeting_url field in database
5. Flows through calendar sync

**Pros:**
- ✅ Fully automated once set up
- ✅ Zero ongoing cost
- ✅ Uses existing infrastructure

**Cons:**
- ⚠️ Complex setup (email parsing, webhook infrastructure)
- ⚠️ Fragile (breaks if IntakeQ changes email format)
- ⚠️ Requires email forwarding rules
- ⚠️ 2-3 days development time

---

### Option 5: **Google Calendar API Integration**

**How it works:**
1. Connect to providers' Google Calendars via API
2. Query calendar events by appointment time
3. Extract Google Meet link from calendar event
4. Store in our database
5. Sync to case managers via iCal feed

**Pros:**
- ✅ Fully automated
- ✅ Direct access to Google Meet links
- ✅ Works with existing calendar infrastructure

**Cons:**
- ❌ Requires Google Workspace accounts for ALL providers ($6/user/month = $100+/month)
- ❌ User explicitly rejected: "I do not want to spend the extra $100+ a month"
- ⚠️ Complex OAuth setup for each provider
- ⚠️ Privacy concerns (accessing provider personal calendars)
- ⚠️ 2-3 days development time

**User explicitly rejected this approach.**

---

### Option 6: **Generate Our Own Google Meet Links** (ALREADY BUILT BUT REJECTED)

**Status:** ✅ Code written, ❌ User rejected due to cost

**What was built:**
- `googleMeetService.ts` - Google Meet REST API integration
- Automatic link generation during appointment creation
- Links stored in database and synced via calendar feed

**Why rejected:**
- ❌ Requires Google Workspace accounts ($100+/month)
- ❌ Creates DUPLICATE meeting spaces (IntakeQ also generates links)
- ❌ Confusing for patients (which link to use?)

**User feedback:** "I do not want to spend the extra $100+ a month to give everyone their own google workspace when we don't need them to have google workspaces for any other reason."

---

## 🎯 RECOMMENDED APPROACH: Hybrid Solution

### Phase 1: Quick Win (Implement Today - 1 hour)

**Update Partner Dashboard to show "Get Meeting Link" buttons:**

1. **Patient Roster Page** (`/partner-dashboard/patients`)
   - Add "View in IntakeQ" link next to each upcoming appointment
   - Opens IntakeQ appointment page in new tab
   - Deep link format: `https://intakeq.com/appointments/{pq_appointment_id}`
   - Case manager copies Google Meet link from IntakeQ UI

2. **AppointmentLocationDisplay Component**
   ```tsx
   {pq_appointment_id && (
     <a
       href={`https://intakeq.com/appointments/${pq_appointment_id}`}
       target="_blank"
       rel="noopener noreferrer"
       className="flex items-center space-x-1 text-moonlit-brown hover:underline text-sm"
     >
       <ExternalLink className="w-3 h-3" />
       <span>Get Meeting Link from IntakeQ</span>
     </a>
   )}
   ```

**Benefits:**
- ✅ Zero cost
- ✅ Works immediately
- ✅ No API limitations
- ✅ Minimal development time
- ✅ Leverages existing IntakeQ access

**Workflow for case managers:**
1. View patient roster in Partner Dashboard
2. See upcoming appointment with provider and time
3. Click "Get Meeting Link from IntakeQ"
4. Copy Google Meet link
5. Paste into email/message to patient or click to join

---

### Phase 2: Calendar Sync Enhancement (If Phase 1 not sufficient)

**If case managers need links IN their Outlook calendars:**

1. Add optional "Meeting Link" field to appointment records
2. Case managers can paste link after copying from IntakeQ (one-time)
3. Update calendar feed to include meeting URLs
4. Links automatically appear in subscribed Outlook calendars

**Implementation:**
```typescript
// Database: Add meeting_link_manual column
ALTER TABLE appointments ADD COLUMN meeting_link_manual TEXT;

// Calendar feed: Include manual links
const location = appt.meeting_link_manual ||
                 appt.meeting_url ||
                 'Telehealth'

// In iCal event:
`LOCATION:${location}`,
appt.meeting_link_manual && `URL:${appt.meeting_link_manual}`
```

**Benefits:**
- ✅ Once pasted, link syncs automatically
- ✅ Shows in Outlook calendar event
- ✅ One-time manual step per appointment
- ✅ Uses existing calendar infrastructure

---

## 📊 Comparison Matrix

| Solution | Cost | Development Time | Admin Work | Automation | User Accepted? |
|----------|------|------------------|------------|------------|----------------|
| **Hybrid (IntakeQ links + Calendar sync)** | $0 | 1-2 hours | Low (one-time paste if needed) | Partial | ✅ TBD |
| Manual IntakeQ access | $0 | 0 hours | None | None | ⚠️ Requires IntakeQ logins |
| Manual admin field | $0 | 2 hours | High (every appt) | None | ❌ User rejected |
| Email parsing | $0 | 2-3 days | None | Full | ⚠️ Complex, fragile |
| Google Calendar API | $100+/mo | 2-3 days | None | Full | ❌ User rejected (cost) |
| Generate own links | $100+/mo | DONE | None | Full | ❌ User rejected (cost) |

---

## ✅ Implementation Plan: Hybrid Approach

### Step 1: Add IntakeQ Deep Links (TODAY - 30 minutes)

**File:** `/src/components/partner-dashboard/AppointmentLocationDisplay.tsx`

**Changes:**
```typescript
export default function AppointmentLocationDisplay({
  meetingUrl,
  locationInfo,
  pqAppointmentId,  // NEW PROP
  startTime,
  compact = false
}: AppointmentLocationDisplayProps) {

  // ... existing code ...

  return (
    <div className={compact ? "text-sm" : "space-y-2"}>
      {/* Existing location display */}

      {/* NEW: IntakeQ deep link */}
      {pqAppointmentId && (
        <a
          href={`https://intakeq.com/appointments/${pqAppointmentId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center space-x-1 text-moonlit-brown hover:underline text-sm mt-2"
        >
          <ExternalLink className="w-3 h-3" />
          <span>Get Meeting Link</span>
        </a>
      )}
    </div>
  )
}
```

**Update usage in patient roster:**
```typescript
<AppointmentLocationDisplay
  meetingUrl={patient.next_appointment?.meeting_url}
  locationInfo={patient.next_appointment?.location_info}
  pqAppointmentId={patient.next_appointment?.pq_appointment_id}  // ADD THIS
  startTime={patient.next_appointment?.start_time}
  compact={true}
/>
```

---

### Step 2: Optional Manual Link Field (If needed)

**Database Migration:**
```sql
-- Add manual meeting link column
ALTER TABLE appointments
ADD COLUMN meeting_link_manual TEXT;

-- Update calendar feed query to use it
-- (Already documented in GOOGLE_MEET_LINKS_SOLUTION.md)
```

**UI: Add edit button in appointment details:**
- Allow case managers to paste meeting link
- Stores in meeting_link_manual field
- Automatically syncs to calendar feed

---

## 🎯 Decision Point for User

**Question 1:** Is the "Get Meeting Link from IntakeQ" button approach acceptable?
- ✅ YES → Implement Step 1 today (30 minutes)
- ❌ NO → Need to discuss alternative automated approaches

**Question 2:** Do case managers have IntakeQ logins?
- ✅ YES → Deep link will work perfectly
- ❌ NO → Need to create logins or use manual link field

**Question 3:** Do links need to appear IN Outlook calendar events?
- ✅ YES → Also implement Step 2 (manual link field)
- ❌ NO → Step 1 is sufficient

---

## 📝 Summary for User

**What exists:**
- ✅ Calendar subscription system (works with Outlook)
- ✅ PracticeQ sync (gets appointment data)
- ✅ Patient roster (shows all appointments)

**What doesn't work:**
- ❌ IntakeQ API doesn't expose Google Meet links
- ❌ Can't auto-populate meeting_url field
- ❌ Calendar events don't include meeting links

**Best solution (your constraints):**
- $0 cost
- Minimal admin work
- Uses existing infrastructure
- "Get Meeting Link" button → Opens IntakeQ → Copy link
- Optional: Paste into manual field for calendar sync

**Next step:**
- User confirms approach
- Implement Step 1 (30 minutes)
- Test with real case manager workflow
- Iterate based on feedback

---

**Questions?** Ready to implement as soon as you confirm the approach.
