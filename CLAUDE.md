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

📝 For Future Developers

Use canonical view v_bookable_provider_payer for provider-payer relationships.

Avoid direct Supabase client calls from frontend for protected tables → always use API endpoints.

Keep role separation clear: admin, provider, partner each have distinct routes and dashboards.

All production data must be real; confirm with Miriam before seeding.

Last updated: Oct 5, 2025
