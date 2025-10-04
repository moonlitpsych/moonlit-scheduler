# IntakeQ Appointment Integration Fix

## 🎯 Problem
Appointments are being created in your local database but NOT in IntakeQ because the EMR integration code was stubbed out with comments instead of actual implementation.

## ✅ Solution Overview
We need to:
1. Add the actual IntakeQ service call to create appointments
2. Get your IntakeQ Service and Location IDs
3. Update your providers table with these IDs
4. Update the code to use the real IntakeQ API

---

## 📋 Step - by - Step Instructions

### Step 1: Get Your IntakeQ Settings

    ** In your terminal(not VS Code SQL editor):**

        ```bash
# Navigate to your project
cd /path/to/moonlit-scheduler

# Make sure you have the script
# (it's in the get-intakeq-settings.ts file you downloaded)

# Install dependencies if needed
npm install dotenv

# Run the script
npx ts-node get-intakeq-settings.ts
```

This will show you:
- Your Location IDs(usually "1" for main office)
    - Your Service IDs(e.g., for "Initial Consultation")
    - Your Practitioner IDs(you should already have these)

        **📝 Write down:**
            - Default Location ID: _______
                - Default Service ID for appointments: _______

---

### Step 2: Update Your Database

    ** In Supabase SQL Editor:**

        1. Go to https://supabase.com
2. Select your project
3. Click "SQL Editor" in the left sidebar
4. Click "New query"
5. Paste this SQL:

```sql
-- Add IntakeQ configuration columns
ALTER TABLE providers 
ADD COLUMN IF NOT EXISTS intakeq_service_id TEXT,
ADD COLUMN IF NOT EXISTS intakeq_location_id TEXT;

-- Add helpful comments
COMMENT ON COLUMN providers.intakeq_service_id IS 'Default IntakeQ service ID for this provider';
COMMENT ON COLUMN providers.intakeq_location_id IS 'Default IntakeQ location ID for this provider';

-- Update providers with your IDs
-- REPLACE THESE VALUES WITH YOUR ACTUAL IDs FROM STEP 1
UPDATE providers 
SET 
  intakeq_service_id = 'YOUR_SERVICE_ID_HERE',  -- e.g., '01JDQR0MT6MGADAMR7N8XHGZQ1'
  intakeq_location_id = 'YOUR_LOCATION_ID_HERE' -- e.g., '1'
WHERE intakeq_practitioner_id IS NOT NULL;

-- Verify the updates
SELECT 
    id,
    first_name,
    last_name,
    intakeq_practitioner_id,
    intakeq_service_id,
    intakeq_location_id
FROM providers
WHERE intakeq_practitioner_id IS NOT NULL;
```

6. Click "Run"(or press Cmd / Ctrl + Enter)

---

### Step 3: Update Your Code

    ** In VS Code:**

#### 3a.Open the file

Navigate to: `src/app/api/patient-booking/create-appointment/route.ts`

#### 3b.Add the import at the top

After the existing imports(around line 7), add:

```typescript
import { intakeQService } from '@/lib/services/intakeQService'
```

#### 3c.Replace the enqueueCreateInEMR function

    Find this function (around line 48) and replace it entirely with:

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
        throw new Error(`Provider not found: ${ providerError?.message } `);
      }

      if (!provider.intakeq_practitioner_id) {
        console.log('⚠️ Provider has no IntakeQ practitioner ID, skipping EMR creation');
        return;
      }

      console.log('👨‍⚕️ Provider found:', {
        name: `${ provider.first_name } ${ provider.last_name } `,
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
          notes: `EMR creation failed: ${ error.message } `,
          updated_at: new Date().toISOString()
        })
        .eq('id', params.appointmentId);
    }
  }, 100);
}
```

#### 3d.Update the function call

Find where `enqueueCreateInEMR` is called(it should be after the database insert, around line 200).Replace the call with:

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

---

### Step 4: Test Locally

    ** In your terminal:**

        ```bash
# Make sure you're in the project directory
cd /path/to/moonlit-scheduler

# Start the development server
npm run dev
```

        ** In your browser:**

            1. Go to http://localhost:3000/book
2. Complete a test booking
3. Watch your terminal for these log messages:
    ```
   📤 BOOKING DEBUG - EMR creation enqueued
   🚀 BOOKING DEBUG - EMR background job started
   👨‍⚕️ Provider found
   📝 Creating IntakeQ client...
   ✅ IntakeQ client created: [ID]
   📅 Creating IntakeQ appointment...
   ✅ IntakeQ appointment created: [ID]
   ✅ Database updated with IntakeQ appointment ID
   ```

4. Check your IntakeQ dashboard to verify the appointment was created

---

### Step 5: Check IntakeQ

    ** In IntakeQ:**

        1. Log in to https://intakeq.com
2. Go to "Appointments" in the left menu
3. You should see your test appointment!

---

### Step 6: Deploy to Production

    ** Only after confirming it works locally! **

        ```bash
# Stage your changes
git add .

# Commit with a clear message
git commit -m "Fix IntakeQ appointment creation - implement actual API calls"

# Push to main (this will auto-deploy to Vercel)
git push origin main
```

---

## 🐛 Troubleshooting

### Problem: "Provider not found"
    ** Solution:** Check that your provider has an`intakeq_practitioner_id` in the database.

```sql
SELECT id, first_name, last_name, intakeq_practitioner_id 
FROM providers 
WHERE id = 'YOUR_PROVIDER_ID';
```

### Problem: "Failed to create IntakeQ client"
    ** Solution:**
        - Check that your INTAKEQ_API_KEY is set correctly in .env.local
            - Verify the API key is valid in your IntakeQ settings

### Problem: "ServiceId is required"
    ** Solution:**
        - Run the get - intakeq - settings.ts script again
            - Copy the correct Service ID
                - Update your providers table with that ID

### Problem: Appointment created but not in IntakeQ
    ** Solution:**
        - Check your terminal logs for error messages
            - Look for "EMR background job failed" messages
                - The error details will tell you what went wrong

### Problem: "Invalid practitioner ID"
    ** Solution:**
        - Run get - intakeq - settings.ts to see your practitioners
            - Update your providers table with the correct practitioner IDs:

```sql
UPDATE providers 
SET intakeq_practitioner_id = 'CORRECT_ID_HERE'
WHERE email = 'provider@email.com';
```

---

## ✅ Success Checklist

    - [] Ran get - intakeq - settings.ts script
        - [] Got Service ID and Location ID
            - [] Updated providers table in Supabase
                - [] Added import statement to code
                    - [] Replaced enqueueCreateInEMR function
-[] Updated function call parameters
    - [] Tested locally - appointment shows in terminal logs
        - [] Verified appointment appears in IntakeQ dashboard
            - [] Committed and pushed to production

---

## 📞 Need Help ?

    If you get stuck:

1. ** Check the terminal logs ** - they're very detailed and will show you exactly what's failing
2. ** Check Supabase logs ** - Go to Supabase > Logs to see database errors
3. ** Check IntakeQ API logs ** - IntakeQ has an API log in their dashboard
4. ** Verify environment variables ** - Make sure INTAKEQ_API_KEY is in both.env.local AND Vercel

---

## 🎉 What This Fix Does

    ** Before:**
        - Appointment created in database ✅
- IntakeQ appointment created ❌ (commented out code)

** After:**
    - Appointment created in database ✅
- IntakeQ appointment created ✅ (real API call)
- Database updated with IntakeQ ID ✅
- Emails sent by IntakeQ ✅

---

    Good luck! Let me know if you hit any snags. 🚀