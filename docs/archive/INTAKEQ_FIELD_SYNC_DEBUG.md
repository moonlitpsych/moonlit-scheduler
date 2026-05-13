# IntakeQ Field Sync Debug Report
Generated: October 13, 2025

## Problem Summary

Some patient data fields are not appearing in IntakeQ client profiles despite being present in our database:
- **Date of Birth (DOB)**: "1897-11-05" in DB but not showing in IntakeQ
- **Insurance fields**: Member ID and Plan Name stored in DB but sync status unknown
- **Phone**: Now working ✅ (showing as (385) 246-2522)

## Root Cause Analysis

### 1. Date of Birth Issue

**Primary Issue**: The test date "1897-11-05" (128 years ago) is likely being rejected by IntakeQ as unrealistic.

**Evidence Found**:
- Our normalization function correctly formats dates as YYYY-MM-DD
- Added warning for dates > 120 years ago or in the future
- IntakeQ may silently reject unrealistic dates without error

**Solution**: Use realistic test dates (e.g., 1990-01-01) for testing.

### 2. Insurance Field Mapping

**Current Implementation**:
- `PrimaryInsuranceName`: Maps from `payer_external_mappings` table or falls back to payer name
- `PrimaryMemberID`: Normalized to uppercase alphanumeric
- `PrimaryGroupNumber`: Passed through directly

**Potential Issues**:
- Field names might be case-sensitive in IntakeQ API
- Insurance fields may require specific formatting
- Mappings might be missing in `payer_external_mappings` table

## Changes Made

### 1. Enhanced Logging

Added detailed logging at multiple levels:

**intakeqClientUpsert.ts**:
```typescript
// Log exact payload being sent
console.log('🔍 [INTAKEQ DEBUG] Creating client with data:', JSON.stringify(newClientData, null, 2))
console.log('🔍 [INTAKEQ DEBUG] Specifically DOB:', { normalizedDob, originalDob, inPayload })

// Log insurance field details
console.log('🔍 [INSURANCE DEBUG] Insurance fields in client data:', {
  hasInsuranceName: !!insuranceCompanyName,
  insuranceName: insuranceCompanyName,
  hasMemberId: !!normalizedMemberId,
  memberId: normalizedMemberId
})
```

**intakeQService.ts**:
```typescript
// Log full API request and response
console.log('🔍 [INTAKEQ API] Request body:', JSON.stringify(clientData, null, 2))
console.log('🔍 [INTAKEQ API] Full response:', JSON.stringify(response, null, 2))
```

### 2. Date Validation Enhancement

**intakeqEnrichment.ts**:
```typescript
// Added validation for unrealistic dates
if (birthYear < (currentYear - 120) || birthYear > currentYear) {
  console.warn(`⚠️ Unrealistic date of birth (year ${birthYear}): ${dob}`)
  console.warn(`⚠️ IntakeQ may reject dates outside reasonable range`)
}
```

### 3. Debug Endpoints

Created two debug endpoints for testing:

**`/api/debug/test-intakeq-sync`**:
- Tests client creation with various date formats
- Tests field updates
- Immediately fetches created/updated clients to verify saved data

**`/api/debug/test-intakeq-fields`**:
- GET: Fetches and analyzes existing client fields
- POST: Tests updating individual fields

## Testing Instructions

### 1. Test Date of Birth Sync

```bash
# Test with realistic date
curl -X POST http://localhost:3000/api/debug/test-intakeq-sync \
  -H "Content-Type: application/json" \
  -d '{
    "testType": "create",
    "data": {
      "firstName": "Test",
      "lastName": "Patient",
      "email": "test@example.com",
      "phone": "8015551234",
      "dateOfBirth": "1990-01-01",
      "payerId": "YOUR_PAYER_ID",
      "memberId": "TEST123",
      "groupNumber": "GRP456"
    }
  }'
```

### 2. Check Existing Client

```bash
# Replace CLIENT_ID with actual IntakeQ client ID
curl http://localhost:3000/api/debug/test-intakeq-fields?clientId=CLIENT_ID
```

### 3. Test Individual Field Update

```bash
curl -X POST http://localhost:3000/api/debug/test-intakeq-fields \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "CLIENT_ID",
    "field": "DateOfBirth",
    "value": "1990-06-15"
  }'
```

## Recommended Actions

### Immediate Actions

1. **Update Test Data**: Replace "1897-11-05" with a realistic date like "1990-01-01"

2. **Verify Insurance Mappings**:
```sql
-- Check if Molina has IntakeQ mapping
SELECT * FROM payer_external_mappings
WHERE payer_id = 'YOUR_MOLINA_PAYER_ID'
AND system = 'practiceq'
AND key_name = 'insurance_company_name';
```

3. **Test with Debug Endpoints**: Use the new endpoints to test field syncing with realistic data

### Long-term Solutions

1. **Add Field Validation**: Reject unrealistic dates at input time with user-friendly error messages

2. **Implement Retry Logic**: Already partially implemented - verify DOB after creation and retry if missing

3. **Add Monitoring**: Log all IntakeQ sync failures to a dedicated audit table for analysis

4. **Create Admin Dashboard**: Build UI to view and fix IntakeQ sync issues

## Expected Behavior After Fix

When booking with realistic data:
- ✅ Phone: Should sync immediately
- ✅ DOB: Should sync with dates between 1900 and current year
- ✅ Insurance: Should sync if payer has mapping in `payer_external_mappings`
- ✅ Member ID: Should sync as uppercase alphanumeric

## Monitoring

Watch for these log messages during booking:

```
📅 Normalized DOB: 1990-01-01 → 1990-01-01
🔍 [INSURANCE DEBUG] Found mapping: Molina Healthcare
🔍 [INTAKEQ DEBUG] Creating client with data: { ... }
✅ Created new IntakeQ client: 12345
🔍 [INTAKEQ DEBUG] Client creation response: { ... }
```

If DOB is missing after creation, you'll see:
```
⚠️ IntakeQ response missing DOB, retrying with targeted update...
✅ DOB retry successful
```

## Next Steps

1. Run test bookings with realistic dates
2. Monitor logs to confirm fields are being sent
3. Use debug endpoints to verify fields are saved in IntakeQ
4. If issues persist, check IntakeQ API documentation for field requirements
5. Consider contacting IntakeQ support about date format requirements