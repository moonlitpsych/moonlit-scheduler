# V2.0 Final Fixes - UI Test Checklist

Complete these 6 tests to verify all fixes are working correctly in production.

---

## Test 1: Medicaid Questionnaire Send

**Objective:** Verify Medicaid patients receive the correct questionnaire

**Steps:**
1. Navigate to booking flow at `/book`
2. Select a **Medicaid payer** (e.g., "Utah Medicaid")
3. Choose any available time slot
4. Fill in patient information:
   - First Name: Test
   - Last Name: MedicaidPatient
   - Email: `test.medicaid+[timestamp]@trymoonlit.com`
   - Phone: (801) 555-0001
   - DOB: 01/01/1990
   - Insurance ID: MED123456
5. Complete ROI consent (if required)
6. Confirm appointment

**Expected Results:**
- ✅ Booking succeeds with confirmation page
- ✅ Check email: Questionnaire link should be for **Medicaid** form (ID: `6823985dba25b046d739b9c6`)
- ✅ SQL verification: `SELECT * FROM intakeq_sync_audit WHERE action='send_questionnaire' AND enrichment_data->>'questionnaireName'='medicaid' ORDER BY created_at DESC LIMIT 1;`
- ✅ Audit shows: `status='success'`, `questionnaireName='medicaid'`

---

## Test 2: Non-Medicaid Questionnaire Send

**Objective:** Verify commercial insurance patients receive the correct questionnaire

**Steps:**
1. Navigate to booking flow at `/book`
2. Select a **commercial payer** (e.g., "Blue Cross Blue Shield")
3. Choose any available time slot
4. Fill in patient information:
   - First Name: Test
   - Last Name: CommercialPatient
   - Email: `test.commercial+[timestamp]@trymoonlit.com`
   - Phone: (801) 555-0002
   - DOB: 02/02/1985
   - Insurance ID: BCBS789012
5. Complete ROI consent (if required)
6. Confirm appointment

**Expected Results:**
- ✅ Booking succeeds with confirmation page
- ✅ Check email: Questionnaire link should be for **general** form (ID: `67632ecd93139e4c43407617`)
- ✅ SQL verification: `SELECT * FROM intakeq_sync_audit WHERE action='send_questionnaire' AND enrichment_data->>'questionnaireName'='general' ORDER BY created_at DESC LIMIT 1;`
- ✅ Audit shows: `status='success'`, `questionnaireName='general'`

---

## Test 3: DOB Saves to IntakeQ Profile

**Objective:** Verify date of birth is persisted to IntakeQ client profile

**Steps:**
1. Navigate to booking flow at `/book`
2. Select any payer
3. Choose any available time slot
4. Fill in patient information with a **unique email**:
   - First Name: Test
   - Last Name: DOBPatient
   - Email: `test.dob+[timestamp]@trymoonlit.com`
   - Phone: (801) 555-0003
   - **DOB: 03/15/1992** (specific date for verification)
   - Insurance ID: DOB123456
5. Complete booking

