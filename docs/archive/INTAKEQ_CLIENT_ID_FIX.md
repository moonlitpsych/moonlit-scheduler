# IntakeQ Client ID Normalization Fix

**Date:** October 7, 2025
**Issue:** Persistent "Client not found" errors when creating IntakeQ appointments
**Root Cause:** IntakeQ client IDs stored/passed as JSON objects `{"Id":"98"}` instead of plain strings `"98"`

## Problem Summary

The IntakeQ API requires client IDs in plain numeric string format (e.g., `"98"`). However, IDs were being stored in the database and passed to the API in corrupted formats:
- JSON objects: `{"Id":"98"}`
- Stringified JSON: `'{"Id":"98"}'`
- Other malformed formats

This caused IntakeQ to reject appointment creation requests with "Client not found" errors, even when the client existed.

## Solution: Comprehensive Normalization

Following consultant (ChatGPT) recommendations, implemented a boundary pattern with normalization at all data entry/exit points.

### Files Created

#### 1. `/src/lib/intakeq/utils.ts` (NEW)
Normalization utility module with three key functions:

```typescript
/**
 * Normalizes IntakeQ client IDs from any format to plain numeric string
 * Handles: objects {Id: "98"}, stringified JSON '{"Id":"98"}', plain strings "98"
 */
export function normalizeIntakeqClientId(raw: unknown): string

/**
 * Validates that a client ID is in correct format (numeric string)
 */
export function isValidIntakeqClientId(clientId: string): boolean

/**
 * Asserts client ID is valid, throws error if not
 * Use right before IntakeQ API calls
 */
export function assertValidIntakeqClientId(clientId: string): asserts clientId is string
```

**Handles:**
- Plain strings: `"98"` → `"98"` ✅
- Objects: `{Id: "98"}` → `"98"` ✅
- Stringified JSON: `'{"Id":"98"}'` → `"98"` ✅
- Numbers: `98` → `"98"` ✅
- null/undefined → `""` ✅

#### 2. `/src/app/api/debug/fix-corrupted-client-ids/route.ts` (NEW)
Debug endpoint to scan and fix corrupted database records:

**GET** `/api/debug/fix-corrupted-client-ids`
- Scans all patient records
- Identifies corrupted vs valid client IDs
- Returns detailed report

**POST** `/api/debug/fix-corrupted-client-ids`
- Dry run mode: `{"dry_run": true}` (default)
- Live fix mode: `{"dry_run": false}`
- Normalizes all corrupted IDs in database

### Files Modified

#### 1. `/src/lib/intakeq/client.ts`
**Function:** `ensureClient()`

**Before:**
```typescript
if (patient.intakeq_client_id) {
    let clientId = patient.intakeq_client_id
    if (typeof clientId === 'object' && clientId.Id) {
        clientId = clientId.Id  // This code never deployed due to caching
    }
    return clientId
}
```

**After:**
```typescript
if (patient.intakeq_client_id) {
    // Use proper normalization to handle malformed formats
    const clientId = normalizeIntakeqClientId(patient.intakeq_client_id)

    // Validate it's in correct format (numeric string)
    if (clientId && isValidIntakeqClientId(clientId)) {
        console.log(`✅ Patient ${patientId} already has IntakeQ client ID: ${clientId} (normalized from ${typeof patient.intakeq_client_id})`)
        return clientId
    } else {
        console.warn(`⚠️ Patient ${patientId} has malformed IntakeQ client ID: ${JSON.stringify(patient.intakeq_client_id)}, normalized to: "${clientId}" - will recreate`)
        // Fall through to create new client
    }
}
```

**Impact:** Reads from database are now normalized at the boundary.

#### 2. `/src/lib/services/intakeQService.ts`
**Function:** `createAppointmentWithClient()`

**Before:**
```typescript
async createAppointmentWithClient(appointmentData: {
    clientId: string
    // ...
}): Promise<string> {
    console.log('📅 Creating IntakeQ appointment with existing client...')

    try {
        const appointmentPayload: IntakeQAppointment = {
            ClientId: appointmentData.clientId,  // Malformed ID passed directly
            // ...
        }
        // ...
    }
}
```

**After:**
```typescript
async createAppointmentWithClient(appointmentData: {
    clientId: string
    // ...
}): Promise<string> {
    console.log('📅 Creating IntakeQ appointment with existing client...')

    try {
        // CRITICAL: Validate client ID format before API call
        assertValidIntakeqClientId(appointmentData.clientId)
        console.log(`✅ IntakeQ ClientId validation passed: "${appointmentData.clientId}" (type: ${typeof appointmentData.clientId})`)

        const appointmentPayload: IntakeQAppointment = {
            ClientId: appointmentData.clientId,  // Now guaranteed to be valid
            // ...
        }
        // ...
    }
}
```

