# V2.0 Deployment & Testing Guide

## Pre-Deployment Checklist

### 1. Database Migration
```bash
# Run the new migration
psql $DATABASE_URL < database-migrations/011-v2-add-questionnaire-action.sql

# Verify the constraint was updated
psql $DATABASE_URL -c "
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'intakeq_sync_audit'::regclass
AND conname = 'valid_action';
"
```

Expected output should include: `send_questionnaire`, `mirror_contact_email`, `telehealth_fallback`, `email_failed`

### 2. Environment Variables

Add to `.env.local`:
```bash
# V2.0 Feature Flags
NEXT_PUBLIC_USE_V2_BOOKING=true
PRACTICEQ_ENRICH_ENABLED=true
PRACTICEQ_DUPLICATE_ALERTS_ENABLED=true
PRACTICEQ_SEND_QUESTIONNAIRE_ON_CREATE=true

# Existing flags (verify these are set)
INTAKE_HIDE_NON_INTAKE_PROVIDERS=true
INTEGRATIONS_DEBUG_HTTP=true
```

### 3. Insurance Mappings

Add mappings for your payers:
```sql
-- Example: Map Aetna to IntakeQ insurance name
INSERT INTO payer_external_mappings (payer_id, system, key_name, value, created_by)
SELECT
  id,
  'practiceq',
  'insurance_company_name',
  'Aetna Health Insurance',
  'admin'
FROM payers
WHERE name = 'Aetna'
ON CONFLICT (payer_id, system, key_name) DO UPDATE
SET value = EXCLUDED.value;

-- Mark Medicaid payers for correct questionnaire routing
INSERT INTO payer_external_mappings (payer_id, system, key_name, value, created_by)
SELECT
  id,
  'practiceq',
  'questionnaire_type',
  'medicaid',
  'admin'
FROM payers
WHERE name ILIKE '%medicaid%' OR name ILIKE '%ahcccs%'
ON CONFLICT (payer_id, system, key_name) DO UPDATE
SET value = EXCLUDED.value;
```

## Testing Procedure

### Test 1: Basic Booking Flow

1. **Navigate to booking widget:**
   ```
   http://localhost:3000/book
   ```

2. **Open browser DevTools → Network tab**

3. **Complete booking with:**
   - New patient email: `test1@example.com`
   - DOB: `1990-01-01`
   - Phone: `(801) 555-1234`
   - Commercial insurance (e.g., Aetna)
   - Member ID: `TEST123`

4. **Verify the request:**
   - Should POST to `/api/patient-booking/book-v2`
   - Check request payload includes `patient`, `memberId`, `payerId`
   - Look for `Idempotency-Key` header

5. **Expected Response:**
```json
{
  "success": true,
  "data": {
    "appointmentId": "uuid",
    "pqAppointmentId": "intakeq-id",
    "status": "scheduled",
    "enrichment": {
      "clientId": "intakeq-client-id",
      "enrichedFields": ["phone", "dob", "insurance"],
      "questionnaireSent": true,
      "contactNotified": false
    }
  }
}
```

### Test 2: Verify Database Records

```sql
-- Get the latest appointment
SELECT
  a.id,
  a.patient_id,
  a.pq_appointment_id,
  p.email,
  p.phone,
  p.date_of_birth,
  p.intakeq_client_id
FROM appointments a
JOIN patients p ON p.id = a.patient_id
ORDER BY a.created_at DESC
LIMIT 1;
```

**Expected:**
- ✅ `patient_id` is set
- ✅ `pq_appointment_id` is populated
- ✅ `patients` table has email, phone, DOB
- ✅ `intakeq_client_id` is set

### Test 3: Verify Audit Trail

```sql
-- Check audit trail for the latest appointment
WITH latest_appt AS (
  SELECT id FROM appointments ORDER BY created_at DESC LIMIT 1
)
SELECT
  created_at,
  action,
  status,
  intakeq_client_id,
  intakeq_appointment_id,
  enrichment_data->>'enrichedFields' as enriched_fields,
  CASE
    WHEN payload IS NOT NULL THEN 'redacted'
    ELSE 'none'
  END as payload_status
FROM intakeq_sync_audit
WHERE appointment_id = (SELECT id FROM latest_appt)
ORDER BY created_at;
```

**Expected sequence:**
1. `create_client` → success
2. `create_appointment` → success
3. `send_questionnaire` → success
4. (Optional) `mirror_contact_email` → success

**Check redaction:**
```sql
-- Verify PHI is redacted
SELECT
  payload->>'firstName' as first_name_redacted,
  payload->>'email' as email_redacted,
  payload->>'phone' as phone_redacted
FROM intakeq_sync_audit
WHERE action = 'create_client'
ORDER BY created_at DESC
LIMIT 1;
```

Should show: `T***t`, `t***m`, `(***4` (first and last char preserved)

### Test 4: Contact Mirroring

1. **Book with contact info:**
   - Patient: `patient@example.com`
   - Contact Name: `Case Manager`
   - Contact Email: `manager@example.com`
   - Contact Phone: `(801) 555-5678`

2. **Check console logs for:**
```
📧 V2.0: Contact mirror email sent to manager@example.com
```

3. **Verify audit:**
```sql
SELECT * FROM intakeq_sync_audit
WHERE action = 'mirror_contact_email'
ORDER BY created_at DESC
LIMIT 1;
```

4. **Check IntakeQ client record:**
   - Should have Emergency Contact fields populated
   - Should have pinned note about case manager

### Test 5: Questionnaire Routing

