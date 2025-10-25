# PracticeQ Appointment Sync - Implementation Proposal

**Date:** October 21, 2025
**Status:** Proposal - Awaiting Approval

---

## Problem Statement

Partner dashboard shows only appointments created through Moonlit's booking system. Appointments created directly in PracticeQ (IntakeQ) are not visible to partners, creating an incomplete view of patient care.

**Example:** If a provider books a follow-up in PracticeQ, the partner organization won't see it in their dashboard until we sync the data.

---

## Solution: Two-Way Appointment Sync

### Phase 1: PracticeQ → Moonlit (Pull Sync)
Fetch appointments from IntakeQ API and import into our database.

### Phase 2: Moonlit → PracticeQ (Already Built!)
We already push appointments TO IntakeQ when bookings are made.

---

## IntakeQ API Capabilities

**Endpoint:** `GET https://intakeq.com/api/v1/appointments`

**Query Parameters:**
- `client` - Search by patient email (e.g., `bwhipkey@firststephouse.org`)
- `startDate` - Filter from date (yyyy-MM-dd)
- `endDate` - Filter to date (yyyy-MM-dd)
- `status` - Filter by status (Confirmed, Canceled, WaitingConfirmation, Declined, Missed)
- `practitionerEmail` - Filter by provider
- `updatedSince` - Get only appointments changed after date (for incremental sync)
- `page` - Pagination (max 100 per page)

**Response Fields:**
```json
{
  "Id": 123456,
  "ClientId": "abc123",
  "ClientName": "Austin Schneider",
  "ClientEmail": "bwhipkey@firststephouse.org",
  "ClientPhone": "(555) 123-4567",
  "ClientDateOfBirth": "1990-01-15",
  "PractitionerId": "xyz789",
  "PractitionerName": "Dr. C. Rufus Sweeney",
  "PractitionerEmail": "dr.sweeney@trymoonlit.com",
  "ServiceId": "service-123",
  "LocationId": "4",
  "Status": "Confirmed",
  "StartDate": 1729785600000,
  "EndDate": 1729789200000,
  "StartDateIso": "2025-10-24T15:00:00.0000000Z",
  "EndDateIso": "2025-10-24T16:00:00.0000000Z",
  "Duration": 60
}
```

---

## Implementation Options

### Option 1: Manual "Sync Appointments" Button ⭐ **Recommended MVP**

**What:** Add sync button to partner dashboard
**When:** Partner clicks to manually refresh a patient's appointments
**Effort:** 4-6 hours
**User Experience:**

```
[Patient Roster]
┌────────────────────────────────────────────────────────────┐
│ Austin Schneider                                           │
│ Provider: Dr. Sweeney                                      │
│ Next Appt: Oct 24, 2025 at 3:00 PM                       │
│ Last Synced: 2 hours ago                                   │
│ [🔄 Sync from PracticeQ]                                   │
└────────────────────────────────────────────────────────────┘
```

**Files to Create:**
- `src/app/api/partner-dashboard/patients/[patientId]/sync/route.ts` - Sync endpoint
- `src/lib/services/practiceQSyncService.ts` - Core sync logic
- `src/components/partner-dashboard/SyncAppointmentsButton.tsx` - UI button

**Sync Logic:**
1. Get patient email from database
2. Call IntakeQ API: `GET /appointments?client={email}&startDate=2025-07-01&endDate=2026-01-31`
3. For each IntakeQ appointment:
   - Match provider by PracticeQ practitioner ID
   - Create if doesn't exist (check by `pq_appointment_id`)
   - Update if exists and changed (status, time, provider)
   - Skip if unchanged
4. Return summary: `{ new: 3, updated: 1, unchanged: 8, errors: 0 }`

---

### Option 2: Automated Daily Sync ⭐ **Recommended for Production**

**What:** Scheduled job syncs all org patients automatically
**When:** Runs daily at 3:00 AM Mountain Time
**Effort:** 8-10 hours (includes monitoring, logging, error handling)
**User Experience:** Transparent - appointments always up-to-date

**Implementation:**
- Vercel Cron Job: `src/app/api/cron/sync-practiceq-appointments/route.ts`
- Runs daily, syncs last 90 days + next 90 days
- Logs results to `sync_logs` table
- Email admin if sync fails
- Rate limiting: 100 appointments per page, throttle to stay under 500/day limit

**Cron Schedule:**
```javascript
// vercel.json
{
  "crons": [{
    "path": "/api/cron/sync-practiceq-appointments",
    "schedule": "0 9 * * *" // 3am MT = 9am UTC
  }]
}
```

