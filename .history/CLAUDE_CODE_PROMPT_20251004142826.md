# Claude Code Task: Fix IntakeQ Appointment Integration

## 🎯 OBJECTIVE
Fix the booking system so that appointments are created in IntakeQ (EMR) when patients book appointments. Currently, appointments save to the local database but DO NOT sync to IntakeQ because the EMR integration code is stubbed out.

## 📍 PROBLEM LOCATION
File: `src/app/api/patient-booking/create-appointment/route.ts`

The `enqueueCreateInEMR` function (around line 48) has comments instead of actual IntakeQ API calls:
```typescript
// Here you would call intakeQService or athenaService
// await emrService.createAppointment(...)
```

## ✅ SOLUTION STEPS

### Step 1: Add IntakeQ Service Import
At the top of `src/app/api/patient-booking/create-appointment/route.ts`, after the existing imports (around line 7), add:

```typescript
import { intakeQService } from '@/lib/services/intakeQService'
```

### Step 2: Replace enqueueCreateInEMR Function
Find the `enqueueCreateInEMR` function (starts around line 48) and replace it entirely with this complete implementation:

```typescript
// Background EMR creation (fire-and-forget)
async function enqueueCreateInEMR(params: { 
  appointmentId: string
  providerId: string
  start: string
  end: string
  patientFirstName: string
  patientLastName: string
  patientEmail: string
  patientPhone: string
  patientDateOfBirth?: string
}): Promise<void> {
  console.log('📤 BOOKING DEBUG - EMR creation enqueued:', {
    appointmentId: params.appointmentId,
    providerId: params.providerId,
    start: params.start
  });
  
  // Run async EMR creation without blocking the response
  setTimeout(async () => {
    try {
      console.log('🚀 BOOKING DEBUG - EMR background job started for:', params.appointmentId);
      
      // Step 1: Get provider details (including IntakeQ practitioner ID)
      const { data: provider, error: providerError } = await supabase
        .from('providers')
        .select('id, first_name, last_name, intakeq_practitioner_id, intakeq_service_id, intakeq_location_id')
        .eq('id', params.providerId)
        .single();

      if (providerError || !provider) {
        throw new Error(`Provider not found: ${providerError?.message}`);
      }

      if (!provider.intakeq_practitioner_id) {
        console.log('⚠️ Provider has no IntakeQ practitioner ID, skipping EMR creation');
        return;
      }

      console.log('👨‍⚕️ Provider found:', {
        name: `${provider.first_name} ${provider.last_name}`,
        intakeq_id: provider.intakeq_practitioner_id
      });

      // Step 2: Create appointment in IntakeQ
      const intakeQAppointmentId = await intakeQService.createAppointment({
        practitionerId: provider.intakeq_practitioner_id,
        clientFirstName: params.patientFirstName,
        clientLastName: params.patientLastName,
        clientEmail: params.patientEmail,
        clientPhone: params.patientPhone,
        clientDateOfBirth: params.patientDateOfBirth,
        serviceId: provider.intakeq_service_id || '01JDQR0MT6MGADAMR7N8XHGZQ1', // Fallback if not set
        locationId: provider.intakeq_location_id || '1', // Fallback if not set
        dateTime: new Date(params.start),
        status: 'Confirmed',
        sendEmailNotification: true
      });

      console.log('✅ IntakeQ appointment created:', intakeQAppointmentId);

      // Step 3: Update database with IntakeQ appointment ID
      const { error: updateError } = await supabase
        .from('appointments')
        .update({ 
          emr_appointment_id: intakeQAppointmentId,
          emr_system: 'intakeq',
          updated_at: new Date().toISOString()
        })
        .eq('id', params.appointmentId);

      if (updateError) {
        console.error('❌ Failed to update appointment with IntakeQ ID:', updateError);
      } else {
        console.log('✅ Database updated with IntakeQ appointment ID');
      }

    } catch (error: any) {
      console.error('❌ BOOKING DEBUG - EMR background job failed:', {
        error: error.message,
        stack: error.stack,
        appointmentId: params.appointmentId
      });
      
      // Update appointment to note EMR creation failed
      await supabase
        .from('appointments')
        .update({
          notes: `EMR creation failed: ${error.message}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', params.appointmentId);
    }
  }, 100);
}
```

### Step 3: Update the Function Call
Find where `enqueueCreateInEMR` is called in the POST function (should be after the database insert, around line 200). The current call looks like:

```typescript
enqueueCreateInEMR({
  appointmentId: appointment.id,
  providerId: providerId,
  start: start!
})
```

Replace it with this expanded version that passes all necessary patient data:

```typescript
// Queue EMR creation in background (if not a test)
if (createInEMR && !isTest) {
  enqueueCreateInEMR({
    appointmentId: appointment.id,
    providerId,
    start: start!,
    end: end!,
    patientFirstName: patient.firstName,
    patientLastName: patient.lastName,
    patientEmail: patient.email,
    patientPhone: patient.phone,
    patientDateOfBirth: patient.dateOfBirth
  }).catch(error => 
    console.error('BOOKING DEBUG - EMR enqueue failed:', error)
  );
}
```

### Step 4: Add Database Columns for IntakeQ Settings
Create a new migration file: `migrations/add_intakeq_service_location_columns.sql`

```sql
-- Add IntakeQ configuration columns to providers table
-- Migration: add_intakeq_service_location_columns
-- Date: 2025-10-04

