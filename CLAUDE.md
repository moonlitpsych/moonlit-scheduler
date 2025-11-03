🎉 CLAUDE CODE: Moonlit Scheduler
🚨 Critical Development Policy

No mock data without explicit permission.

Never insert fake IntakeQ IDs, providers, or placeholder database rows.

Data integrity is critical — this is a healthcare application.

⚠️ **ALWAYS VERIFY BEFORE MODIFYING DATABASE SCHEMA**

Before adding columns or modifying tables:
1. Create debug API endpoints to verify column existence
2. Use multiple verification methods (direct SELECT, SELECT *, UPDATE attempt)
3. Check related tables for similar columns
4. Document findings in a verification report
5. Get explicit user confirmation before proceeding

**Example verification endpoints:**
- `/api/debug/check-[table]-columns` - Direct column checks
- `/api/debug/search-all-tables-for-columns` - Cross-table searches
- `/api/debug/final-column-verification` - Multi-method verification

This prevents duplicate columns, schema conflicts, and maintains data integrity.

## ✅ COMPLETED: V2.0 Production Booking System (Oct 9, 2025)

**STATUS:** ✅ READY TO SHIP - All critical functionality verified

### What Was Built:

**Problem:** Original booking system had critical production issues:
1. IntakeQ API failures blocked DB inserts (losing appointments)
2. No duplicate request protection (double-click caused conflicts)
3. No visual feedback on submission (users double-clicked)
4. Next.js 15.5.4 .env parsing bug concatenated API key with next line
5. No admin tooling to query bookings

**Solution:**
- **Non-blocking IntakeQ sync**: DB appointments save even when external API fails
- **Production-grade idempotency**: Stable key generation + server-side deduplication table
- **Triple-layer duplicate prevention**: Frontend debouncing + backend detection + visual feedback
- **Next.js .env workaround**: Extract correct 40-char API key from malformed env var
- **Admin query endpoint**: Search bookings by email, PracticeQ ID, or appointment ID

**Result:** ✅ Production-ready booking system with verified successful bookings in both DB and PracticeQ

### Key Components:

**1. Idempotency System** (`idempotency_requests` table)
- Client generates stable key from `{providerId, payerId, start, email}`
- Server checks table before processing any booking
- Returns cached response for duplicate requests
- 24-hour TTL for automatic cleanup

**2. Non-blocking Integration** (`book/route.ts:223-255`)
- IntakeQ sync failures don't block DB inserts
- Enrichment controlled by `PRACTICEQ_ENRICH_ENABLED` flag
- Appointments save with notes indicating sync status

**3. Double-Click Prevention**
- Frontend: `isSubmitting` flag prevents concurrent requests (`BookingFlow.tsx:193-198`)
- Backend: 30-second duplicate detection window (`book/route.ts:277-305`)
- UX: Loading spinner + disabled button (`AppointmentSummaryView.tsx:467-488`)
- Cleanup: `finally` block guarantees flag reset

**4. Next.js .env Workaround** (`intakeQService.ts:49-71`)
- Detects malformed key (length > 40 chars)
- Extracts correct 40-character API key
- Full key was concatenated: `{API_KEY}NEXT_PUBLIC_BOOK_NAV_PATH=/see-a-psychiatrist-widget`

**5. Admin Tooling** (`/api/admin/bookings/today`)
- Search by patient email: `?email=patient@example.com`
- Search by PracticeQ ID: `?pq_appointment_id=68e7f...`
- Search by appointment ID: `?appointment_id=ee21a38b...`
- Shows enrichment status breakdown (synced/skipped/pending)
- Mountain Time timezone for "today" calculation

### Files Modified:
- `src/app/api/patient-booking/book/route.ts` - Non-blocking sync, idempotency, duplicate detection
- `src/components/booking/BookingFlow.tsx` - Debouncing, idempotency key generation, AbortController
- `src/components/booking/views/AppointmentSummaryView.tsx` - Loading spinner and disabled state
- `src/lib/services/intakeQService.ts` - Next.js .env parsing workaround
- `src/lib/services/rateLimiter.ts` - Enhanced error logging
- `src/app/api/admin/bookings/today/route.ts` - Admin query endpoint (NEW)

