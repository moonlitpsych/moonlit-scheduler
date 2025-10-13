# V2.0 Booking System Test Plan

## Test Environment Setup

1. **Feature Flags** (.env.local)
```bash
PRACTICEQ_ENRICH_ENABLED=true
PRACTICEQ_DUPLICATE_ALERTS_ENABLED=true
INTAKE_HIDE_NON_INTAKE_PROVIDERS=true
BOOKING_AUTO_REFRESH_ENABLED=false
PRACTICEQ_SEND_QUESTIONNAIRE_ON_CREATE=true
PRACTICEQ_ALIAS_EMAILS_FOR_DUPLICATES=true
```

2. **Required Database Tables**
- ✅ `idempotency_requests` - Created
- ✅ `intakeq_sync_audit` - Created
- ✅ `payer_external_mappings` - Created
- ✅ `patients.intakeq_email_alias` column - Created (migration 012)

## Test Scenarios

### 1. Commercial Payer Flow with Contact

**Setup:**
- Patient: New patient with full details (name, DOB, phone, email)
- Payer: Commercial (e.g., Aetna, BCBS)
- Contact: Case manager with email and phone

**Steps:**
1. Navigate to booking flow
2. Enter patient details:
   - First Name: "Jane"
   - Last Name: "Smith"
   - Email: "jane.smith@example.com"
   - Phone: "801-555-1234"
   - Date of Birth: "1990-01-15"
3. Select commercial payer
4. Enter insurance details:
   - Member ID: "ABC123456"
   - Group Number: "GRP789"
5. Add contact person:
   - Name: "John Manager"
   - Email: "john.manager@example.com"
   - Phone: "801-555-5678"
6. Select provider and time slot
7. Complete booking

**Expected Results:**
- ✅ DB appointment created with patient_id
- ✅ IntakeQ client created with:
  - Normalized phone: (801) 555-1234
  - Normalized DOB: 1990-01-15
  - Insurance company name from mapping
  - Member ID: ABC123456
- ✅ IntakeQ appointment created
- ✅ General questionnaire sent to patient
- ✅ Contact mirror email sent to john.manager@example.com
- ✅ Emergency contact added to IntakeQ client
- ✅ Pinned note in IntakeQ about case manager
- ✅ Audit trail shows all operations

**SQL Verification:**
```sql
-- Check appointment
SELECT * FROM appointments WHERE patient_id = (
    SELECT id FROM patients WHERE email = 'jane.smith@example.com'
) ORDER BY created_at DESC LIMIT 1;

-- Check audit trail
SELECT * FROM intakeq_sync_audit
WHERE patient_id = (
    SELECT id FROM patients WHERE email = 'jane.smith@example.com'
) ORDER BY created_at DESC;
```

### 2. Medicaid Flow

**Setup:**
- Patient: Existing patient
- Payer: Medicaid plan

**Steps:**
1. Book with existing patient email
2. Select Medicaid payer
3. Complete booking

**Expected Results:**
- ✅ Existing IntakeQ client updated (not duplicated)
- ✅ Medicaid questionnaire sent (not general)
- ✅ Audit shows questionnaire type: "medicaid"

**SQL Verification:**
```sql
-- Check questionnaire type
SELECT
    payload->>'questionnaireName' as questionnaire_type,
    status
FROM intakeq_sync_audit
WHERE action = 'send_questionnaire'
ORDER BY created_at DESC LIMIT 1;
```

### 3. Duplicate Detection

**Setup:**
- Patient: Same name + DOB as existing, different email

**Steps:**
1. Book with:
   - Name: "Jane Smith" (existing)
   - DOB: "1990-01-15" (existing)
   - Email: "jane.smith.alt@example.com" (new)
2. Complete booking

**Expected Results:**
- ✅ Booking succeeds (not blocked)
- ✅ Existing IntakeQ client updated (not duplicated)
- ⚠️ Email sent to miriam@trymoonlit.com about possible duplicate
- ✅ Audit shows status: "duplicate_detected"

### 4. IntakeQ Failure Handling

**Setup:**
- Temporarily break IntakeQ API key

**Steps:**
1. Set invalid INTAKEQ_API_KEY
2. Attempt booking

**Expected Results:**
- ✅ DB appointment still created
- ✅ User sees success with warning
- ⚠️ Urgent email to miriam@trymoonlit.com
- ✅ Audit shows failure with error details
- ✅ Notes field indicates sync pending

### 5. Double-Click Prevention

**Steps:**
1. Open booking form
2. Fill all details
3. Double-click submit button rapidly

**Expected Results:**
- ✅ Only one appointment created
- ✅ Button disabled after first click
- ✅ Loading spinner shown
- ✅ Second request returns cached response

### 6. Insurance Mapping

**Setup:**
- Add mapping in payer_external_mappings:
```sql
INSERT INTO payer_external_mappings (payer_id, system, key_name, value)
VALUES (
    (SELECT id FROM payers WHERE name = 'Aetna'),
    'practiceq',
    'insurance_company_name',
    'Aetna Health Insurance'
);
```