**Impact:**
- Validates format before every IntakeQ API call
- Fails fast with clear error message if malformed ID slips through
- Logs validated ID for debugging

## Testing Plan

### 1. Scan for Corrupted Records
```bash
curl http://localhost:3000/api/debug/fix-corrupted-client-ids
```

Expected output:
```json
{
  "success": true,
  "summary": {
    "total_patients": 5,
    "corrupted_count": 2,
    "valid_count": 3
  },
  "corrupted": [
    {
      "patient_id": "e46dcc43-7093-4cdb-b04a-ed0a3bd290b6",
      "name": "Test Patient",
      "current_value": {"Id": "98"},
      "current_type": "object",
      "normalized_value": "98",
      "is_valid": true
    }
  ]
}
```

### 2. Fix Corrupted Records (Dry Run)
```bash
curl -X POST http://localhost:3000/api/debug/fix-corrupted-client-ids \
  -H "Content-Type: application/json" \
  -d '{"dry_run": true}'
```

### 3. Fix Corrupted Records (Live)
```bash
curl -X POST http://localhost:3000/api/debug/fix-corrupted-client-ids \
  -H "Content-Type: application/json" \
  -d '{"dry_run": false}'
```

### 4. Test Booking Flow
- Try booking with previously failing patient
- Check server logs for:
  - `✅ Patient X already has IntakeQ client ID: 98 (normalized from object)`
  - `✅ IntakeQ ClientId validation passed: "98" (type: string)`
- Verify appointment creates successfully

## Expected Behavior

### Reading from Database
```typescript
// Database has: {"Id":"98"}
const clientId = normalizeIntakeqClientId(patient.intakeq_client_id)
// clientId = "98" ✅
```

### Before IntakeQ API Call
```typescript
// Receives: "98"
assertValidIntakeqClientId("98")  // Passes ✅

// Receives: {"Id":"98"}
assertValidIntakeqClientId({"Id":"98"})  // Throws error ❌
// Error: Invalid IntakeQ client ID format: "[object Object]". Expected numeric string (e.g., "98")
```

### API Call Payload
```json
{
  "ClientId": "98",  // Always plain string
  "PractitionerId": "...",
  "ServiceId": "...",
  ...
}
```

## What This Fixes

1. ✅ **"Client not found" errors** - Normalized IDs are now sent in correct format
2. ✅ **Database corruption** - Can clean up existing bad data
3. ✅ **Future corruption** - Normalization at boundaries prevents new bad data
4. ✅ **Debugging** - Enhanced logging shows exactly what's being sent to IntakeQ
5. ✅ **Fail fast** - Validation catches problems before API calls

## What Was Wrong Before

1. ❌ **Incomplete fix** - Previous extraction logic (`if (typeof clientId === 'object' && clientId.Id)`) never deployed due to Next.js caching
2. ❌ **Single point fix** - Only tried to fix at one location, not all boundaries
3. ❌ **No validation** - No assertion before API calls to catch errors early
4. ❌ **No logging** - Couldn't see what was being sent to IntakeQ
5. ❌ **No cleanup** - Corrupted database records remained

## Acceptance Criteria

- [x] Create normalization utility module
- [x] Apply normalization in `ensureClient()` read path
- [x] Apply validation before IntakeQ API calls
- [x] Add detailed logging
- [ ] Run database cleanup to fix corrupted records
- [ ] Test booking with previously failing patient
- [ ] Verify no more "Client not found" errors

## Next Steps

1. **Scan database** - Run GET endpoint to see how many records are corrupted
2. **Fix database** - Run POST endpoint with `dry_run: false` to normalize all IDs
3. **Test booking** - Try creating appointment with previously failing patient
4. **Monitor logs** - Watch for validation messages confirming normalized IDs
5. **Clean up dev servers** - Multiple dev servers are running, clean up old ones

## Files Summary

**Created:**
- `src/lib/intakeq/utils.ts` - Normalization utilities
- `src/app/api/debug/fix-corrupted-client-ids/route.ts` - Database cleanup endpoint

**Modified:**
- `src/lib/intakeq/client.ts` - Apply normalization on read
- `src/lib/services/intakeQService.ts` - Validate before API call

**Documentation:**
- `INTAKEQ_CLIENT_ID_FIX.md` - This file
