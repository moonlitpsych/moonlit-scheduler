# IntakeQ Automation - Complete Integration

## ✅ What's Now Working

Your custom booking flow now triggers **all the same automations** as IntakeQ's native booking:

### 1. ✅ Appointment Creation in IntakeQ
- Creates appointment with correct Service ID, Location ID, Practitioner ID
- Appears in IntakeQ Team Calendar
- Generates Google Meet link automatically

### 2. ✅ Patient Confirmation Email (via IntakeQ)
- IntakeQ sends automatic confirmation with:
  - Appointment date/time
  - Google Meet video call link
  - Provider information
  - Instructions to join

### 3. ✅ Pre-Visit Intake Questionnaire (NEW!)
- Automatically sent to patient email after booking
- Uses Questionnaire ID: `687ad30e356f38c6e4b11e62`
- IntakeQ handles the delivery and tracking

### 4. ✅ Admin Notification Email (via your emailService)
- Sent to admin/staff about new booking
- Includes all appointment details
- Uses your existing Resend email setup

### 5. ✅ Provider Reminders (via IntakeQ)
- IntakeQ handles automatic provider reminders
- No additional code needed

## Code Changes Made

### 1. Added `sendQuestionnaire()` method to IntakeQService
**File:** `src/lib/services/intakeQService.ts`

```typescript
async sendQuestionnaire(params: {
  questionnaireId: string
  clientName: string
  clientEmail: string
  practitionerId?: string
  clientPhone?: string
}): Promise<{ success: boolean; message?: string }>
```

### 2. Updated Appointment Creation Flow
**File:** `src/app/api/patient-booking/create-appointment-v2/route.ts`

Now includes:
- **STEP 4**: Create appointment in IntakeQ
- **STEP 5**: Send intake questionnaire to patient
- **STEP 6**: Send admin notification email

All steps are non-blocking - if one fails, the others still execute.

## Testing the Complete Flow

### Expected Sequence When Patient Books:

1. **Patient completes booking** on your website
2. **Appointment created** in Supabase database
3. **Appointment synced** to IntakeQ
4. **IntakeQ sends** confirmation email with Google Meet link
5. **IntakeQ sends** pre-visit intake questionnaire
6. **Your system sends** admin notification email
7. **IntakeQ handles** all future reminders

### Verify It's Working:

After a test booking, check:

| What to Check | Where | Expected Result |
|---------------|-------|-----------------|
| Appointment in database | Supabase `appointments` table | ✅ Row exists |
| Appointment in EMR | IntakeQ Team Calendar | ✅ Appointment visible |
| Patient confirmation | Patient's email inbox | ✅ Email from IntakeQ with Meet link |
| Intake questionnaire | Patient's email inbox | ✅ Email from IntakeQ with form link |
| Admin notification | Admin email inbox | ✅ Email from Moonlit about new booking |

## Configuration

### Questionnaire ID
- **Current**: `687ad30e356f38c6e4b11e62` (hardcoded)
- **To change**: Update in `create-appointment-v2/route.ts` line 287

### Admin Email Recipients
- **Configured in**: `src/lib/services/emailService.ts`
- Uses your existing `sendAdminNotification()` method

## Error Handling

All automation steps are **non-fatal**:
- If IntakeQ appointment creation fails → Patient still gets Supabase appointment
- If questionnaire send fails → Appointment still created, logged as warning
- If admin email fails → Appointment still created, logged as warning

This ensures **maximum reliability** - the booking always succeeds even if downstream automations fail.

## Logs to Watch

When a booking completes successfully, you should see:

```
✅ V2 - Appointment created in Supabase: [uuid]
📤 V2 - Creating in IntakeQ...
✅ V2 - IntakeQ appointment created: [intakeq_id]
📋 Sending intake questionnaire 687ad30e356f38c6e4b11e62 to patient@email.com...
✅ Intake questionnaire sent successfully to patient@email.com
📧 Sending appointment notifications...
✅ Admin notification sent successfully
```

## Future Enhancements

### Possible Additions:
1. **SMS reminders** - Use IntakeQ's SMS feature (requires phone in ClientPhone field)
2. **Custom questionnaires per provider** - Store questionnaire_id in `provider_intakeq_settings`
3. **Follow-up questionnaires** - Send different forms based on appointment type
4. **Patient confirmation via your system** - Send backup confirmation from Resend

## Architecture Benefits

✅ **Separation of concerns** - IntakeQ handles EMR, your system handles booking logic
✅ **Reliability** - Non-blocking steps ensure bookings always succeed
✅ **Flexibility** - Easy to add more automation steps without breaking existing flow
✅ **Monitoring** - Clear logs show exactly what happened at each step

---

**Status**: ✅ Production-ready
**Last Updated**: October 4, 2025
**Tested**: Successfully sends questionnaire + admin notifications