### Database:
- `idempotency_requests` table (migration: `/tmp/idempotency_requests.sql`)
  - Columns: `key`, `appointment_id`, `request_payload`, `response_data`, `created_at`
  - Index: `idx_idempotency_created_at` for TTL cleanup

### Feature Flags (Production Configuration):
- ✅ `PRACTICEQ_ENRICH_ENABLED=true` - IntakeQ enrichment active
- ✅ `INTAKE_HIDE_NON_INTAKE_PROVIDERS=true` - Filter non-intake providers
- ✅ `INTEGRATIONS_DEBUG_HTTP=true` - Debug logging for API calls
- 🔵 `PRACTICEQ_DUPLICATE_ALERTS_ENABLED=false` - Future: Email alerts
- 🔵 `BOOKING_AUTO_REFRESH_ENABLED=false` - Future: Auto-refresh availability

### Verified Bookings (2025-10-09):
1. `ee21a38b-9f9f-4019-ada7-b5e0b2a16e66` - ✅ Synced (pq_appointment_id: 68e7fe09b820222eee47d49b)
2. `665f7b82-2bdb-4497-a6b6-8d0221980296` - ✅ Synced (pq_appointment_id: 68e7f98a867a401b3b557e7c)
3. `3c7cd155-869c-47a2-b9ae-e2f590bee262` - ⚠️ Skipped (pre-fix test, API key issue)

### Critical Patterns for Future Development:

**Idempotency Key Generation** (BookingFlow.tsx:214-221):
```typescript
const idempotencyData = {
  providerId: slot?.provider_id,
  payerId: state.selectedPayer?.id,
  start: startDateTime,
  email: patient?.email
}
const idempotencyKey = btoa(JSON.stringify(idempotencyData))
```

**Non-blocking External API Calls** (book/route.ts:223-255):
```typescript
try {
  intakeqClientId = await ensureClient(patientId, payerId)
  // ... other IntakeQ operations
} catch (error: any) {
  console.error('⚠️ IntakeQ mapping failed (will continue with DB insert):', error.message)
  intakeqMappingError = error
  // Don't return - continue to create DB appointment
}
```

**Guaranteed Cleanup Pattern** (BookingFlow.tsx:327-330):
```typescript
} finally {
  // Always reset submitting flag
  updateState({ isSubmitting: false })
}
```

---

## 🔵 IN PROGRESS: Payer Plan Tracking Infrastructure (Oct 31 - Nov 3, 2025)

**STATUS:** ⚠️ INFRASTRUCTURE ONLY - Plan tables exist for tracking, NOT for booking validation

### What Was Built:

**Purpose:** Track which health insurance plans exist for each payer (e.g., "SelectHealth Choice", "Regence PPO") for future use in:
- Claims processing and routing
- Plan name resolution from insurance cards
- Analytics and reporting
- **FUTURE:** Insurance selection UI filtering

### Key Architecture:

**Tables (4 total - For Tracking Only):**
1. `payer_networks` - Network definitions (e.g., "Regence BHPN", "SelectHealth Traditional")
2. `payer_plans` - Specific plans linked to payers (e.g., "SelectHealth Choice")
   - Column: `payer_id` → Links plan to payer ✅
   - This is **practice-level**: which plans does the practice accept from each payer
3. `payer_plan_aliases` - Maps insurance card strings → canonical plans
4. `payer_plan_routing_ids` - Clearinghouse routing for claims

**Functions (For Future Use):**
- `resolve_plan_name_to_id()` - Maps messy plan strings to canonical plan IDs

### 🚨 CRITICAL RULE: NO PLAN VALIDATION IN BOOKING FLOW

**Booking Validation Logic:**
```
IF provider is bookable with payer (via v_bookable_provider_payer)
  THEN provider accepts ALL plans from that payer
```

**Why?**
- Plans are tracked at **practice-level**, not provider-level
- If Moonlit accepts 8 SelectHealth plans, ALL providers bookable with SelectHealth can accept ALL 8 plans
- No provider-specific plan restrictions exist