-- Add the columns
ALTER TABLE providers 
ADD COLUMN IF NOT EXISTS intakeq_service_id TEXT,
ADD COLUMN IF NOT EXISTS intakeq_location_id TEXT;

-- Add comments for documentation
COMMENT ON COLUMN providers.intakeq_service_id IS 'Default IntakeQ service ID for this provider appointments';
COMMENT ON COLUMN providers.intakeq_location_id IS 'Default IntakeQ location ID for this provider';

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_providers_intakeq_service_id ON providers(intakeq_service_id);
CREATE INDEX IF NOT EXISTS idx_providers_intakeq_location_id ON providers(intakeq_location_id);

-- Update providers with default values (using fallback values from code)
-- User should update these with actual IntakeQ IDs later
UPDATE providers 
SET 
  intakeq_service_id = '01JDQR0MT6MGADAMR7N8XHGZQ1',  -- Default service ID
  intakeq_location_id = '1'                           -- Default location ID
WHERE intakeq_practitioner_id IS NOT NULL;

-- Verify the updates
SELECT 
    id,
    first_name,
    last_name,
    intakeq_practitioner_id,
    intakeq_service_id,
    intakeq_location_id,
    CASE 
        WHEN intakeq_practitioner_id IS NOT NULL 
             AND intakeq_service_id IS NOT NULL 
             AND intakeq_location_id IS NOT NULL 
        THEN '✅ Fully Configured'
        WHEN intakeq_practitioner_id IS NOT NULL 
        THEN '⚠️ Missing Service/Location IDs'
        ELSE '❌ Not Integrated'
    END as intakeq_status
FROM providers
ORDER BY last_name, first_name;
```

### Step 5: Create Helper Script for Getting IntakeQ IDs
Create a new file: `scripts/get-intakeq-settings.ts`

```typescript
// Script to fetch IntakeQ settings (Services, Locations, Practitioners)
// Run with: npx ts-node scripts/get-intakeq-settings.ts

import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const INTAKEQ_API_KEY = process.env.INTAKEQ_API_KEY
const BASE_URL = 'https://intakeq.com/api/v1'