---

### Option 3: Real-Time Webhooks (Future Enhancement)

**What:** IntakeQ sends instant updates when appointments change
**When:** Real-time, <1 second latency
**Effort:** 12-16 hours (webhook setup, verification, testing)
**Best For:** Production-grade always-in-sync experience

**IntakeQ Webhook Events:**
- `appointment.created`
- `appointment.updated`
- `appointment.deleted`
- `appointment.status_changed`

**Implementation:**
- `src/app/api/webhooks/practiceq/appointments/route.ts` - Webhook listener
- Verify webhook signature for security
- Process events immediately
- Idempotent handling (same event multiple times = same result)

---

## Recommended Approach

### Phase 1 (Now): Manual Sync Button
- Build `/api/partner-dashboard/patients/[patientId]/sync/route.ts`
- Add sync button to patient roster and detail pages
- Show sync status and last sync time
- **Estimated Time:** 4-6 hours
- **Value:** Immediate solution for keeping data up-to-date

### Phase 2 (Next Week): Automated Daily Sync
- Create cron job for nightly sync
- Add `sync_logs` table to track sync history
- Build admin dashboard to view sync status
- Email alerts for sync failures
- **Estimated Time:** 8-10 hours
- **Value:** Set-it-and-forget-it automation

### Phase 3 (Future): Real-Time Webhooks
- Set up webhook endpoint
- Configure IntakeQ webhook in their dashboard
- Add webhook signature verification
- Handle all event types
- **Estimated Time:** 12-16 hours
- **Value:** Real-time data sync, zero lag

---

## Data Mapping: IntakeQ → Moonlit

| IntakeQ Field | Moonlit Field | Notes |
|---------------|---------------|-------|
| `Id` | `pq_appointment_id` | Store for deduplication |
| `ClientEmail` | `patient_id` | Match patient by email |
| `PractitionerId` | `provider_id` | Match via `provider_intakeq_settings` table |
| `Status` | `status` | Map: Confirmed→confirmed, Canceled→cancelled, WaitingConfirmation→scheduled |
| `StartDateIso` | `start_time` | Convert from UTC to Mountain Time |
| `EndDateIso` | `end_time` | Convert from UTC to Mountain Time |
| `Duration` | (calculated) | `end_time - start_time` |
| `ServiceId` | `service_instance_id` | Match to our services table |
| `LocationId` | (metadata) | Store in appointment notes or metadata field |

---

## Deduplication Strategy

**Problem:** How do we know if an IntakeQ appointment already exists in our database?