**Where Plan Filtering Belongs (Future Work):**
- **Insurance Selection Stage**: Show only plans Moonlit accepts
- **NOT at provider selection**: Just check provider-payer bookability
- **NOT at booking confirmation**: Just check provider-payer bookability + date

### Migration Files:
- `022-add-payer-network-and-plan-tables.sql` - 4 core tracking tables ✅
- `026-seed-big3-payer-networks-and-plans.sql` - Regence/SelectHealth/Aetna seed data ✅
- ~~`028-create-provider-payer-accepted-plans.sql`~~ - **ROLLED BACK** (wrong architecture)
- ~~`029-create-plan-validation-functions.sql`~~ - **ROLLED BACK** (validation functions removed)
- ~~`030-update-booking-trigger-for-plan-validation.sql`~~ - **ROLLED BACK** (booking trigger restored)
- `034-rollback-plan-validation-from-booking.sql` - **Removed plan validation from booking** ✅

### What Was Removed (Nov 3, 2025):

**Problem:** Oct 31 implementation incorrectly added provider-level plan validation to booking trigger, causing legitimate bookings to fail.

**Removed:**
- `provider_payer_accepted_plans` table - Wrong architecture (implied provider-level restrictions)
- `does_provider_accept_plan()` function - Validated plans at booking (too strict)
- `is_provider_in_network_for_plan()` function - Network validation (premature)
- Plan validation logic from `enforce_bookable_provider_payer()` trigger

**Restored:**
- Booking trigger to Oct 7 version (simple provider-payer bookability check)
- Uses `v_bookable_provider_payer` view ONLY
- No plan-level validation

### Current Booking Trigger Behavior (Correct):

```sql
-- enforce_bookable_provider_payer() function
-- 1. Check if provider_id exists in v_bookable_provider_payer for this payer_id
-- 2. Check if date is within contract effective range
-- 3. Accept booking if checks pass
-- NO plan validation
```

**Accepts bookings when:**
- Provider has direct contract with payer ✅
- Provider is supervised under payer contract ✅
- Date is within contract effective range ✅
- **Regardless of specific plan** ✅

### Real Contract Data (For Future Reference):

**SelectHealth - Practice Contract:**
- Plans Accepted by Moonlit Practice (6 total):
  1. **Select Choice** (PPO) - DEFAULT
  2. **Select Care** (PPO)
  3. **Select Med** (PPO)
  4. **Select Value** (HMO)
  5. **SelectHealth Share** (PPO)
  6. **Select Access** (Medicaid/CHIP)

These plans are stored in `payer_plans` table for future use, but DO NOT affect booking validation.

### Critical Pattern for Future Developers:
- Extract plan names ONLY from actual signed contract appendices
- Document source pages in `notes` field for traceability
- Use `is_default` flag for standard/most common plan
- Medicaid/CHIP plans use `plan_type = 'OTHER'` (not a separate type)

---

## ✅ COMPLETED: Provider Impersonation System (Oct 15, 2025)

**STATUS:** ✅ READY FOR TESTING - Admin can view provider dashboards for support

### What Was Built:

**Problem:** When providers have questions about their dashboard, admins need to see exactly what they're seeing to provide effective support. Previously, admins only had their own admin view with no way to experience the provider interface.

**Solution:**
- **Provider Selection**: Admins can choose which provider to view as
- **Full Impersonation**: Admin sees exactly what the selected provider sees
- **Quick Switching**: Dropdown allows switching between providers without logout
- **Audit Trail**: All admin actions logged with timestamps and changes
- **Self-Viewing**: Admins who are also providers can view their own provider dashboard

**Result:** ✅ Complete provider support experience with full audit logging

### Key Components:

**1. Provider Impersonation Manager** (`/src/lib/provider-impersonation.ts`)
- Stores impersonation context in sessionStorage
- Manages provider selection and switching
- Logs all admin actions for compliance
- Provides helper methods for audit trail

**2. Provider Selector Page** (`/src/app/dashboard/select-provider/page.tsx`)
- Full-screen provider list with search
- Status chips showing "Active", "Inactive", "Not yet a user"
- "(You)" indicator for admin's own provider record
- Clean navigation back to admin dashboard

