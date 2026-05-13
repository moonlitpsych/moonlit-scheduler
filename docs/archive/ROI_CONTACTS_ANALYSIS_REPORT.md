# ROI/Extra Contact Person Analysis Report
**Generated:** October 27, 2025
**Worktree:** `moonlit-scheduler-booking-v2-prod`
**Branch:** `feat/booking-v2-production-ready`

---

## Executive Summary

The booking flow UI **collects ROI (Release of Information) contact data** from users, but this data **never reaches the database or IntakeQ**. The functionality is a **dead-end at the API call stage**.

### Critical Finding: 🚨 Data Loss
- ✅ **UI is fully functional** - Users can add multiple contacts with name, email, relationship, organization
- ✅ **State management works** - Data flows correctly through React state
- ✅ **Database schema exists** - `appointments.roi_contacts` JSONB column is ready
- ❌ **API payload omits data** - `roiContacts` array is never sent to booking endpoint
- ❌ **IntakeQ integration incomplete** - Can only handle ONE contact via separate fields, not the full array

---

## Detailed Flow Analysis

### 1. UI Layer - ROIView.tsx ✅ **FUNCTIONAL**

**Location:** `/src/components/booking/views/ROIView.tsx`

**What it does:**
- Displays prominent "Skip" button at top (lines 102-117)
- Allows adding multiple contacts with fields:
  - `name` (required)
  - `email` (required)
  - `relationship` (optional)
  - `organization` (optional)
- Has ROI agreement checkbox (line 268-283)
- Users can add unlimited contacts to array

**Data structure collected:**
```typescript
interface ROIContact {
  name: string
  email: string
  relationship?: string
  organization?: string
}
```

**Status:** ✅ **Working as designed** - UI is clean, user-friendly, collects data properly

---

### 2. State Management - BookingFlow.tsx ✅ **FUNCTIONAL**

**Location:** `/src/components/booking/BookingFlow.tsx`

**State management:**
- Line 45: `roiContacts: ROIContact[]` defined in BookingState
- Line 84: Initialized as empty array: `roiContacts: []`
- Line 196-199: `handleROISubmitted` correctly updates state with contacts array
- Line 609: Passes `roiContacts` to AppointmentSummaryView for display

**Status:** ✅ **Working correctly** - Data flows through React state without issues

---

### 3. API Payload - BookingFlow.tsx ❌ **DEAD-END**

**Location:** `/src/components/booking/BookingFlow.tsx` (lines 233-254)

**The Problem:**
The `handleAppointmentConfirmed` function builds the booking payload but **omits roiContacts entirely**:

```typescript
const payload = {
    ...(patient?.id
        ? { patientId: patient.id }
        : {
            patient: {
                firstName: patient?.firstName || '',
                lastName: patient?.lastName || '',
                email: patient?.email || '',
                phone: patient?.phone,
                dateOfBirth: patient?.dateOfBirth || patient?.dob
            }
        }
    ),
    providerId: slot?.provider_id,
    payerId: state.selectedPayer?.id,
    start: startDateTime,
    locationType: 'telehealth' as const,
    notes: patient?.notes || undefined,
    memberId: patient?.insuranceId || undefined,
    groupNumber: patient?.groupNumber || undefined
    // ❌ roiContacts: state.roiContacts  <- MISSING!
}
```

**What should be added:**
```typescript
roiContacts: state.roiContacts  // Add this line to payload
```

**Status:** ❌ **BROKEN** - This is where the data loss occurs

---

### 4. Booking API - /api/patient-booking/book/route.ts ❌ **NOT IMPLEMENTED**

**Location:** `/src/app/api/patient-booking/book/route.ts`

**Interface definition (lines 27-50):**
```typescript
interface IntakeBookingRequest {
    patientId?: string
    patient?: { ... }
    providerId: string
    payerId: string
    start: string
    locationType: 'telehealth' | 'in_person'
    notes?: string
    memberId?: string
    groupNumber?: string
    referralCode?: string
    referredByOrganizationId?: string
    referredByPartnerUserId?: string
    // ❌ roiContacts?: ROIContact[]  <- MISSING!
}
```

**Database insert (lines 495-516):**
```typescript
const appointmentInsert = {
    provider_id: providerId,
    service_instance_id: serviceInstanceId,
    payer_id: payerId,
    patient_id: patientId,
    start_time: startDate.toISOString(),
    end_time: endDate.toISOString(),
    // ... other fields ...
    notes: notes || '',
    // ❌ roi_contacts: roiContacts  <- MISSING!
}
```

**What needs to be added:**
1. Add `roiContacts?: ROIContact[]` to `IntakeBookingRequest` interface
2. Destructure `roiContacts` from request body (line 212)
3. Add `roi_contacts: roiContacts || []` to appointment insert (line 516)