**Steps:**
1. Book with Aetna as payer

**Expected Results:**
- ✅ IntakeQ client shows "Aetna Health Insurance" not "Aetna"
- ✅ Audit shows enrichment applied

### 7. Email Aliasing - Unique Email (Case A)

**Setup:**
- Patient: New patient with unique email
- Feature flag: `PRACTICEQ_ALIAS_EMAILS_FOR_DUPLICATES=true`

**Steps:**
1. Book with new patient details:
   - First Name: "Alice"
   - Last Name: "Johnson"
   - Email: "alice.johnson@example.com" (unique, never used before)
   - Phone: "801-555-1111"
   - Date of Birth: "1985-05-20"
2. Complete booking

**Expected Results:**
- ✅ IntakeQ client created with canonical email: "alice.johnson@example.com"
- ✅ `patients.intakeq_email_alias` remains NULL
- ✅ Audit trail shows:
  - `_aliasApplied: false`
  - `_aliasReason: null`
  - `emailAliasing.aliasApplied: false`
- ✅ Patient receives questionnaire at canonical email

**SQL Verification:**
```sql
-- Check patient record
SELECT email, intakeq_email_alias, intakeq_client_id
FROM patients
WHERE email = 'alice.johnson@example.com';
-- Expected: email = 'alice.johnson@example.com', intakeq_email_alias = NULL

-- Check audit trail
SELECT
    enrichment_data->'emailAliasing'->>'aliasApplied' as alias_applied,
    enrichment_data->'emailAliasing'->>'aliasReason' as alias_reason
FROM intakeq_sync_audit
WHERE action = 'create_client'
  AND patient_id = (SELECT id FROM patients WHERE email = 'alice.johnson@example.com')
ORDER BY created_at DESC LIMIT 1;
-- Expected: alias_applied = 'false', alias_reason = null
```

### 8. Email Aliasing - Shared Email, Two Patients (Case B)

**Setup:**
- Patient 1: Already exists with "casemanager@agency.com"
- Patient 2: New patient, same email, different DOB
- Feature flag: `PRACTICEQ_ALIAS_EMAILS_FOR_DUPLICATES=true`

**Steps:**
1. Book Patient 1 first (if not exists):
   - First Name: "Bob"
   - Last Name: "Williams"
   - Email: "casemanager@agency.com"
   - DOB: "1980-03-15"

2. Book Patient 2 with same email:
   - First Name: "Carol"
   - Last Name: "Davis"
   - Email: "casemanager@agency.com" (same as Patient 1)
   - DOB: "1992-07-22" (different DOB)

**Expected Results:**
- ✅ Patient 1: IntakeQ uses canonical email "casemanager@agency.com"
  - `patients.intakeq_email_alias` = NULL

- ✅ Patient 2: IntakeQ uses alias "casemanager+mlt-abc1234@agency.com"
  - Alias is deterministic based on patient UUID
  - `patients.intakeq_email_alias` = "casemanager+mlt-abc1234@agency.com"
  - Audit shows:
    - `_aliasApplied: true`
    - `_aliasReason: 'duplicate_in_db'`

- ✅ Two distinct IntakeQ clients created
- ✅ Both patients receive emails at "casemanager@agency.com" (alias routes to same inbox)
- ✅ Contact mirror emails still go to real case manager email

**SQL Verification:**
```sql
-- Check both patient records
SELECT
    first_name,
    last_name,
    email,
    intakeq_email_alias,
    intakeq_client_id
FROM patients
WHERE email = 'casemanager@agency.com'
ORDER BY created_at;

-- Expected output:
-- Bob     | Williams | casemanager@agency.com | NULL                                      | {intakeq_id_1}
-- Carol   | Davis    | casemanager@agency.com | casemanager+mlt-abc1234@agency.com       | {intakeq_id_2}

-- Check IntakeQ clients have different emails
-- (Manual check in IntakeQ dashboard or via API)
```

### 9. Email Aliasing - Repeat Sync for Same Patient (Case C)

**Setup:**
- Patient 2 from Case B already has an alias stored
- Trigger another IntakeQ sync operation (e.g., update insurance)

**Steps:**
1. Update Patient 2's insurance information
2. Trigger client upsert (this happens during booking or manual sync)

**Expected Results:**
- ✅ Same alias reused: "casemanager+mlt-abc1234@agency.com"
- ✅ No new IntakeQ client created
- ✅ Existing IntakeQ client updated
- ✅ `patients.intakeq_email_alias` unchanged
- ✅ Logs show "Reusing existing IntakeQ email alias"

**SQL Verification:**
```sql
-- Verify alias hasn't changed
SELECT intakeq_email_alias, updated_at
FROM patients
WHERE first_name = 'Carol' AND last_name = 'Davis';

-- Check audit trail shows alias reuse
SELECT
    action,
    enrichment_data->'emailAliasing'->>'aliasApplied' as alias_applied,
    created_at
FROM intakeq_sync_audit
WHERE patient_id = (
    SELECT id FROM patients WHERE first_name = 'Carol' AND last_name = 'Davis'
)
ORDER BY created_at DESC
LIMIT 2;
```

