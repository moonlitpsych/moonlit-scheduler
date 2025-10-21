# Book-V2 Endpoint Improvements

## Problem Analysis

### What Went Wrong with Charles Haynes Booking

**Timeline:**
1. **Oct 16**: Booking partially succeeded
   - ✅ Patient record created
   - ✅ Appointment record created
   - ❌ IntakeQ sync failed (no `pq_appointment_id`)
   - Patient never received confirmation email

2. **Oct 18 (Friday)**: Complete booking failure
   - ❌ Error occurred (unknown where)
   - No database records created
   - User saw error message

3. **Oct 20 (Sunday)**: Partial booking failure
   - ✅ Patient record created (duplicate!)
   - ❌ No appointment created
   - Error occurred AFTER patient creation but BEFORE appointment insert

### Root Causes

1. **Orphaned Patient Records**: If any step fails after patient creation, patient record is left without an appointment

2. **Silent IntakeQ Failures**: Appointments marked as "scheduled" even when IntakeQ sync fails

3. **Insufficient Error Logging**: Can't debug Friday's error because we don't know which step failed

4. **No Rollback Mechanism**: Failed bookings leave partial data in database

## Proposed Improvements

### 1. Add Request Tracking ID

```typescript
// Generate unique request ID for tracking
const requestId = crypto.randomUUID()
console.log(`[${requestId}] Starting booking request`)
```

Benefits:
- Can trace entire request flow through logs
- Easier to debug production issues
- Can correlate frontend and backend logs

### 2. Wrap Each Step with Detailed Error Logging

```typescript
try {
  console.log(`[${requestId}] STEP 1: Patient resolution starting...`)
  resolvedPatientId = await ensurePatient(...)
  console.log(`[${requestId}] STEP 1: ✅ Patient resolved: ${resolvedPatientId}`)
} catch (error) {
  console.error(`[${requestId}] STEP 1: ❌ FAILED`, {
    error: error.message,
    stack: error.stack,
    input: { patientId, patientEmail: patient?.email }
  })
  throw error // Re-throw with context
}
```

Benefits:
- Know exactly which step failed
- Full error context for debugging
- Can track progress through the flow

### 3. Add Rollback for Orphaned Patient Records

```typescript
let createdPatientId: string | null = null

try {
  // ... booking flow ...

  if (patientCreated) {
    createdPatientId = resolvedPatientId
  }

  // ... rest of booking ...

} catch (error) {
  // If we created a patient but booking failed, clean up
  if (createdPatientId && !appointmentCreated) {
    console.log(`[${requestId}] Rolling back: Deleting orphaned patient ${createdPatientId}`)
    await supabaseAdmin
      .from('patients')
      .delete()
      .eq('id', createdPatientId)
  }
  throw error
}
```

Benefits:
- No more orphaned patient records
- Database stays clean
- Can retry booking without duplicates

### 4. Separate IntakeQ Sync Status

Instead of marking appointment as "scheduled" when IntakeQ fails, use a more accurate status:

```typescript
const appointmentStatus = pqAppointmentId ? 'scheduled' : 'pending_sync'

await supabaseAdmin
  .from('appointments')
  .insert({
    ...
    status: appointmentStatus,
    sync_status: pqAppointmentId ? 'synced' : 'pending'
  })
```

Benefits:
- Clear distinction between database record and IntakeQ sync
- Can identify appointments needing retry
- More accurate status reporting

### 5. Add Retry Mechanism for IntakeQ Sync

```typescript
// If IntakeQ sync fails, queue for retry
if (!pqAppointmentId) {
  await supabaseAdmin
    .from('sync_retry_queue')
    .insert({
      appointment_id: appointmentId,
      retry_count: 0,
      next_retry_at: new Date(Date.now() + 60000), // Retry in 1 minute
      error_message: intakeqError?.message
    })
}
```

Benefits:
- Automatic retry for transient failures
- Don't lose bookings due to temporary IntakeQ issues
- Can monitor retry success rates

### 6. Return Detailed Error Responses

```typescript
return NextResponse.json({
  success: false,
  code: 'PATIENT_CREATION_FAILED',
  message: 'Failed to create patient record',
  debug: {
    requestId,
    step: 'patient_resolution',
    timestamp: new Date().toISOString(),
    error: error.message
  }
}, { status: 500 })
```

Benefits:
- Frontend can show better error messages
- Can track error patterns
- Easier debugging with requestId

## Implementation Priority

1. **HIGH**: Add request tracking ID and step-by-step logging
2. **HIGH**: Add rollback mechanism for orphaned patients
3. **MEDIUM**: Separate IntakeQ sync status from appointment status
4. **MEDIUM**: Add detailed error responses
5. **LOW**: Add retry queue (requires new table)

## Testing Plan

1. Test happy path (everything succeeds)
2. Test patient creation failure
3. Test service instance resolution failure
4. Test conflict detection (slot taken)
5. Test payer lookup failure
6. Test appointment insert failure
7. Test IntakeQ sync failure
8. Test duplicate patient prevention

## Migration Needed

```sql
-- Add sync_status column to appointments
ALTER TABLE appointments
ADD COLUMN sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed'));

-- Add retry queue table (optional, for future)
CREATE TABLE sync_retry_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  next_retry_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Success Metrics

- Zero orphaned patient records
- 100% error traceability (know which step failed)
- < 5% IntakeQ sync failures
- All sync failures automatically retried
- Clear error messages to users
