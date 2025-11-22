# IntakeQ API Endpoint Fix Required

## ✅ STATUS: ALL CRITICAL ISSUES FIXED (Nov 21, 2024)

## Problem (RESOLVED)
The code was using `/clients/{id}` endpoint which **DOES NOT EXIST** in IntakeQ API.

IntakeQ only supports:
- `/clients` - List all clients (with optional PUT for updates)
- `/clients?search={query}` - Search by name, email, or ID

## Files Fixed

### 1. `src/lib/intakeq/client.ts` ✅ FIXED
- Line 133: Using search endpoint for client verification

### 2. `src/lib/services/intakeqClientUpsert.ts` ✅ ALL FIXED
Multiple occurrences:

**Line 327** - `updateClient()`: ✅ FIXED
- Removed GET request
- Now sends partial update to `/clients` with Id in body
- Uses spread operator to merge updates: `{ Id: clientId, ...updates }`

**Line 506-534** - Duplicate detection verify: ✅ FIXED
- Removed all verification GET calls
- Relies on successful creation/update response
- No longer attempts to re-fetch client data

**Line 708** - DOB retry: ✅ FIXED (WAS BLOCKING ALL BOOKINGS)
- Removed GET request
- Uses `newClientData` object directly for retry
- No longer causes "Client created but not available" errors

**Line 354** - `createPinnedNote()`: ⚠️ WARNING ADDED
- Uses `/clients/${clientId}/notes` endpoint
- May not work since parent resource endpoint doesn't exist
- Already has error handling (non-critical)
- Added warning comment for future reference

### 3. `src/lib/services/intakeQService.ts` ✅ ALL FIXED

**Line 291** - `getClient()` method: ✅ DEPRECATED
- Added `@deprecated` JSDoc tag
- Throws error with helpful message
- Directs developers to use search endpoint instead

**Line 496** - `updateClientInsurance()`: ✅ FIXED
- Changed from `/clients/${clientId}` to `/clients`
- Now includes `Id` field in request body
- Matches pattern used in other PUT operations

## Summary of Changes

**Total fixes applied:** 6 critical + 1 deprecated + 1 warning

**Pattern established for IntakeQ client updates:**
```typescript
// ✅ CORRECT PATTERN for updating clients
await intakeQService.makeRequest('/clients', {
  method: 'PUT',
  body: JSON.stringify({
    Id: clientId,
    ...fieldsToUpdate
  })
})

// ❌ NEVER USE
await intakeQService.makeRequest(`/clients/${clientId}`, ...)
```

## Testing Results ✅ VERIFIED (Nov 21, 2024)

**Test booking completed successfully:**
1. ✅ All code changes completed
2. ✅ End-to-end booking flow tested and working
3. ✅ IntakeQ client creation verified (Client ID: 198)
4. ✅ IntakeQ appointment creation verified (Appointment ID: 6920eed4d81ae85462145975)
5. ✅ Emails sent successfully (patient + admin notifications)
6. ✅ Database appointments table updated with IntakeQ IDs

**Final Fix Applied (Nov 21, 2024):**
- Changed all PUT methods to POST for client updates
- IntakeQ `/clients` endpoint only supports GET and POST (not PUT)
- DOB retry now uses POST ✅
- updateClient function now uses POST ✅
- updateClientInsurance now uses POST ✅

## Impact Resolution

- ✅ **RESOLVED**: Bookings no longer blocked
- ✅ **RESOLVED**: "Client created but not available" error eliminated
- ✅ **RESOLVED**: All IntakeQ API calls use correct endpoints
- ✅ **RESOLVED**: All IntakeQ updates use POST instead of PUT
- ✅ **VERIFIED**: Production booking flow working end-to-end
