# IntakeQ Field Sync Fix Plan
Generated: October 13, 2025

## Executive Summary
Your recent booking test shows that while the alias system works (✅), DOB and insurance fields are not syncing to IntakeQ (❌). The logs reveal a critical API error where PUT requests return HTML instead of JSON.

## Issues Identified

### 1. DOB Not Syncing
**Root Cause**: IntakeQ API PUT request is failing with HTML response
```
❌ DOB retry failed: SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
```
This happens when trying to update DOB after client creation.

### 2. Insurance Fields Empty
**Root Cause**: No insurance mapping in `payer_external_mappings` table
- The system looks for mappings with `system = 'practiceq'`
- Falls back to raw payer name if no mapping exists
- Your IntakeQ shows insurers like "Molina Healthcare of Utah" but we need exact mappings

### 3. API Endpoint Issue
The PUT request to `/clients/${intakeqClientId}` is returning HTML (likely a 404 or auth error page)

## Immediate Actions

### Step 1: Fix IntakeQ API PUT Request
The issue is that we're using the wrong endpoint format for updates.

```typescript
// Current (WRONG):
await intakeQService.makeRequest(`/clients/${intakeqClientId}`, {
  method: 'PUT',
  body: JSON.stringify({ Id: intakeqClientId, DateOfBirth: dob })
})

// Correct (based on IntakeQ docs):
// IntakeQ uses PATCH for partial updates, not PUT
await intakeQService.makeRequest(`/clients`, {
  method: 'PUT',
  body: JSON.stringify({
    Id: intakeqClientId,  // Must include ID in body
    DateOfBirth: dob,
    // Include all other existing fields to avoid overwriting
  })
})
```

### Step 2: Populate Insurance Mappings

Create mappings between your payer IDs and IntakeQ insurance names:

```sql
-- First, check what payer was used in the test booking
SELECT p.id, p.name, a.insurance_info
FROM appointments a
JOIN payers p ON p.id = (a.insurance_info->>'payer_id')::uuid
WHERE a.created_at > NOW() - INTERVAL '1 hour'
ORDER BY a.created_at DESC
LIMIT 1;

-- Insert mappings for common insurers (adjust IDs based on your database)
INSERT INTO payer_external_mappings (payer_id, system, key_name, value)
VALUES
  -- Replace with actual payer IDs from your database
  ('YOUR_MOLINA_ID', 'practiceq', 'insurance_company_name', 'Molina Healthcare of Utah'),
  ('YOUR_MEDICAID_UT_ID', 'practiceq', 'insurance_company_name', 'Medicaid Utah'),
  ('YOUR_AETNA_ID', 'practiceq', 'insurance_company_name', 'Aetna Health, Inc.'),
  ('YOUR_FIRST_HEALTH_ID', 'practiceq', 'insurance_company_name', 'First Health Network'),
  ('YOUR_HEALTH_CHOICE_ID', 'practiceq', 'insurance_company_name', 'Health Choice of Utah')
ON CONFLICT (payer_id, system, key_name) DO UPDATE
SET value = EXCLUDED.value;
```

### Step 3: Test with Realistic Data

Use the debug endpoint with a valid client ID from your test:

```bash
# Get the IntakeQ client ID from your recent test
# Look for "Miriamtesttesttestteste TestesttSweeney" in IntakeQ

# Test fetching the client
curl http://localhost:3000/api/debug/test-intakeq-fields?clientId=YOUR_CLIENT_ID

# Test updating DOB with a realistic date
curl -X POST http://localhost:3000/api/debug/test-intakeq-fields \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "YOUR_CLIENT_ID",
    "field": "DateOfBirth",
    "value": "1990-01-15"
  }'
```

## Code Fixes Required

### Fix 1: Update IntakeQ Client Update Logic

**File**: `src/lib/services/intakeqClientUpsert.ts`

Replace the update logic to handle IntakeQ's API correctly:

```typescript
// Line ~490-500 - Fix the DOB retry logic
if (!verifyResponse.DateOfBirth) {
  console.warn(`⚠️ IntakeQ response missing DOB after update, retrying...`)

  // Fetch full client first to preserve all fields
  const fullClient = await intakeQService.makeRequest<IntakeQClientSearchResult>(
    `/clients/${primaryClient.Id}`,
    { method: 'GET' }
  )

  // Update with all fields to avoid data loss
  await intakeQService.makeRequest(`/clients`, {
    method: 'PUT',
    body: JSON.stringify({
      ...fullClient,
      Id: primaryClient.Id,
      DateOfBirth: normalizedDob
    })
  })
}
```

### Fix 2: Ensure Insurance Fields Are Sent

The insurance fields need to use the exact field names IntakeQ expects:

**IntakeQ Field Names** (based on their UI):
- `PrimaryInsuranceName` → Might need to be `InsuranceCompanyName`
- `PrimaryMemberID` → Might need to be `MemberID`
- `PrimaryGroupNumber` → Might need to be `GroupNumber`

Test which field names work:

```bash
# Test different field names
curl -X POST http://localhost:3000/api/debug/test-intakeq-fields \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "YOUR_CLIENT_ID",
    "field": "InsuranceCompanyName",
    "value": "Molina Healthcare of Utah"
  }'
```

## Long-term Solution

### 1. Create IntakeQ Field Mapper

Create a service that maps our field names to IntakeQ's expected names:

```typescript
const INTAKEQ_FIELD_MAP = {
  // Our field -> IntakeQ field
  'PrimaryInsuranceName': 'InsuranceCompanyName',
  'PrimaryMemberID': 'MemberID',
  'PrimaryGroupNumber': 'GroupNumber',
  'DateOfBirth': 'DateOfBirth' // Verify format: YYYY-MM-DD or MM/DD/YYYY
}
```

### 2. Implement Robust Update Strategy

Instead of partial updates, always:
1. GET the full client
2. Merge new fields
3. PUT the complete client object

### 3. Add Validation Layer

Before sending to IntakeQ:
- Validate date formats
- Ensure insurance names match IntakeQ's list exactly
- Log full request/response for debugging

## Testing Strategy

1. **Manual Testing**:
   - Use IntakeQ UI to manually set fields
   - Use debug endpoint to fetch and see exact field names/formats

2. **Automated Testing**:
   - Create test suite that verifies each field syncs
   - Test with various date formats
   - Test with each insurance provider

## Next Steps

1. **Immediate** (Today):
   - [ ] Fix the PUT request issue
   - [ ] Add insurance mappings to database
   - [ ] Test with realistic DOB (not 1897)

2. **Tomorrow**:
   - [ ] Verify field names match IntakeQ's API
   - [ ] Implement full client update strategy
   - [ ] Add comprehensive logging

3. **This Week**:
   - [ ] Create automated tests
   - [ ] Document IntakeQ field requirements
   - [ ] Set up monitoring for sync failures

## Success Criteria

After implementing these fixes:
- ✅ DOB appears in IntakeQ for new bookings
- ✅ Insurance company name populates correctly
- ✅ Member ID and Group Number sync
- ✅ No HTML errors in API responses
- ✅ All fields visible in IntakeQ client profile

## Support Resources

- IntakeQ API Docs: https://intakeq.com/api
- Test your fixes: Use client ID from "Miriamtesttesttestteste TestesttSweeney"
- Debug endpoints: `/api/debug/test-intakeq-fields` and `/api/debug/test-intakeq-sync`