**Status:** ❌ **NOT IMPLEMENTED** - API doesn't accept or save ROI contacts

---

### 5. IntakeQ Integration - intakeqClientUpsert.ts ⚠️ **PARTIAL**

**Location:** `/src/lib/services/intakeqClientUpsert.ts`

**What EXISTS:**
The service CAN handle a SINGLE contact via separate fields:
- Line 34-36: `contactName`, `contactEmail`, `contactPhone` fields
- Lines 480-495: Saves to `AdditionalInformation` field in IntakeQ
- Lines 539-548: Creates pinned note in IntakeQ with contact details

**Example usage (currently NOT called):**
```typescript
await upsertPracticeQClient({
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
  contactName: 'John Smith',      // ← Single contact only
  contactEmail: 'john@example.com',
  contactPhone: '555-1234',
  // ❌ Cannot pass multiple ROI contacts
})
```

**The Limitation:**
- Can only handle ONE contact, not an array
- ROI contacts UI allows MULTIPLE contacts
- Would need refactoring to handle array of contacts

**Status:** ⚠️ **PARTIALLY FUNCTIONAL** - Can save one contact, but not multiple

---

### 6. Database Schema - appointments table ✅ **READY**

**Location:** `/src/types/database.ts` (line 32)

**Schema:**
```typescript
appointments: {
  Row: {
    // ... other fields ...
    roi_contacts: Json | null  // ✅ Column exists and ready
  }
}
```

**Status:** ✅ **SCHEMA EXISTS** - Database is ready to accept ROI contacts array

---

### 7. Legacy API - create-appointment-v2/route.ts ✅ **IMPLEMENTED BUT UNUSED**

**Location:** `/src/app/api/patient-booking/create-appointment-v2/route.ts`

**What it does:**
- Line 34: Accepts `roiContacts?: any[]` in request interface
- Line 54: Defaults to empty array: `roiContacts = []`
- Would save to database with `roi_contacts: roiContacts`

**Status:** ✅ **WORKING** - But this endpoint appears to be deprecated/unused

---

## Where ROI Contacts Are Actually Functioning

### ✅ WORKS: UI Collection
- Users see the ROI form
- Can add/remove contacts
- Data validates correctly
- Skip button works

### ✅ WORKS: State Management
- Data stored in React state
- Passed between components
- Displayed in summary view

### ❌ FAILS: Data Persistence
- Never sent to API
- Never saved to database
- Never synced to IntakeQ

---

## Dead-End Points

### Dead-End #1: BookingFlow API Call (PRIMARY ISSUE)
**File:** `src/components/booking/BookingFlow.tsx:233-254`
**Problem:** Payload construction omits `roiContacts`
**Impact:** Data collected but never sent to backend

### Dead-End #2: Booking API Interface
**File:** `src/app/api/patient-booking/book/route.ts:27-50`
**Problem:** API doesn't accept `roiContacts` parameter
**Impact:** Even if sent, API would ignore it

### Dead-End #3: Database Insert
**File:** `src/app/api/patient-booking/book/route.ts:495-516`
**Problem:** Appointment insert doesn't include `roi_contacts` field
**Impact:** Data never reaches database

### Dead-End #4: IntakeQ Array Limitation
**File:** `src/lib/services/intakeqClientUpsert.ts:34-36`
**Problem:** Only handles single contact via scalar fields, not array
**Impact:** Cannot sync multiple ROI contacts to IntakeQ

---

## Production Impact Assessment

### Current User Experience:
1. User fills out ROI contact form (1-3 minutes)
2. User reviews in appointment summary
3. User confirms booking
4. **Data is silently discarded** ❌
5. No error message shown
6. User believes contacts were saved

### Data Loss Scenarios:
- ❌ Emergency contact information lost
- ❌ Case manager details lost
- ❌ Family member communication preferences lost
- ❌ HIPAA ROI authorizations not tracked

### Compliance Risk:
- ⚠️ Users grant ROI permission but contact info isn't stored
- ⚠️ No audit trail of who was authorized for PHI disclosure
- ⚠️ Potential HIPAA documentation gap

---

## Recommended Fixes

### Option 1: Quick Fix (Database Only) - 2 hours
**Scope:** Save ROI contacts to database only, skip IntakeQ for now

**Changes needed:**
1. **BookingFlow.tsx** - Add to payload:
   ```typescript
   roiContacts: state.roiContacts
   ```

2. **book/route.ts** - Update interface:
   ```typescript
   interface IntakeBookingRequest {
     // ... existing fields ...
     roiContacts?: ROIContact[]
   }
   ```

3. **book/route.ts** - Extract from body:
   ```typescript
   const { roiContacts = [], ... } = body
   ```