**3. Provider Selector Dropdown** (`/src/components/admin/ProviderSelector.tsx`)
- Appears in dashboard header when admin is viewing
- Shows "Viewing as: Dr. [Name]"
- Quick-switch dropdown with search
- Link to full provider selector page

**4. Audit Logging** (`admin_action_logs` table)
- Tracks impersonation starts and switches
- Records all data modifications
- JSON changes field for before/after comparison
- Indexed for efficient admin and provider queries

### User Flow:

1. Admin logs in → Sees Admin Dashboard
2. Clicks "Provider Dashboard" in ContextSwitcher
3. Routed to `/dashboard/select-provider`
4. Selects provider (e.g., "Dr. Travis Norseth")
5. Dashboard loads with EXACT provider experience
6. Header shows "Viewing as: Dr. Travis Norseth" with dropdown
7. Can switch to another provider via dropdown
8. Can return to Admin Dashboard via ContextSwitcher

### Files Created:
- `/src/lib/provider-impersonation.ts` - Core impersonation logic
- `/src/app/dashboard/select-provider/page.tsx` - Provider selection page
- `/src/components/admin/ProviderSelector.tsx` - Header dropdown component
- `/src/hooks/useAdminAudit.ts` - Hook for audit logging in pages
- `/database-migrations/006-create-admin-action-logs.sql` - Audit table migration

### Files Modified:
- `/src/app/dashboard/layout.tsx` - Loads impersonated provider, adds selector to header
- `/src/app/dashboard/page.tsx` - Uses impersonated provider data
- `/src/components/layout/PractitionerHeader.tsx` - Accepts children for selector
- `/src/components/auth/ContextSwitcher.tsx` - Routes to selector, clears impersonation

### Database:
- `admin_action_logs` table (migration: `006-create-admin-action-logs.sql`)
  - Columns: `id`, `admin_email`, `provider_id`, `action_type`, `description`, `table_name`, `record_id`, `changes`, `created_at`
  - Indexes: `admin_email`, `provider_id`, `action_type`, `created_at`

### Critical Patterns:

**Impersonation Check** (use in all provider pages):
```typescript
import { providerImpersonationManager } from '@/lib/provider-impersonation'

const impersonation = providerImpersonationManager.getImpersonatedProvider()
const provider = impersonation ? impersonation.provider : loadFromDatabase()
```

**Audit Logging** (use when admin modifies data):
```typescript
import { useAdminAudit } from '@/hooks/useAdminAudit'

const { isAdminViewing, withAuditLog } = useAdminAudit()

await withAuditLog(
  'availability_update',
  `Updated availability for ${provider.first_name}`,
  async () => {
    // Make database changes
    return await supabase.from('provider_availability').update(...)
  },
  { tableName: 'provider_availability', recordId: scheduleId }
)
```

