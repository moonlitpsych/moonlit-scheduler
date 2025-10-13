#!/bin/bash

# V2.0 Booking Test Script
# Tests all V2 features including enrichment, questionnaire, and contact mirroring

echo "🚀 V2.0 Booking System Test"
echo "=========================="

# Configuration
BASE_URL="http://localhost:3000"
ENDPOINT="/api/patient-booking/book-v2"

# Generate unique test data
TIMESTAMP=$(date +%s)
EMAIL="test${TIMESTAMP}@example.com"
IDEMPOTENCY_KEY="test-${TIMESTAMP}"

# Test data
read -r -d '' BOOKING_JSON << EOF
{
  "patient": {
    "firstName": "Test",
    "lastName": "User${TIMESTAMP}",
    "email": "${EMAIL}",
    "phone": "8015551234",
    "dateOfBirth": "1990-01-01"
  },
  "contact": {
    "name": "Case Manager",
    "email": "manager${TIMESTAMP}@example.com",
    "phone": "8015555678"
  },
  "providerId": "$(psql $DATABASE_URL -t -c "SELECT id FROM providers WHERE is_bookable = true LIMIT 1" | xargs)",
  "payerId": "$(psql $DATABASE_URL -t -c "SELECT id FROM payers LIMIT 1" | xargs)",
  "memberId": "MEM123456",
  "groupNumber": "GRP456",
  "start": "$(date -u -v+1d +%Y-%m-%dT14:00:00Z)",
  "locationType": "telehealth",
  "notes": "V2.0 test booking - ${TIMESTAMP}"
}
EOF

echo "📝 Test Configuration:"
echo "  Email: ${EMAIL}"
echo "  Idempotency Key: ${IDEMPOTENCY_KEY}"
echo ""

# Function to make booking request
make_booking() {
  echo "📡 Making booking request..."
  RESPONSE=$(curl -s -X POST "${BASE_URL}${ENDPOINT}" \
    -H "Content-Type: application/json" \
    -H "Idempotency-Key: ${IDEMPOTENCY_KEY}" \
    -d "${BOOKING_JSON}")

  echo "Response:"
  echo "${RESPONSE}" | jq '.'

  # Extract appointment ID if successful
  APPOINTMENT_ID=$(echo "${RESPONSE}" | jq -r '.data.appointmentId // "none"')
  PQ_APPOINTMENT_ID=$(echo "${RESPONSE}" | jq -r '.data.pqAppointmentId // "none"')

  if [ "${APPOINTMENT_ID}" != "none" ]; then
    echo "✅ Booking successful!"
    echo "  Appointment ID: ${APPOINTMENT_ID}"
    echo "  PQ Appointment ID: ${PQ_APPOINTMENT_ID}"
  else
    echo "❌ Booking failed"
    exit 1
  fi
}

# Test 1: Initial booking
echo ""
echo "Test 1: Initial Booking"
echo "-----------------------"
make_booking

# Test 2: Idempotency check (should return same response)
echo ""
echo "Test 2: Idempotency Check"
echo "-------------------------"
echo "📡 Making duplicate request with same idempotency key..."
RESPONSE2=$(curl -s -X POST "${BASE_URL}${ENDPOINT}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: ${IDEMPOTENCY_KEY}" \
  -d "${BOOKING_JSON}")

APPOINTMENT_ID2=$(echo "${RESPONSE2}" | jq -r '.data.appointmentId // "none"')
if [ "${APPOINTMENT_ID}" == "${APPOINTMENT_ID2}" ]; then
  echo "✅ Idempotency working - returned cached response"
else
  echo "❌ Idempotency failed - got different appointment ID"
fi

# Test 3: Check database records
echo ""
echo "Test 3: Database Verification"
echo "-----------------------------"

echo "Checking appointments table..."
psql $DATABASE_URL -c "
SELECT
  id,
  patient_id,
  pq_appointment_id,
  (start_time AT TIME ZONE 'UTC' AT TIME ZONE 'America/Denver')::timestamp as start_local,
  status
FROM appointments
WHERE id = '${APPOINTMENT_ID}';"

echo ""
echo "Checking patients table..."
psql $DATABASE_URL -c "
SELECT
  id,
  first_name || ' ' || last_name as name,
  email,
  phone,
  date_of_birth,
  intakeq_client_id
FROM patients
WHERE email = '${EMAIL}';"

echo ""
echo "Checking audit trail..."
psql $DATABASE_URL -c "
SELECT
  action,
  status,
  intakeq_client_id,
  intakeq_appointment_id,
  LEFT(COALESCE(error, ''), 50) as error_short,
  created_at
FROM intakeq_sync_audit
WHERE appointment_id = '${APPOINTMENT_ID}'
ORDER BY created_at;"

# Test 4: Check for questionnaire send
echo ""
echo "Test 4: Questionnaire Verification"
echo "----------------------------------"
psql $DATABASE_URL -c "
SELECT
  action,
  status,
  payload->>'questionnaireName' as questionnaire_type,
  response->>'questionnaireId' as questionnaire_id
FROM intakeq_sync_audit
WHERE appointment_id = '${APPOINTMENT_ID}'
  AND action = 'send_questionnaire';"

# Test 5: Check for contact mirror
echo ""
echo "Test 5: Contact Mirror Verification"
echo "-----------------------------------"
psql $DATABASE_URL -c "
SELECT
  action,
  status,
  payload->>'contactEmail' as contact_email
FROM intakeq_sync_audit
WHERE appointment_id = '${APPOINTMENT_ID}'
  AND action = 'mirror_contact_email';"

echo ""
echo "✅ V2.0 Booking Test Complete!"
echo ""
echo "Summary:"
echo "- Appointment created: ${APPOINTMENT_ID}"
echo "- IntakeQ synced: ${PQ_APPOINTMENT_ID}"
echo "- Patient email: ${EMAIL}"
echo "- Check audit trail for full details"