**Test 5a: Commercial Payer**
```sql
-- Book with commercial payer, then check:
SELECT
  response->>'questionnaireId' as questionnaire_id,
  response->>'questionnaireName' as type
FROM intakeq_sync_audit
WHERE action = 'send_questionnaire'
ORDER BY created_at DESC
LIMIT 1;
```

Expected: `67632ecd93139e4c43407617` (general)

**Test 5b: Medicaid Payer**
```sql
-- Book with Medicaid payer, then check same query
```

Expected: `6823985dba25b046d739b9c6` (medicaid)

### Test 6: Duplicate Detection

**Strong Match (should update):**
1. Book patient: `Jane Doe`, DOB: `1990-01-01`, email: `jane@example.com`
2. Book again with same name/DOB but different email: `jane.alt@example.com`
3. Expected: Updates existing IntakeQ client, no duplicate created

**Fallback Match (should create new):**
1. Book patient: `John Smith`, DOB: `1985-05-15`, phone: `8015551111`
2. Book different person: `Mary Johnson`, DOB: `1985-05-15`, phone: `8015551111`
3. Expected:
   - New IntakeQ client created
   - Email sent to `miriam@trymoonlit.com` about possible duplicate

Check logs:
```
⚠️ Found fallback matches (DOB+phone/memberId) - creating new client anyway
```

### Test 7: Idempotency

1. Open DevTools → Network tab
2. Complete a booking
3. Note the `Idempotency-Key` from request
4. Use cURL to retry with same key:

```bash
curl -X POST http://localhost:3000/api/patient-booking/book-v2 \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: [paste-key-here]" \
  -d '{...same payload...}'
```

Expected: Same `appointmentId` returned, no duplicate created

### Test 8: Payer Network Validation

Try booking with a payer NOT in `provider_payer_networks`:

```bash
curl -X POST http://localhost:3000/api/patient-booking/book-v2 \
  -H "Content-Type: application/json" \
  -d '{
    "patient": {...},
    "providerId": "valid-provider-id",
    "payerId": "invalid-payer-id",
    "start": "2025-10-15T14:00:00Z",
    "locationType": "telehealth"
  }'
```

Expected response:
```json
{
  "success": false,
  "error": "This insurance is not accepted by the selected provider",
  "code": "PAYER_NOT_IN_NETWORK"
}
```

### Test 9: IntakeQ Failure Handling

**Simulate IntakeQ failure:**
1. Temporarily set invalid `INTAKEQ_API_KEY`
2. Complete a booking
3. Expected:
   - ✅ DB appointment still created
   - ⚠️ Warning in response: `"IntakeQ sync in progress"`
   - 📧 Urgent email to Miriam
   - Audit shows `status: 'failed'`

Check:
```sql
SELECT * FROM appointments ORDER BY created_at DESC LIMIT 1;
-- pq_appointment_id should be NULL

SELECT * FROM intakeq_sync_audit
WHERE status = 'failed'
ORDER BY created_at DESC LIMIT 5;
```

## Monitoring Queries

### Today's Booking Summary
```sql
-- Run this daily
SELECT
  COUNT(*) as total_bookings,
  COUNT(pq_appointment_id) as synced_to_intakeq,
  COUNT(*) - COUNT(pq_appointment_id) as pending_sync
FROM appointments
WHERE (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Denver')::date = CURRENT_DATE;
```

### Enrichment Success Rate
```sql
SELECT
  DATE(created_at) as date,
  COUNT(*) FILTER (WHERE action = 'create_client' AND status = 'success') as successful_clients,
  COUNT(*) FILTER (WHERE action = 'create_client' AND status = 'failed') as failed_clients,
  COUNT(*) FILTER (WHERE action = 'send_questionnaire' AND status = 'success') as questionnaires_sent,
  COUNT(*) FILTER (WHERE action = 'mirror_contact_email') as contacts_notified
FROM intakeq_sync_audit
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### Failed Syncs (Action Required)
```sql
SELECT
  a.id,
  a.start_time,
  p.email as patient_email,
  isa.action,
  isa.error,
  isa.created_at
FROM intakeq_sync_audit isa
JOIN appointments a ON a.id = isa.appointment_id
JOIN patients p ON p.id = a.patient_id
WHERE isa.status = 'failed'
  AND isa.created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
ORDER BY isa.created_at DESC;
```

## Rollback Procedure

If issues arise:

1. **Disable V2 booking:**
```bash
# In .env.local
NEXT_PUBLIC_USE_V2_BOOKING=false
```

2. **Disable enrichment:**
```bash
PRACTICEQ_ENRICH_ENABLED=false
```

3. **Clear stuck idempotency requests:**
```sql
DELETE FROM idempotency_requests
WHERE created_at < NOW() - INTERVAL '1 hour';
```

4. **Restart server:**
```bash
npm run dev
```

## Success Criteria

- [ ] All bookings create DB appointments (patient_id set)
- [ ] >95% of bookings sync to IntakeQ (pq_appointment_id populated)
- [ ] 100% of questionnaires sent (check audit)
- [ ] Contact emails sent when contact provided
- [ ] No duplicate clients created for strong matches
- [ ] FYI emails sent for fallback matches
- [ ] PHI properly redacted in audit logs
- [ ] Idempotency working (no duplicate bookings)
- [ ] Payer validation rejecting invalid payers
- [ ] DB-first approach (appointments saved even if IntakeQ fails)

## Support

- Audit queries: See `database-migrations/v2-sql-shortcuts.sql`
- Test script: `./scripts/test-v2-booking.sh`
- Implementation details: `V2_IMPLEMENTATION_SUMMARY.md`
- Test scenarios: `V2_TEST_PLAN.md`