**Status Chips in Provider List**:
- 🟢 **Active**: `is_active = true` AND `auth_user_id` exists (can log in)
- 🟡 **Not yet a user**: `is_active = true` but no `auth_user_id` (hasn't signed up)
- ⚫ **Inactive**: `is_active = false` (archived or removed)

### Next Steps (Future):
1. Add impersonation banner showing "Admin Mode: Viewing as Dr. [Name]"
2. Update availability and profile pages to use `useAdminAudit` hook
3. Create admin page to view audit logs
4. Add email notifications when admin makes changes on behalf of provider

---

## ✅ COMPLETED: Bookability Trigger Migration (Oct 7, 2025)

**STATUS:** ✅ Fixed "Not bookable for this payer" errors

### What Was Fixed:

**Problem:** Booking trigger used incomplete `bookable_provider_payers_v2` table instead of canonical view, causing "Not bookable for this payer on the selected date" errors for valid supervised appointments.

**Solution:**
- Updated `enforce_bookable_provider_payer()` trigger to use `v_bookable_provider_payer` (canonical view)
- Fixed `appointment_type` and `status` constraint errors in booking flow
- Removed deprecated v2 and v3 bookability tables/views
- Updated IntakeQ API key (rotated Oct 7)

**Result:** ✅ Supervised provider bookings now work (e.g., Dr. Sweeney under Dr. Privratsky's supervision with Molina)

### Migration Files:
- `database-migrations/CONSOLIDATED-bookability-fix.sql` - Trigger update migration
- `database-migrations/005-cleanup-deprecated-bookability-tables.sql` - Cleanup migration
- `BOOKABILITY_MIGRATION_MASTER_PLAN.md` - Complete migration strategy
- `BOOKABILITY_TABLE_AUDIT.md` - Table inventory and analysis

### Supervision Model (Healthcare Billing Context):

**Field Naming Clarification:**
- `billing_provider_id` in database = Actually the **supervising attending** (confusing name)
- For CMS-1500 forms: **Billing Provider** = Moonlit (practice entity), **Rendering Provider** = Attending supervisor

**How Supervised Appointments Work:**
- `provider_id` = Provider patient sees (e.g., Dr. Sweeney - resident)
- `billing_provider_id` = Supervising attending (e.g., Dr. Privratsky)
- `rendering_provider_id` = Also Dr. Privratsky (for insurance claims)
- `network_status` = 'supervised' (vs 'in_network' for direct contracts)

**Example:** Patient books Dr. Sweeney (resident) with Molina → Dr. Privratsky supervises and appears as rendering provider on insurance claim → Moonlit bills as practice entity.

---

## ✅ COMPLETED: IntakeQ Full Automation Integration (Oct 4-5, 2025)

**STATUS:** ⚠️ Partially working (database booking works, IntakeQ sync has bugs)

### What's Now Live:

**1. IntakeQ Appointment Sync** ✅
- Join table approach: `provider_intakeq_settings` (Service ID, Location ID, Practitioner ID)
- All bookings automatically sync to IntakeQ Team Calendar
- Google Meet links auto-generated by IntakeQ

**2. Patient Notifications** ✅
- IntakeQ sends confirmation email with Google Meet link
- IntakeQ sends pre-visit intake questionnaire (ID: `687ad30e356f38c6e4b11e62`)
- Patient receives both automatically after booking

**3. Provider Notifications** ✅
- Resend email to provider with appointment details
- Includes patient info, appointment time, IntakeQ ID
- Reminds provider to confirm appointment

**4. Admin Notifications** ✅
- Resend email to hello@trymoonlit.com with booking details
- Includes both Supabase and IntakeQ appointment IDs

**5. Availability Cache Auto-Population** ✅
- Cache auto-populates when users view calendar dates
- Fixes "DB_INSERT_FAILED" errors for future dates
- Derives from `provider_availability` table (source of truth)
- Uses default service_instance_id: `12191f44-a09c-426f-8e22-0c5b8e57b3b7`

### Key Files Updated:
- `src/lib/services/availabilityCacheService.ts` - Auto-population service
- `src/app/api/patient-booking/merged-availability/route.ts` - Integrated cache auto-population
- `src/app/api/patient-booking/create-appointment-v2/route.ts` - Added provider email field, notifications
- `src/lib/services/emailService.ts` - Enabled provider notifications
- `database-migrations/003-create-provider-intakeq-settings.sql` - Join table migration (✅ deployed)

### Configuration:
- **Service ID:** `137bcec9-6d59-4cd8-910f-a1d9c0616319` (New Patient Visit - insurance UT)
- **Location ID:** `4` (Insurance - UT)
- **Questionnaire ID:** `687ad30e356f38c6e4b11e62` (Pre-visit intake)
- **Resend Domain:** trymoonlit.com (DNS verification pending)

### What Works Now:
✅ Book by date → Auto-populates cache → Creates appointment → Syncs to IntakeQ → Sends all emails
✅ Book by provider → Same flow
✅ Future dates (Oct 7+) → Cache auto-populates on calendar view
✅ All 4 bookable providers configured with IntakeQ settings

### Next Steps (User):
1. ✅ Verify Resend domain DNS records (pending propagation)
2. Once verified, test full booking flow to confirm all emails send

---

🌟 Project Status

Moonlit Scheduler = production-ready healthcare website + booking platform

Fully functional booking system (dual intent: Book Now vs See Availability).

Provider directory with real data and filtering.

Double-booking prevention + IntakeQ EMR integration.

Provider auth with admin/provider dual roles.

RLS-compliant schedule management API.

🏗️ System Architecture

Frontend: Next.js + TypeScript + Tailwind
Backend: Next.js API routes + Supabase Postgres
Auth: Supabase Auth (admin vs provider vs partner separation)
EHRs: IntakeQ + Athena integrations
Email: Resend API (logs to console if unset)

✅ Current Functionality

Website routes:

/ homepage

/book booking flow (?intent=book|explore)

/practitioners searchable provider directory

/ways-to-pay insurance directory

Booking flow: Welcome → Insurance → Calendar → ROI → Summary → Confirmation

APIs: availability, create appointment, providers-for-payer, ways-to-pay.

Features: real-time conflict checking, language selection, clinical supervision model, exception handling, dual-role login, partner authentication.

Status: All tested and working in production (as of Sept 12, 2025).

👨‍⚕️ Provider/Auth Rules

Dual-role support: e.g. Dr. C. Rufus Sweeney can switch between admin and provider dashboards.

Provider visibility: controlled by list_on_provider_page + is_bookable.

Supervision model: Residents bookable if supervised by attending (billing) provider.

RLS compliance: All provider schedule reads/writes go through admin-privileged API endpoints.

🌟 Project Status

Moonlit Scheduler = production-ready healthcare website + booking platform

Fully functional booking system (dual intent: Book Now vs See Availability).

Provider directory with real data and filtering.

Double-booking prevention + IntakeQ EMR integration.

Provider auth with admin/provider dual roles.

RLS-compliant schedule management API.

🏗️ System Architecture

Frontend: Next.js + TypeScript + Tailwind
Backend: Next.js API routes + Supabase Postgres
Auth: Supabase Auth (admin vs provider vs partner separation)
EHRs: IntakeQ + Athena integrations
Email: Resend API (logs to console if unset)

✅ Current Functionality

Website routes:

/ homepage

/book booking flow (?intent=book|explore)

/practitioners searchable provider directory

/ways-to-pay insurance directory

Booking flow: Welcome → Insurance → Calendar → ROI → Summary → Confirmation

APIs: availability, create appointment, providers-for-payer, ways-to-pay.

Features: real-time conflict checking, language selection, clinical supervision model, exception handling, dual-role login, partner authentication.

Status: All tested and working in production (as of Sept 12, 2025).

👨‍⚕️ Provider/Auth Rules

Dual-role support: e.g. Dr. C. Rufus Sweeney can switch between admin and provider dashboards.

Provider visibility: controlled by list_on_provider_page + is_bookable.

Supervision model: Residents bookable if supervised by attending (billing) provider.

RLS compliance: All provider schedule reads/writes go through admin-privileged API endpoints.

🔧 Development Setup
# Install dependencies
npm install

# Env vars (.env.local)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_KEY=...
INTAKEQ_API_KEY=...
RESEND_API_KEY=...

# Run locally
npm run dev


Always test locally before pushing (main auto-deploys).

Verify booking flow end-to-end on desktop + mobile.

🛠️ Common Tasks

Add EMR: create src/lib/services/[emr]Service.ts, update booking routes.

Emails: edit src/lib/services/emailService.ts.

Booking flow: modify src/components/booking/BookingFlow.tsx.

Admin/provider auth: see auth_profiles + app_users tables.

🔍 Troubleshooting

Welcome page buttons unclickable → clear .next + node_modules/.cache.

No availability → check provider_availability_cache, providers, payers.

Double-booking → validate IntakeQ IDs + conflict logic.

Appointments missing in IntakeQ → confirm API key + practitioner mapping.

Email not sending → check RESEND_API_KEY, otherwise see console logs.

**🚨 RECURRING BUG: startDateTime Validation Errors - PERMANENTLY FIXED**

**Symptoms**: Console errors like `Invalid startDateTime: "09:00" "from slot:" {}`

**Root Cause**: The validateAndNormalizeData function in mapApiSlotToTimeSlot expected arrays but received individual objects, causing data corruption that resulted in empty objects `{}` being passed to fallback functions.

**Why it kept recurring**: Previous Claude instances tried to fix validation schemas instead of removing the problematic validation layer entirely.

**PERMANENT SOLUTION IMPLEMENTED**:
- Removed validateAndNormalizeData from mapApiSlotToTimeSlot in dataValidation.ts:160
- Implemented direct field mapping that handles the actual API response format
- Added clear documentation explaining why validation was removed
- This approach eliminates the data corruption that caused the errors

**NEVER**: Re-add validation to mapApiSlotToTimeSlot - it causes more problems than it solves

📊 Monitoring

Audit API logs for 409 conflicts (double-booking prevention).

Track appointment creation rate in appointments table.

Use debug endpoints (/api/debug/...) for provider-payer relationships, availability, and bookability explanations.

---

## ⏸️ TEMPORARILY DISABLED: ROI Contacts / Extra Contact Persons (Oct 27, 2025)

**STATUS:** ⏸️ DISABLED - Feature temporarily removed from booking flow

### Why Disabled:

The ROI (Release of Information) contacts feature was collecting user data but **not saving it to the database or IntakeQ**. To avoid misleading users, this step has been removed from the booking flow until the backend implementation is complete.

### What Was Built (UI Only):

**Frontend Components:**
- ✅ `/src/components/booking/views/ROIView.tsx` - Fully functional UI for collecting multiple contacts
- ✅ React state management in `BookingFlow.tsx` - Data flows correctly through components
- ✅ User can add name, email, relationship, organization for each contact
- ✅ ROI agreement checkbox and validation

**Database Schema:**
- ✅ `appointments.roi_contacts` JSONB column exists and ready to use (see `src/types/database.ts:32`)

**What's Missing (Backend):**
- ❌ BookingFlow.tsx doesn't send `roiContacts` in API payload
- ❌ `/api/patient-booking/book/route.ts` doesn't accept or save ROI contacts
- ❌ IntakeQ integration can only handle ONE contact via scalar fields, not an array

### Current State of Booking Flow:

```
Insurance Info → ⏭️ ROI (SKIPPED) → Appointment Summary → Confirmation
```

**Modified file:** `src/components/booking/BookingFlow.tsx:193-196`
- Changed `goToStep('roi')` to `goToStep('appointment-summary')`
- Added comment explaining temporary disable
- ROIView.tsx component still exists but is not rendered

### How to Re-Enable:

**See full implementation guide:** `ROI_CONTACTS_ANALYSIS_REPORT.md`

**Quick Steps (2-6 hours):**

1. **BookingFlow.tsx:196** - Change back to `goToStep('roi')`

2. **BookingFlow.tsx:233-254** - Add to payload:
   ```typescript
   roiContacts: state.roiContacts
   ```

3. **book/route.ts:27-50** - Add to interface:
   ```typescript
   interface IntakeBookingRequest {
     // ... existing fields ...
     roiContacts?: ROIContact[]
   }
   ```

4. **book/route.ts:212** - Extract from body:
   ```typescript
   const { roiContacts = [], ... } = body
   ```

5. **book/route.ts:495-516** - Add to appointment insert:
   ```typescript
   roi_contacts: roiContacts || []
   ```

6. **OPTIONAL (IntakeQ sync)** - Refactor `intakeqClientUpsert.ts` to handle contact arrays

### Files to Review for Re-Implementation:

| File | Purpose | Status |
|------|---------|--------|
| `src/components/booking/views/ROIView.tsx` | UI for collecting contacts | ✅ Ready to use |
| `src/components/booking/BookingFlow.tsx:193-196` | Re-enable step navigation | ⏸️ Commented out |
| `src/app/api/patient-booking/book/route.ts` | Add backend persistence | ❌ Not implemented |
| `src/lib/services/intakeqClientUpsert.ts:34-36` | IntakeQ sync (optional) | ⚠️ Only handles one contact |
| `ROI_CONTACTS_ANALYSIS_REPORT.md` | Full technical analysis | ✅ Complete reference |

### Database Schema (Ready to Use):

```sql
-- appointments table already has this column
appointments.roi_contacts JSONB NULL

-- Example data structure:
[
  {
    "name": "John Smith",
    "email": "john@example.com",
    "relationship": "Case Manager",
    "organization": "First Step House"
  },
  {
    "name": "Jane Doe",
    "email": "jane@example.com",
    "relationship": "Mother",
    "organization": null
  }
]
```

### IntakeQ Integration Notes:

The `intakeqClientUpsert.ts` service currently supports ONE contact via:
- `contactName` (string)
- `contactEmail` (string)
- `contactPhone` (string)

These get saved to IntakeQ's `AdditionalInformation` field and a pinned note.

To sync multiple ROI contacts to IntakeQ, refactor to loop through array and concatenate all contacts into the `AdditionalInformation` field. See `ROI_CONTACTS_ANALYSIS_REPORT.md` Option 2 for details.

### Testing Checklist (When Re-Enabled):

- [ ] Book with 0 contacts (skip button works)
- [ ] Book with 1 contact
- [ ] Book with 3 contacts
- [ ] Verify data saves to `appointments.roi_contacts` in Supabase
- [ ] Verify IntakeQ sync (if implemented)
- [ ] Confirmation email includes contacts (if implemented)

---

## 🔮 FUTURE: Google Meet Integration Infrastructure (Nov 3, 2025)

**STATUS:** 🔮 INFRASTRUCTURE ONLY - Not yet implemented

### Context:

**Infrastructure exists but is not active:**
- `/src/lib/services/googleMeetService.ts` - Service ready for Google Calendar API integration
- Booking route has code to generate and save meeting URLs
- Database has `meeting_url` field on appointments table

**Why it's disabled:**
- IntakeQ currently generates meeting links automatically
- Google Calendar API integration requires OAuth setup and service account configuration
- Not needed for MVP since IntakeQ handles this

**What would be needed to enable:**
1. Set up Google Cloud project with Calendar API enabled
2. Create service account with calendar.events scope
3. Share calendar with service account
4. Add environment variables:
   - `GOOGLE_CALENDAR_ID`
   - `GOOGLE_SERVICE_ACCOUNT_KEY`
5. Test meet link generation

**Current behavior:**
- Telehealth appointments rely on IntakeQ-generated meeting links
- Google Meet code paths are present but return null when env vars missing
- System continues without Google Meet links - not a blocking error

**Note for developers:** The infrastructure is intentionally left in place for future use. Do not remove the Google Meet code - it will be activated when needed.

---

## 📧 Handling Duplicate Patient Records (Oct 31, 2025)

**Problem:** Patients sometimes change their email after intake, creating duplicate records when they book again with the new email.

**Prevention (Migration 007):**
- Added `alternate_emails` JSONB column to `patients` table
- PracticeQ sync service now queries IntakeQ for ALL patient emails (primary + alternates)
- When a patient changes email:
  1. Update `patients.email` to new address
  2. Add old email to `patients.alternate_emails` array: `'["old@email.com"]'::jsonb`
  3. Sync will find appointments under either email

**Resolution (When Duplicates Exist):**

Manual SQL merge is appropriate for rare cases. See `/database-migrations/merge-matthew-reese-records-v2.sql` as template.

**Key steps:**
1. Identify canonical record (check `patient_organization_affiliations`)
2. Update canonical record's email and add old email to `alternate_emails`
3. **Disable bookability triggers** before moving appointments:
   ```sql
   ALTER TABLE appointments DISABLE TRIGGER check_bookable_provider_payer;
   ALTER TABLE appointments DISABLE TRIGGER enforce_bookable_provider_payer;
   ```
4. Move appointments: `UPDATE appointments SET patient_id = 'canonical-id' WHERE patient_id = 'duplicate-id'`
5. **Re-enable triggers**
6. Delete duplicate patient record
7. Verify merge with SELECT statements

**Why triggers must be disabled:** Changing `patient_id` in appointments table re-validates provider-payer contracts, which may fail if patient's payer differs between records.

**When to build merge UI:** If this becomes frequent (5-10+ occurrences), consider building `/admin/patients/merge` with validation and preview.

---

📝 For Future Developers

Use canonical view v_bookable_provider_payer for provider-payer relationships.

Avoid direct Supabase client calls from frontend for protected tables → always use API endpoints.

Keep role separation clear: admin, provider, partner each have distinct routes and dashboards.

All production data must be real; confirm with Miriam before seeding.

Last updated: Oct 27, 2025