### 10. Email Aliasing - Contact Mirror Still Works (Case D)

**Setup:**
- Use Patient 2 from Case B (has email alias)
- Add contact/case manager

**Steps:**
1. Book appointment for Patient 2 with contact:
   - Contact Name: "Sarah Manager"
   - Contact Email: "sarah.manager@agency.com"
   - Contact Phone: "801-555-9999"

**Expected Results:**
- ✅ Patient 2's IntakeQ client uses alias email
- ✅ Contact mirror email sent to "sarah.manager@agency.com" (not the alias)
- ✅ Audit shows `action: 'mirror_contact_email'`
- ✅ Case manager receives all appointment notifications at real email

**SQL Verification:**
```sql
-- Check contact mirror was sent
SELECT
    created_at,
    status,
    payload->>'contactEmail' as contact_email,
    appointment_id
FROM intakeq_sync_audit
WHERE action = 'mirror_contact_email'
  AND patient_id = (
      SELECT id FROM patients WHERE first_name = 'Carol' AND last_name = 'Davis'
  )
ORDER BY created_at DESC LIMIT 1;

-- Expected: contact_email = 'sarah.manager@agency.com' (not aliased)
```

### 11. Email Aliasing - Feature Flag Disabled

**Setup:**
- Set `PRACTICEQ_ALIAS_EMAILS_FOR_DUPLICATES=false`
- Attempt to book with duplicate email

**Steps:**
1. Disable feature flag
2. Attempt to book Patient 3 with "casemanager@agency.com"

**Expected Results:**
- ✅ System attempts to use canonical email
- ⚠️ IntakeQ may reject due to unique constraint (expected behavior)
- ✅ Warning logged: "Email conflict detected but aliasing disabled"
- ✅ No alias stored in database
- ✅ Audit shows `_aliasApplied: false`

**SQL Verification:**
```sql
-- Check that no new aliases were created
SELECT COUNT(*) as alias_count
FROM patients
WHERE intakeq_email_alias IS NOT NULL;

-- Count should be same as before test
```

## API Testing

### Test V2 Booking Endpoint

```bash
# Test with curl
curl -X POST http://localhost:3000/api/patient-booking/book-v2 \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: test-$(date +%s)" \
  -d '{
    "patient": {
      "firstName": "Test",
      "lastName": "User",
      "email": "test@example.com",
      "phone": "8015551234",
      "dateOfBirth": "1990-01-01"
    },
    "contact": {
      "name": "Case Manager",
      "email": "manager@example.com",
      "phone": "8015555678"
    },
    "providerId": "provider-uuid",
    "payerId": "payer-uuid",
    "memberId": "MEM123",
    "groupNumber": "GRP456",
    "start": "2025-10-15T14:00:00Z",
    "locationType": "telehealth",
    "notes": "V2.0 test booking"
  }'
```

## Monitoring Queries

### Check Today's Bookings
```sql
-- Run v2-sql-shortcuts.sql query #1
```

### Check Enrichment Status
```sql
-- Run v2-sql-shortcuts.sql query #4
```

### Check Failed Syncs
```sql
-- Run v2-sql-shortcuts.sql query #6
```

## Rollback Plan

If issues arise:

1. **Disable enrichment:**
```bash
PRACTICEQ_ENRICH_ENABLED=false
```

2. **Revert to original booking endpoint:**
   - Change `/book-v2` references back to `/book`

3. **Clear stuck idempotency:**
```sql
DELETE FROM idempotency_requests WHERE created_at < NOW() - INTERVAL '1 hour';
```

## Success Metrics

- [ ] 100% of bookings create DB appointments
- [ ] >95% of bookings sync to IntakeQ successfully
- [ ] 100% of patients receive questionnaire links
- [ ] 100% of contacts receive mirror emails
- [ ] <5% duplicate client creation rate
- [ ] <2s average booking completion time

## Sign-off Checklist

- [ ] All test scenarios pass
- [ ] No console errors during booking
- [ ] Email notifications working
- [ ] IntakeQ clients have enriched data
- [ ] Audit trail complete for all operations
- [ ] SQL shortcuts return expected data
- [ ] Feature flags properly control behavior
- [ ] Contact mirroring works as expected
- [ ] Questionnaire routing (general vs Medicaid) correct
- [ ] Duplicate detection sends alerts
- [ ] Email aliasing works for duplicate emails (Case A-D)
- [ ] Aliases are deterministic and stable across syncs
- [ ] Contact mirror emails use canonical addresses (not aliases)
- [ ] Audit trail tracks aliasing status correctly

## Notes

- Monitor `intakeq_sync_audit` table for the first 24 hours
- Check email logs for any failed notifications
- Verify IntakeQ dashboard shows all appointments
- Confirm patients receive questionnaires within 5 minutes