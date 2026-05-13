# V2.0 Final Fixes - Spot Check Guide

**Dev Server:** ✅ Running at http://localhost:3000
**Environment:** `.env.local` configured with all required flags

---

## ✅ Environment Variables Confirmed

```bash
NEXT_PUBLIC_USE_V2_BOOKING=true                    # Use V2 endpoint
PRACTICEQ_SEND_QUESTIONNAIRE_ON_CREATE=true        # Send questionnaires
PRACTICEQ_ENRICH_ENABLED=true                      # DOB + insurance enrichment
PRACTICEQ_ALIAS_EMAILS_FOR_DUPLICATES=true         # Email aliasing
```

---

## 🔍 Spot-Check Concerns

### 1. Questionnaire Routing ✅

**Implementation verified:**
- **Medicaid payers** → Questionnaire ID `6823985dba25b046d739b9c6`
- **Non-Medicaid payers** → Questionnaire ID `67632ecd93139e4c43407617`

**Detection logic** (`src/lib/services/intakeqQuestionnaire.ts:41-78`):
1. First checks `payer_external_mappings` where:
   - `system = 'practiceq'`
   - `key_name = 'questionnaire_type'`
   - `value = 'medicaid'`
2. Fallback checks `provider_payer_networks.network_status = 'medicaid'`
3. Defaults to general (commercial) questionnaire if neither match

**To verify payer mapping:**
```sql
-- Check if a payer is flagged as Medicaid
SELECT
  p.id,
  p.name,
  pem.value as questionnaire_type,
  ppn.network_status
FROM payers p
LEFT JOIN payer_external_mappings pem ON
  pem.payer_id = p.id
  AND pem.system = 'practiceq'
  AND pem.key_name = 'questionnaire_type'
LEFT JOIN provider_payer_networks ppn ON
  ppn.payer_id = p.id
  AND ppn.network_status = 'medicaid'
WHERE p.name ILIKE '%medicaid%' OR pem.value = 'medicaid'
LIMIT 10;
```

---

### 2. DOB to IntakeQ ✅

**Implementation verified:**
- DOB sent in both create and update payloads
- Retry logic added: If response omits DOB, retries with `{ Id, DateOfBirth }`
- Enrichment tracked in `intakeq_sync_audit.enrichment_data.enrichedFields`

**Files:**
- `src/lib/services/intakeqClientUpsert.ts:618-634` (create retry)
- `src/lib/services/intakeqClientUpsert.ts:475-500` (update retry)

**Manual verification needed:**
1. Book appointment with DOB
2. Login to IntakeQ → Search for client by email
3. Verify "Date of Birth" field is populated

**If DOB is missing, check audit:**
```sql
SELECT
  intakeq_client_id,
  action,
  payload->>'DateOfBirth' as dob_sent,
  enrichment_data->'enrichedFields' as enriched_fields,
  response->>'DateOfBirth' as dob_returned,
  error_message
FROM intakeq_sync_audit
WHERE action IN ('create_client', 'update_client')
  AND intakeq_client_id = 'CLIENT_ID_FROM_INTAKEQ'
ORDER BY created_at DESC
LIMIT 1;
```

---

### 3. Address Removal ✅

**Implementation verified:**
- Removed from `PatientInfo` type (`src/types/database.ts:1649-1663`)
- Removed from UI component (`src/components/booking/views/InsuranceInfoView.tsx:24-31`)
- Not included in booking payload (`src/components/booking/BookingFlow.tsx:225-243`)

**Browser verification:**
1. Open DevTools → Network tab
2. Complete a booking
3. Find POST to `/api/patient-booking/book-v2`
4. Inspect Request Payload → Should NOT contain `address` key

