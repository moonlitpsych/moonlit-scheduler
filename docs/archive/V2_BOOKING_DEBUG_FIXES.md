# V2.0 Booking Debug Fixes - Session Summary

## Problem Statement
POST `/api/patient-booking/book-v2` was returning 400 errors with `PAYER_NOT_IN_NETWORK`, and `intakeq_sync_audit` showed `create_appointment` failures with null payload/response.

## Root Causes Identified

### 1. **Wrong Network Check Query**
- **Issue**: book-v2 was checking `provider_payer_networks` directly
- **Problem**: This table doesn't include supervision logic or bookability rules
- **Fix**: Changed to use `v_bookable_provider_payer` canonical view

### 2. **Missing Columns Referenced**
- **`provider_payer_networks.network_status`**: Column doesn't exist ✅ FIXED
- **`services.service_type`**: Column doesn't exist ✅ FIXED

## Changes Made

### ✅ 1. Fixed Network Check (book-v2/route.ts)

**Before:**
```typescript
const { data: networkCheck } = await supabaseAdmin
  .from('provider_payer_networks')
  .select('id, network_status')  // ❌ Wrong table, wrong column
  .eq('provider_id', body.providerId)
  .eq('payer_id', body.payerId)
```

**After:**
```typescript
const { data: networkCheck } = await supabaseAdmin
  .from('v_bookable_provider_payer')  // ✅ Canonical view with supervision logic
  .select('provider_id, payer_id, relationship_type')
  .eq('provider_id', body.providerId)
  .eq('payer_id', body.payerId)
```

### ✅ 2. Added Bypass Flag for Dev/Test

**New Feature Flag:** `PRACTICEQ_BYPASS_NETWORK_CHECK`
- **Default**: `false` (strict checking in production)
- **Purpose**: Allow dev/test bookings without complete provider-payer mappings
- **Behavior**: When `true` and no mapping found:
  - Logs warning
  - Creates audit entry with `status='bypassed'`
  - Continues with booking instead of returning 400

**Added to:**
- `src/lib/config/featureFlags.ts`
- Usage in `book-v2/route.ts` with full audit logging

### ✅ 3. Enhanced Network Check Logging

Now logs:
- Provider ID, Payer ID in all cases
- Whether bypass is enabled
- Relationship type (direct, supervised, etc.)
- Success/failure/bypass status to `intakeq_sync_audit`

### ✅ 4. Improved Error Responses

**PAYER_NOT_IN_NETWORK now includes:**
```json
{
  "code": "PAYER_NOT_IN_NETWORK",
  "details": {
    "providerId": "...",
    "payerId": "...",
    "hint": "Check v_bookable_provider_payer view for valid combinations"
  }
}
```

### ✅ 5. Created Network Check SQL Script

**Location:** `scripts/dev-network-check.sql`

**Features:**
- Shows provider_payer_networks schema
- Checks specific provider-payer combination
- Seeds dev mapping if missing
- Queries v_bookable_provider_payer view
- Lists all mappings for a provider

## Still TODO (In Progress)

### 3. Enhance create_appointment Failure Logging
- [ ] Add rich payload logging (patientId, providerId, payerId, intakeqClientId, etc.)
- [ ] Include sanitized response and error details
- [ ] Add enrichmentData.meta with identityMatch and bypass status

### 4. Add Prerequisite Validation
- [ ] Verify intakeqClientId exists before createAppointment call
- [ ] Verify practitionerExternalId resolves
- [ ] Verify serviceId resolves
- [ ] Verify start time format
- [ ] Return specific error codes (MISSING_PRACTITIONER_MAPPING, etc.)

### 5. Verify Payer Persistence & Questionnaire Routing
- [ ] Confirm primary_payer_id is set on first creation
- [ ] Verify PrimaryInsuranceCompanyName sent to IntakeQ
- [ ] Verify Medicaid vs non-Medicaid questionnaire routing

### 6. Create Verification Helper Scripts
- [ ] Update debug-booking-failure.sql with appointment joins
- [ ] Enhance audit-by-appointment.sql with payload snippets

### 7. DX Improvements
- [ ] Log exact IDs received in booking request
- [ ] Return details in all error responses

### 8. Update .env.local
- [ ] Add PRACTICEQ_BYPASS_NETWORK_CHECK=true for dev

## How to Test

1. **Add flag to .env.local:**
   ```bash
   PRACTICEQ_BYPASS_NETWORK_CHECK=true
   ```

2. **Restart dev server** (already running with cleared cache)

3. **Try booking again** - should bypass network check and proceed

4. **Check audit logs:**
   ```sql
   SELECT action, status, payload, enrichment_data
   FROM intakeq_sync_audit
   WHERE created_at > NOW() - INTERVAL '5 minutes'
   ORDER BY created_at DESC;
   ```

## Next Steps

Once bypass is enabled, we'll see if IntakeQ appointment creation fails for different reasons (missing practitioner mapping, service mapping, etc.). The enhanced logging will make it clear what's missing.