**Expected Results:**
- ✅ Booking succeeds
- ✅ Login to IntakeQ (https://intakeq.com)
- ✅ Search for client by email: `test.dob+[timestamp]@trymoonlit.com`
- ✅ Verify client profile shows DOB: **03/15/1992**
- ✅ SQL verification: Check `enrichment_data` includes `DateOfBirth` in enriched fields
- ✅ If DOB missing, check logs for retry attempt

---

## Test 4: Address Field Removed + Note Displayed

**Objective:** Verify address is no longer collected and user is informed

**Steps:**
1. Navigate to booking flow at `/book`
2. Select any payer and time slot
3. Reach the **Patient Information** page

**Expected Results:**
- ✅ **NO address input field visible** on patient info form
- ✅ Blue informational box is displayed with text:
  > "📋 **Note:** Address and additional details will be collected in your intake paperwork after booking."
- ✅ Form validation does NOT require address
- ✅ Can submit form without address field
4. Complete booking and reach confirmation page

**Expected Results:**
- ✅ Confirmation page shows note:
  > "📋 Address and additional details will be collected in your intake paperwork."
- ✅ Network tab (F12 → Network): Check POST payload to `/api/patient-booking/book-v2`
- ✅ Payload does **NOT** contain any `address` field
- ✅ SQL verification: `SELECT payload FROM intakeq_sync_audit WHERE action='create_client' ORDER BY created_at DESC LIMIT 1;`
- ✅ Payload JSON should NOT have `Address` key

---

## Test 5: Auto-Scroll on Step Changes

**Objective:** Verify viewport scrolls to top when navigating between booking steps

**Steps:**
1. Navigate to booking flow at `/book`
2. Scroll to **bottom** of page
3. Click "Next" or "Continue" to advance to insurance selection
4. **Observe scroll behavior**

**Expected Results:**
- ✅ Page smoothly scrolls to top
- ✅ User sees top of next step (insurance selection)

5. Repeat for each step transition:
   - Insurance → Calendar
   - Calendar → Patient Info (scroll down first, then select a time)
   - Patient Info → ROI
   - ROI → Summary
   - Summary → Confirmation

**Expected Results:**
- ✅ Each transition smoothly scrolls viewport to top
- ✅ No "stuck" scroll position from previous step
- ✅ User experience feels natural and oriented

---

## Test 6: Primary Payer Saved (DB + IntakeQ)

**Objective:** Verify selected payer is persisted to patient record and IntakeQ profile

**Steps:**
1. Navigate to booking flow at `/book`
2. Select payer: **"Molina Healthcare"** (or another specific payer)
3. Choose any available time slot
4. Fill in patient information with **unique email**:
   - First Name: Test
   - Last Name: PayerPatient
   - Email: `test.payer+[timestamp]@trymoonlit.com`
   - Phone: (801) 555-0006
   - DOB: 06/06/1988
   - Insurance ID: PAYER654321
5. Complete booking

**Expected Results - Database:**
- ✅ SQL verification:
  ```sql
  SELECT
    p.email,
    p.primary_payer_id,
    py.name as primary_payer_name,
    a.payer_id as appointment_payer_id
  FROM patients p
  LEFT JOIN payers py ON py.id = p.primary_payer_id
  LEFT JOIN appointments a ON a.patient_id = p.id
  WHERE p.email = 'test.payer+[timestamp]@trymoonlit.com';
  ```
- ✅ `primary_payer_id` is set (not NULL)
- ✅ `primary_payer_name` = "Molina Healthcare"
- ✅ `appointment_payer_id` equals `primary_payer_id` (first booking sets primary)

**Expected Results - IntakeQ:**
- ✅ Login to IntakeQ (https://intakeq.com)
- ✅ Search for client: `test.payer+[timestamp]@trymoonlit.com`
- ✅ Client profile shows **Primary Insurance Company Name**: "Molina Healthcare"
- ✅ If member ID was provided, verify **Primary Member ID** is populated
- ✅ SQL audit verification:
  ```sql
  SELECT
    payload->>'PrimaryInsuranceCompanyName' as insurance_name,
    payload->>'PrimaryMemberID' as member_id,
    enrichment_data->'enrichedFields' as enriched_fields
  FROM intakeq_sync_audit
  WHERE action IN ('create_client', 'update_client')
    AND intakeq_client_id = (
      SELECT intakeq_client_id FROM patients
      WHERE email = 'test.payer+[timestamp]@trymoonlit.com'
    )
  ORDER BY created_at DESC LIMIT 1;
  ```
- ✅ `insurance_name` = "Molina Healthcare"
- ✅ `enriched_fields` includes `"PrimaryInsuranceName"`

---

## Overall Success Criteria

All 6 tests must pass with ✅ on all expected results.

**Post-Test Verification:**
1. Run `scripts/verify-v2-final.sql` in Supabase SQL editor
2. Review summary metrics - all counts should be > 0 for recent bookings
3. Check troubleshooting section - should show minimal/no failures
4. Review IntakeQ client profiles manually for 2-3 test bookings

**Sign-off:**
- [ ] All 6 UI tests passed
- [ ] SQL verification script shows healthy metrics
- [ ] No critical errors in logs
- [ ] IntakeQ profiles manually verified for DOB and insurance

**Ready to ship:** ✅