4. **book/route.ts** - Add to insert:
   ```typescript
   const appointmentInsert = {
     // ... existing fields ...
     roi_contacts: roiContacts
   }
   ```

**Pros:**
- Minimal code changes
- Data immediately persisted
- Compliance gap closed

**Cons:**
- IntakeQ won't have contact info
- Manual data entry needed for IntakeQ

---

### Option 2: Full Integration (Database + IntakeQ) - 6 hours
**Scope:** Save to both database and sync all contacts to IntakeQ

**Additional changes:**
1. **intakeqClientUpsert.ts** - Refactor to accept array:
   ```typescript
   interface ClientUpsertRequest {
     // ... existing fields ...
     roiContacts?: Array<{
       name: string
       email: string
       relationship?: string
       organization?: string
     }>
   }
   ```

2. **intakeqClientUpsert.ts** - Loop through contacts:
   ```typescript
   if (request.roiContacts && request.roiContacts.length > 0) {
     const contactInfo = request.roiContacts.map(contact =>
       `Name: ${contact.name}\n` +
       `Email: ${contact.email}\n` +
       `Relationship: ${contact.relationship || 'N/A'}\n` +
       `Organization: ${contact.organization || 'N/A'}`
     ).join('\n\n---\n\n')

     updates.AdditionalInformation =
       (primaryClient.AdditionalInformation || '') +
       '\n\nROI Contacts:\n' + contactInfo
   }
   ```

3. **book/route.ts** - Pass to ensureClient:
   ```typescript
   intakeqClientId = await ensureClient(
     patientId,
     payerId,
     patientMatchType,
     body.memberId,
     body.groupNumber,
     body.roiContacts  // Add this parameter
   )
   ```

**Pros:**
- Complete solution
- IntakeQ has all contact info
- No manual data entry needed
- Audit trail in both systems

**Cons:**
- More complex changes
- Requires testing IntakeQ API behavior
- IntakeQ's `AdditionalInformation` field has character limits

---

### Option 3: Disable Feature (1 hour)
**Scope:** Remove ROI form from booking flow until fix is ready

**Changes needed:**
1. **BookingFlow.tsx** - Skip ROI step:
   ```typescript
   const handleInsuranceInfoSubmitted = (...) => {
     // goToStep('roi')  // Old
     goToStep('appointment-summary')  // New - skip ROI
   }
   ```

**Pros:**
- Prevents misleading users
- Avoids data loss perception
- Quick temporary fix

**Cons:**
- Removes feature entirely
- User feedback may be negative
- Doesn't solve the problem

---

## Testing Checklist (After Fix)

### Unit Tests:
- [ ] ROI contacts array serializes to JSON correctly
- [ ] Empty array doesn't cause errors
- [ ] Special characters in names/emails handled
- [ ] Long organization names don't truncate unexpectedly

### Integration Tests:
- [ ] ROI contacts save to `appointments.roi_contacts` column
- [ ] Can retrieve appointments and deserialize ROI contacts
- [ ] Multiple contacts with same email allowed
- [ ] IntakeQ `AdditionalInformation` field accepts full payload (if Option 2)

### E2E Tests:
- [ ] Book appointment with 0 ROI contacts (skip button)
- [ ] Book appointment with 1 ROI contact
- [ ] Book appointment with 3 ROI contacts
- [ ] Book appointment, verify data in Supabase dashboard
- [ ] Book appointment, verify data in IntakeQ (if Option 2)
- [ ] ROI contacts display correctly in confirmation view

### Regression Tests:
- [ ] Booking without ROI contacts still works
- [ ] Other appointment data (patient, provider, time) unaffected
- [ ] Idempotency key handling unchanged
- [ ] Email notifications still sent

---

## Questions for Product Decision

1. **Priority:** Is this a blocker for v2 production launch?
2. **IntakeQ:** Do providers need ROI contacts in IntakeQ, or is database storage sufficient?
3. **Historical Data:** Should we backfill ROI contacts for past appointments? (Answer: No data exists - was never saved)
4. **UI Clarity:** Should we add a message like "ROI contacts will be reviewed by staff after booking"?
5. **Case Manager Flow:** Should case manager bookings automatically include the case manager as an ROI contact?

---

## Conclusion

The ROI contact feature is **50% implemented**:
- ✅ Frontend: Fully functional UI for data collection
- ✅ Database: Schema ready with `roi_contacts` JSONB column
- ❌ Backend: API doesn't accept or save the data
- ⚠️ Integration: IntakeQ can only handle single contact, not array

**Recommended Path Forward:**
Implement **Option 1 (Quick Fix)** for v2 launch to close the data loss gap, then plan **Option 2 (Full Integration)** for a future release once IntakeQ integration patterns are validated.

---

**Report prepared by:** Claude Code
**Review requested from:** Miriam (Product Manager)
