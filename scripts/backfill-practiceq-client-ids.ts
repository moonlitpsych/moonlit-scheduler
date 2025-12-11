/**
 * Backfill practiceq_client_id for patients who have IntakeQ appointments
 * but are missing their client ID
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!
const intakeqApiKey = process.env.INTAKEQ_API_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function fetchIntakeQAppointment(appointmentId: string): Promise<any> {
  const response = await fetch(`https://intakeq.com/api/v1/appointments/${appointmentId}`, {
    headers: {
      'X-Auth-Key': intakeqApiKey,
      'Accept': 'application/json'
    }
  })

  if (response.status === 429) {
    // Rate limited - wait and retry
    console.log('  ⏳ Rate limited, waiting 60 seconds...')
    await new Promise(r => setTimeout(r, 60000))
    return fetchIntakeQAppointment(appointmentId)
  }

  if (!response.ok) {
    throw new Error(`IntakeQ API error: ${response.status}`)
  }

  return response.json()
}

async function main() {
  console.log('🔍 Finding patients with IntakeQ appointments but missing practiceq_client_id...\n')

  // Find patients with pq_appointment_id but no practiceq_client_id
  const { data: patients, error } = await supabase
    .from('patients')
    .select(`
      id,
      first_name,
      last_name,
      email,
      practiceq_client_id,
      appointments!inner(pq_appointment_id)
    `)
    .is('practiceq_client_id', null)
    .not('appointments.pq_appointment_id', 'is', null)

  if (error) {
    console.error('Error fetching patients:', error)
    return
  }

  // Dedupe by patient ID
  const uniquePatients = new Map()
  for (const p of patients || []) {
    if (!uniquePatients.has(p.id)) {
      uniquePatients.set(p.id, {
        ...p,
        pq_appointment_id: p.appointments[0]?.pq_appointment_id
      })
    }
  }

  console.log(`Found ${uniquePatients.size} patients to backfill\n`)

  let updated = 0
  let errors = 0
  let skipped = 0

  for (const [patientId, patient] of uniquePatients) {
    // Skip test patients
    if (patient.email?.includes('@trymoonlit.com') ||
        patient.email?.includes('+test') ||
        patient.first_name?.toLowerCase().includes('test')) {
      console.log(`Skipping test patient: ${patient.first_name} ${patient.last_name}`)
      skipped++
      continue
    }

    console.log(`Processing: ${patient.first_name} ${patient.last_name} (${patient.email})`)

    try {
      // Fetch the IntakeQ appointment to get the client ID
      const appointment = await fetchIntakeQAppointment(patient.pq_appointment_id)
      const clientId = appointment.ClientId

      if (!clientId) {
        console.log(`  ⚠️ No ClientId in appointment response`)
        errors++
        continue
      }

      console.log(`  Found IntakeQ Client ID: ${clientId}`)

      // Update the patient record
      const { error: updateError } = await supabase
        .from('patients')
        .update({ practiceq_client_id: clientId })
        .eq('id', patientId)

      if (updateError) {
        console.log(`  ❌ Failed to update: ${updateError.message}`)
        errors++
        continue
      }

      console.log(`  ✅ Updated practiceq_client_id`)
      updated++

      // Rate limit - 1 second between requests to avoid 429
      await new Promise(r => setTimeout(r, 1000))

    } catch (err: any) {
      console.log(`  ❌ Error: ${err.message}`)
      errors++
    }
  }

  console.log(`\n🎉 Backfill complete!`)
  console.log(`   Updated: ${updated}`)
  console.log(`   Skipped: ${skipped}`)
  console.log(`   Errors: ${errors}`)
}

main().catch(console.error)