**SQL verification (ensure IntakeQ doesn't receive address):**
```sql
SELECT
  action,
  created_at,
  payload->>'Address' as address_field,
  CASE
    WHEN payload ? 'Address' THEN '❌ ADDRESS_STILL_SENT'
    ELSE '✅ ADDRESS_REMOVED'
  END as status
FROM intakeq_sync_audit
WHERE action IN ('create_client', 'update_client')
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 5;
```

---

### 4. Payer Persistence ✅

**Implementation verified:**
- **DB:** `patients.primary_payer_id` set on first booking (`src/app/api/patient-booking/book-v2/route.ts:135`)
- **IntakeQ:** `PrimaryInsuranceCompanyName` sent via `getInsuranceCompanyName()` mapping

**Mapping logic:**
1. Tries `payer_external_mappings` where:
   - `system = 'practiceq'`
   - `key_name = 'insurance_company_name'`
2. Fallback to `payers.name`

**Check payer mapping:**
```sql
-- Verify insurance company name mappings exist
SELECT
  p.id,
  p.name as payer_name,
  pem.value as intakeq_insurance_name
FROM payers p
LEFT JOIN payer_external_mappings pem ON
  pem.payer_id = p.id
  AND pem.system = 'practiceq'
  AND pem.key_name = 'insurance_company_name'
WHERE p.is_active = true
ORDER BY p.name
LIMIT 20;
```

**If IntakeQ shows blank insurance:**
- Check if mapping exists in `payer_external_mappings`
- If missing, add mapping or rely on fallback to `payers.name`

---

### 5. Scroll-to-Top ✅

**Implementation verified:**
- `goToStep()` function calls `window.scrollTo({ top: 0, behavior: 'smooth' })`
- Backup `useEffect` hook monitors `state.step` changes
- Fallback to instant scroll if browser blocks smooth scroll (reduced-motion settings)

**Files:**
- `src/components/booking/BookingFlow.tsx:92-101`

**Manual test:**
1. Navigate to booking flow
2. Scroll to bottom of page
3. Click "Next"
4. Observe: Page should smoothly scroll to top

---

## 📊 Quick SQL Spot-Checks

Run these before full UI testing to verify schema/config:

### A) Questionnaire Sends
```sql
SELECT
  action,
  status,
  appointment_id,
  enrichment_data->>'questionnaireName' as questionnaire_type,
  enrichment_data->>'questionnaireId' as questionnaire_id,
  payload->>'clientEmail' as email,
  error_message,
  created_at
FROM intakeq_sync_audit
WHERE action = 'send_questionnaire'
ORDER BY created_at DESC
LIMIT 10;
```

**Expected:** After booking, should show `status='success'` with `questionnaire_type='medicaid'` or `'general'`

---

### B) DOB Saved in DB
```sql
SELECT
  p.id,
  p.first_name,
  p.last_name,
  p.email,
  p.date_of_birth,
  p.intakeq_client_id,
  a.created_at as booking_time
FROM patients p
JOIN appointments a ON a.patient_id = p.id
WHERE a.created_at >= NOW() - INTERVAL '6 hours'
ORDER BY a.created_at DESC
LIMIT 10;
```

**Expected:** `date_of_birth` populated for all recent bookings

---

### C) Primary Payer Set
```sql
SELECT
  p.id,
  p.email,
  p.primary_payer_id,
  py.name as primary_payer_name,
  a.payer_id as appointment_payer_id,
  pa.name as appointment_payer_name,
  a.created_at as booking_time
FROM patients p
JOIN appointments a ON a.patient_id = p.id
LEFT JOIN payers py ON py.id = p.primary_payer_id
LEFT JOIN payers pa ON pa.id = a.payer_id
WHERE a.created_at >= NOW() - INTERVAL '6 hours'
ORDER BY a.created_at DESC
LIMIT 10;
```

**Expected:** `primary_payer_id` NOT NULL for first-time patients

---

### D) IntakeQ Enrichment Applied
```sql
SELECT
  action,
  intakeq_client_id,
  payload->>'FirstName' as first_name,
  payload->>'DateOfBirth' as dob_sent,
  payload->>'PrimaryInsuranceCompanyName' as insurance_sent,
  payload->>'PrimaryMemberID' as member_id_sent,
  enrichment_data->'enrichedFields' as enriched_fields,
  created_at
FROM intakeq_sync_audit
WHERE action IN ('create_client', 'update_client')
  AND created_at >= NOW() - INTERVAL '6 hours'
ORDER BY created_at DESC
LIMIT 10;
```

**Expected:** `enriched_fields` includes `["DateOfBirth", "PrimaryInsuranceName"]`

---

## 🚨 Common Issues & Solutions

### Issue: Questionnaire not sending
**Check:**
1. `PRACTICEQ_SEND_QUESTIONNAIRE_ON_CREATE=true` in `.env.local`?
2. Dev server restarted after env change?
3. Check audit: `SELECT * FROM intakeq_sync_audit WHERE action='send_questionnaire' AND status='failed' ORDER BY created_at DESC LIMIT 1;`

### Issue: DOB missing in IntakeQ
**Check:**
1. Audit log shows DOB was sent: `payload->>'DateOfBirth'`
2. Retry was attempted (check logs for "⚠️ IntakeQ response missing DOB, retrying...")
3. IntakeQ API may have silently rejected it (no error returned)

### Issue: No address field but validation fails
**Check:**
1. Browser cache cleared?
2. Hard refresh (Cmd+Shift+R)
3. Check if old component is cached in `.next/`

### Issue: Payer not in IntakeQ profile
**Check:**
1. Mapping exists: `SELECT * FROM payer_external_mappings WHERE key_name='insurance_company_name'`
2. Fallback to `payers.name` should work (check audit `payload->>'PrimaryInsuranceCompanyName'`)

---

## ✅ Ready to Test

**Server:** http://localhost:3000
**Start at:** `/book`

**Test flow:**
1. Book with Medicaid payer → Check questionnaire type
2. Book with commercial payer → Check questionnaire type
3. Verify DOB in IntakeQ
4. Check Network tab for no address field
5. Verify scroll-to-top behavior
6. Run SQL queries above

**Full test plan:** See `V2_FINAL_UI_TEST_CHECKLIST.md`