**Solution:** Use `pq_appointment_id` (IntakeQ's `Id` field)

```sql
-- Check if appointment exists
SELECT id FROM appointments
WHERE pq_appointment_id = '123456';

-- If exists: UPDATE
-- If not exists: INSERT
```

**Edge Case:** Appointment created in Moonlit booking flow already has `pq_appointment_id` from our initial sync TO IntakeQ. This prevents duplicates automatically.

---

## Error Handling

### Rate Limiting
- IntakeQ: 500 requests/day
- Our strategy: Cache results, batch requests, sync only changed appointments
- Use `updatedSince` parameter to fetch only recent changes

### Missing Patients
- If IntakeQ appointment for email not in our database → Skip with warning
- Log: "Appointment 123456 for unknown patient xyz@email.com"

### Missing Providers
- If IntakeQ PractitionerId not in our `provider_intakeq_settings` → Assign to null
- Log: "Appointment 123456 has unknown practitioner abc123"
- Admin can manually map practitioner IDs later

### API Failures
- Retry 3 times with exponential backoff
- If still fails, log error and alert admin
- Don't block entire sync - continue with remaining patients

---

## Security Considerations

1. **Partner Access Control:**
   - Only sync appointments for patients affiliated with partner's organization
   - Verify partner has active ROI consent before showing appointment details

2. **API Key Protection:**
   - IntakeQ API key stored in environment variables
   - Never expose in frontend or logs
   - Use server-side routes only

3. **Audit Logging:**
   - Log every sync operation in `patient_activity_log`
   - Track: who triggered sync, when, what changed
   - Partner can see sync history in patient timeline

---

## UI/UX Design

### Patient Roster Page

**Before Sync:**
```
┌─────────────────────────────────────────────────────┐
│ 🔍 Search patients...                    [+ Add]    │
├─────────────────────────────────────────────────────┤
│ Austin Schneider                                    │
│ Dr. Sweeney • Next: Oct 24, 2025 at 3:00 PM       │
│ Last synced: Never                                  │
│ [🔄 Sync from PracticeQ]                            │
├─────────────────────────────────────────────────────┤
```

**During Sync:**
```
│ Austin Schneider                                    │
│ Dr. Sweeney • Next: Oct 24, 2025 at 3:00 PM       │
│ ⏳ Syncing appointments from PracticeQ...           │
```

**After Sync:**
```
│ Austin Schneider                                    │
│ Dr. Sweeney • Next: Nov 15, 2025 at 2:00 PM       │
│ ✅ Synced 2 minutes ago (3 new, 1 updated)         │
│ [🔄 Sync again]                                     │
```

### Bulk Sync Button (Top of Page)

```
┌─────────────────────────────────────────────────────┐
│ Patients (12)              [🔄 Sync All from PracticeQ] │
├─────────────────────────────────────────────────────┤
```

**Bulk Sync Modal:**
```
┌──────────────────────────────────────────────────────┐
│ Sync All Patients from PracticeQ                    │
├──────────────────────────────────────────────────────┤
│ This will fetch the latest appointments for all 12  │
│ patients in First Step House from PracticeQ.        │
│                                                      │
│ Date Range: [Last 90 days] to [Next 90 days]       │
│                                                      │
│ Estimated time: ~30 seconds                         │
│                                                      │
│ [Cancel]                          [Start Sync →]    │
└──────────────────────────────────────────────────────┘
```

**Progress Indicator:**
```
┌──────────────────────────────────────────────────────┐
│ Syncing Patients... (8/12 complete)                 │
├──────────────────────────────────────────────────────┤
│ ✅ Austin Schneider - 11 appointments synced         │
│ ✅ Bryan Belveal - 6 appointments synced             │
│ ✅ Rudy Moreno - 6 appointments synced               │
│ ⏳ Jeremy Montoya - syncing...                       │
│ ⏸️  Michael Sweitzer - queued                        │
│                                                      │
│ [████████████░░░░░░░░] 67%                          │
└──────────────────────────────────────────────────────┘
```

---

## Database Schema Changes

### Add `last_practiceq_sync_at` to `patient_organization_affiliations`

```sql
ALTER TABLE patient_organization_affiliations
ADD COLUMN last_practiceq_sync_at TIMESTAMPTZ;

COMMENT ON COLUMN patient_organization_affiliations.last_practiceq_sync_at IS
  'Last time appointments were synced from PracticeQ for this patient-org relationship';
```

### Add `sync_logs` table (for automated sync tracking)

```sql
CREATE TABLE sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type VARCHAR(50) NOT NULL, -- 'manual_patient', 'manual_org', 'automated_daily', 'webhook'
  organization_id UUID REFERENCES organizations(id),
  patient_id UUID REFERENCES patients(id),
  triggered_by_user_id UUID REFERENCES partner_users(id), -- NULL for automated/webhook
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL, -- 'in_progress', 'completed', 'failed'
  appointments_new INT DEFAULT 0,
  appointments_updated INT DEFAULT 0,
  appointments_unchanged INT DEFAULT 0,
  appointments_errors INT DEFAULT 0,
  error_message TEXT,
  metadata JSONB, -- Store details like date range, API response, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sync_logs_org ON sync_logs(organization_id);
CREATE INDEX idx_sync_logs_patient ON sync_logs(patient_id);
CREATE INDEX idx_sync_logs_started_at ON sync_logs(started_at DESC);
```

---

## API Endpoints

### 1. Sync Single Patient Appointments

**Endpoint:** `POST /api/partner-dashboard/patients/[patientId]/sync`

**Auth:** Partner user must have access to patient's organization

**Request:**
```json
{
  "dateRange": {
    "startDate": "2025-07-01",
    "endDate": "2026-01-31"
  }
}
```

**Response:**
```json
{
  "success": true,
  "patientId": "3adb45a7-c87a-404d-b52d-18281339723f",
  "patientName": "Austin Schneider",
  "syncedAt": "2025-10-21T17:45:00Z",
  "summary": {
    "new": 3,
    "updated": 1,
    "unchanged": 8,
    "errors": 0
  },
  "appointments": [
    {
      "id": "abc123",
      "pqAppointmentId": "123456",
      "startTime": "2025-11-15T14:00:00-07:00",
      "providerName": "Dr. C. Rufus Sweeney",
      "status": "confirmed",
      "syncAction": "created"
    }
  ]
}
```

### 2. Sync All Organization Patients

**Endpoint:** `POST /api/partner-dashboard/organizations/[orgId]/sync-all-patients`

**Auth:** Partner admin or case manager

**Request:**
```json
{
  "dateRange": {
    "startDate": "2025-07-01",
    "endDate": "2026-01-31"
  }
}
```

**Response:**
```json
{
  "success": true,
  "organizationId": "c621d896-de55-4ea7-84c2-a01502249e82",
  "organizationName": "First Step House",
  "syncedAt": "2025-10-21T17:45:00Z",
  "patientsProcessed": 12,
  "totalSummary": {
    "new": 15,
    "updated": 8,
    "unchanged": 21,
    "errors": 0
  },
  "patientResults": [
    {
      "patientId": "...",
      "patientName": "Austin Schneider",
      "summary": { "new": 3, "updated": 1, "unchanged": 8, "errors": 0 }
    }
  ]
}
```

### 3. Get Sync History

**Endpoint:** `GET /api/partner-dashboard/patients/[patientId]/sync-history`

**Response:**
```json
{
  "patient": {
    "id": "...",
    "name": "Austin Schneider"
  },
  "lastSync": "2025-10-21T17:45:00Z",
  "history": [
    {
      "syncedAt": "2025-10-21T17:45:00Z",
      "triggeredBy": "Beth Rodriguez",
      "summary": { "new": 3, "updated": 1, "unchanged": 8, "errors": 0 }
    }
  ]
}
```

---

## Testing Plan

### Unit Tests
- `practiceQSyncService.ts` - Test sync logic with mock IntakeQ responses
- Test deduplication (same appointment synced twice)
- Test provider matching
- Test status mapping

### Integration Tests
- Test full sync flow from IntakeQ API to database
- Test with real IntakeQ sandbox account
- Verify appointments appear in partner dashboard

### Manual Testing Checklist
- [ ] Sync patient with 0 existing appointments → Creates new appointments
- [ ] Sync patient with existing appointments → Updates changed, skips unchanged
- [ ] Sync patient with canceled appointment → Updates status
- [ ] Sync patient with new provider → Updates provider_id
- [ ] Sync patient not in organization → Returns error
- [ ] Sync with invalid date range → Returns validation error
- [ ] Bulk sync 12 patients → All complete successfully
- [ ] Check activity log shows sync events
- [ ] Check last_practiceq_sync_at updated correctly

---

## Rollout Plan

### Week 1: Build Manual Sync (Phase 1)
- Day 1-2: Build `practiceQSyncService.ts` core logic
- Day 3: Create API endpoint `/api/partner-dashboard/patients/[id]/sync`
- Day 4: Build UI components (SyncButton, progress indicators)
- Day 5: Testing and bug fixes

### Week 2: Add Automated Sync (Phase 2)
- Day 1-2: Build cron job endpoint
- Day 3: Add `sync_logs` table and admin dashboard
- Day 4: Configure Vercel cron schedule
- Day 5: Testing and monitoring setup

### Week 3: Polish & Monitor
- Monitor sync performance
- Optimize API calls (batch where possible)
- Add error alerting
- Gather partner feedback

---

## Success Metrics

1. **Data Accuracy:** 100% of PracticeQ appointments visible in partner dashboard
2. **Sync Performance:** <30 seconds to sync all 12 FSH patients
3. **Error Rate:** <1% of sync operations fail
4. **Partner Satisfaction:** Partners report dashboard data matches PracticeQ
5. **API Usage:** Stay under 500 IntakeQ API requests/day

---

## Open Questions

1. **Date Range:** Default to last 90 days + next 90 days? Configurable per org?
2. **Deleted Appointments:** Should we mark as deleted in our DB or actually delete?
3. **Historical Data:** Sync all historical appointments or just recent/future?
4. **Provider Mapping:** What if IntakeQ practitioner not in our system? Assign to null or skip?
5. **ROI Consent:** Should sync respect ROI consent or sync regardless (data available but hidden in UI)?

---

## Next Steps

**Awaiting Decision:**
- [ ] Approve Phase 1 (Manual Sync Button) for immediate implementation?
- [ ] Approve Phase 2 (Automated Daily Sync) for production deployment?
- [ ] Answer open questions above
- [ ] Prioritize: Build now or after V3.0 launch?

**If Approved:**
- [ ] Create implementation task list
- [ ] Estimate timeline (Phase 1: 4-6 hours, Phase 2: 8-10 hours)
- [ ] Schedule development sprint
- [ ] Set up IntakeQ sandbox for testing