async function fetchIntakeQSettings() {
  if (!INTAKEQ_API_KEY) {
    console.error('❌ INTAKEQ_API_KEY not found in .env.local')
    console.log('\n💡 Add your IntakeQ API key to .env.local:')
    console.log('   INTAKEQ_API_KEY=your_api_key_here')
    process.exit(1)
  }

  console.log('✅ API Key found, fetching settings from IntakeQ...\n')

  try {
    const response = await fetch(`${BASE_URL}/appointments/settings`, {
      headers: {
        'X-Auth-Key': INTAKEQ_API_KEY,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()

    console.log('📍 LOCATIONS:')
    console.log('═'.repeat(70))
    if (data.Locations && data.Locations.length > 0) {
      data.Locations.forEach((loc: any) => {
        console.log(`\n  ID: ${loc.Id}`)
        console.log(`  Name: ${loc.Name}`)
        console.log(`  Address: ${loc.Address || 'N/A'}`)
      })
    } else {
      console.log('  No locations found')
    }

    console.log('\n\n🔧 SERVICES:')
    console.log('═'.repeat(70))
    if (data.Services && data.Services.length > 0) {
      data.Services.forEach((svc: any) => {
        console.log(`\n  ID: ${svc.Id}`)
        console.log(`  Name: ${svc.Name}`)
        console.log(`  Duration: ${svc.Duration} minutes`)
        console.log(`  Price: $${svc.Price}`)
      })
    } else {
      console.log('  No services found')
    }

    console.log('\n\n👥 PRACTITIONERS:')
    console.log('═'.repeat(70))
    if (data.Practitioners && data.Practitioners.length > 0) {
      data.Practitioners.forEach((prac: any) => {
        console.log(`\n  ID: ${prac.Id}`)
        console.log(`  Name: ${prac.CompleteName}`)
        console.log(`  Email: ${prac.Email}`)
      })
    } else {
      console.log('  No practitioners found')
    }

    console.log('\n\n' + '═'.repeat(70))
    console.log('📋 NEXT STEPS:')
    console.log('═'.repeat(70))
    console.log('1. Copy the Location ID (usually "1" for main office)')
    console.log('2. Copy the Service ID for your default appointment type')
    console.log('3. Run the migration: migrations/add_intakeq_service_location_columns.sql')
    console.log('4. Update the default values in the migration with your IDs')
    console.log('5. Test the booking flow!')
    console.log('═'.repeat(70) + '\n')

  } catch (error: any) {
    console.error('❌ Error fetching settings:', error.message)
    if (error.message.includes('401') || error.message.includes('403')) {
      console.log('\n💡 Your API key may be invalid. Check:')
      console.log('   1. IntakeQ > Settings > Integrations > Developer API')
      console.log('   2. Verify the API key is enabled')
      console.log('   3. Copy the key exactly (no extra spaces)')
    }
    process.exit(1)
  }
}

fetchIntakeQSettings()
```

## 🧪 TESTING INSTRUCTIONS

After making these changes, test locally:

1. **Start the dev server:**
   ```bash
   npm run dev
   ```

2. **Complete a test booking:**
   - Go to http://localhost:3000/book
   - Select insurance
   - Choose a provider and time slot
   - Complete the booking flow

3. **Watch for these logs in your terminal:**
   ```
   📤 BOOKING DEBUG - EMR creation enqueued
   🚀 BOOKING DEBUG - EMR background job started for: [id]
   👨‍⚕️ Provider found: { name: '...', intakeq_id: '...' }
   📝 Creating IntakeQ client...
   ✅ IntakeQ client created: [ClientId]
   📅 Creating IntakeQ appointment...
   ✅ IntakeQ appointment created: [AppointmentId]
   ✅ Database updated with IntakeQ appointment ID
   ```

4. **Verify in IntakeQ dashboard:**
   - Log in to https://intakeq.com
   - Go to Appointments
   - Find your test appointment

## ⚠️ IMPORTANT NOTES

1. **Environment Variable:** Make sure `INTAKEQ_API_KEY` is set in `.env.local`

2. **Database Requirements:** Providers must have `intakeq_practitioner_id` populated. Check with:
   ```sql
   SELECT id, first_name, last_name, intakeq_practitioner_id 
   FROM providers 
   WHERE intakeq_practitioner_id IS NOT NULL;
   ```

3. **Default IDs:** The code uses fallback IDs:
   - Service ID: `'01JDQR0MT6MGADAMR7N8XHGZQ1'`
   - Location ID: `'1'`
   
   These should work, but user can customize by:
   - Running `npx ts-node scripts/get-intakeq-settings.ts`
   - Updating the migration with actual IDs
   - Running the migration in Supabase

4. **Error Handling:** If IntakeQ creation fails, the appointment still saves locally with an error note. This is intentional - we don't want to block bookings if IntakeQ is down.

## 📋 CHECKLIST

Complete these tasks in order:

- [ ] Add import statement for intakeQService
- [ ] Replace enqueueCreateInEMR function with full implementation
- [ ] Update the function call to pass patient data
- [ ] Create migration file for database columns
- [ ] Create get-intakeq-settings.ts helper script
- [ ] Test locally - verify logs show IntakeQ appointment creation
- [ ] Verify appointment appears in IntakeQ dashboard
- [ ] Update CLAUDE.md or HANDOFF.md with notes about this fix

## 💾 FILES TO MODIFY/CREATE

1. **Modify:** `src/app/api/patient-booking/create-appointment/route.ts`
   - Add import
   - Replace function
   - Update function call

2. **Create:** `migrations/add_intakeq_service_location_columns.sql`
   - Add database columns
   - Set default values

3. **Create:** `scripts/get-intakeq-settings.ts`
   - Helper to fetch IntakeQ configuration

4. **Update:** `CLAUDE.md` or `HANDOFF.md`
   - Document this fix for future reference

## 🎯 SUCCESS CRITERIA

✅ Code compiles without errors
✅ Booking flow completes successfully
✅ Terminal shows IntakeQ appointment creation logs
✅ Appointment appears in IntakeQ dashboard
✅ Database has emr_appointment_id populated
✅ No errors in browser console

## 🚨 IF SOMETHING FAILS

Common issues and solutions:

1. **"Provider not found"** - Check intakeq_practitioner_id exists in providers table
2. **"Invalid API key"** - Verify INTAKEQ_API_KEY in .env.local
3. **"ServiceId required"** - Run get-intakeq-settings.ts and update defaults
4. **TypeScript errors** - Make sure all imports are correct

Let me know if you encounter any issues!