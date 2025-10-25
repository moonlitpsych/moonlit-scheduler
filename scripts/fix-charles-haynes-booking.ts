import { supabaseAdmin } from '../src/lib/supabase'
import { getIntakeqPractitionerId } from '../src/lib/integrations/providerMap'
import { getIntakeqServiceId } from '../src/lib/integrations/serviceInstanceMap'
import { createAppointment } from '../src/lib/intakeq/client'
import { upsertPracticeQClient } from '../src/lib/services/intakeqClientUpsert'

async function fixCharlesHaynesBooking() {
  console.log('🔧 FIXING CHARLES HAYNES BOOKING\n')
  console.log('='.repeat(80))

  // Get the problematic appointment
  const appointmentId = '11a321c6-b385-4e50-a1d2-902724c76a40'

  const { data: appointment, error: aptError } = await supabaseAdmin
    .from('appointments')
    .select(`
      *,
      patients:patient_id (*),
      providers:provider_id (*)
    `)
    .eq('id', appointmentId)
    .single()

  if (aptError || !appointment) {
    console.error('❌ Failed to fetch appointment:', aptError)
    return
  }

  console.log('\n📋 APPOINTMENT DETAILS:\n')
  const patient = appointment.patients as any
  const provider = appointment.providers as any

  console.log(`Appointment ID: ${appointment.id}`)
  console.log(`Patient: ${patient.first_name} ${patient.last_name} (${patient.email})`)
  console.log(`Provider: ${provider.first_name} ${provider.last_name}`)
  console.log(`Start: ${appointment.start_time}`)
  console.log(`End: ${appointment.end_time}`)
  console.log(`Current PQ ID: ${appointment.pq_appointment_id || 'NOT SET'}`)
  console.log(`Service Instance: ${appointment.service_instance_id}`)

  if (appointment.pq_appointment_id) {
    console.log('\n✅ This appointment already has a PracticeQ ID. No fix needed.')
    return
  }

  console.log('\n🔄 SYNCING TO INTAKEQ...\n')

  try {
    // Step 1: Ensure IntakeQ client exists
    console.log('1️⃣ Creating/updating IntakeQ client...')

    const clientResult = await upsertPracticeQClient({
      firstName: patient.first_name,
      lastName: patient.last_name,
      email: patient.email,
      phone: patient.phone,
      dateOfBirth: patient.date_of_birth,
      payerId: appointment.payer_id,
      appointmentId: appointment.id,
      patientId: patient.id,
      identityMatch: 'strong'
    })

    console.log(`✅ IntakeQ Client ID: ${clientResult.intakeqClientId}`)

    // Step 2: Get provider and service mappings
    console.log('\n2️⃣ Getting IntakeQ mappings...')

    const practitionerId = await getIntakeqPractitionerId(appointment.provider_id)
    const serviceId = await getIntakeqServiceId(appointment.service_instance_id)

    console.log(`✅ Practitioner ID: ${practitionerId}`)
    console.log(`✅ Service ID: ${serviceId}`)

    // Step 3: Create IntakeQ appointment
    console.log('\n3️⃣ Creating IntakeQ appointment...')

    const startDate = new Date(appointment.start_time)
    const endDate = new Date(appointment.end_time)

    const apptResult = await createAppointment({
      intakeqClientId: clientResult.intakeqClientId,
      practitionerExternalId: practitionerId,
      serviceExternalId: serviceId,
      start: startDate,
      end: endDate,
      locationType: appointment.location_type || 'telehealth',
      notes: appointment.notes || `Retroactive sync for appointment ${appointment.id}`
    })

    console.log(`✅ PracticeQ Appointment ID: ${apptResult.pqAppointmentId}`)

    // Step 4: Update database
    console.log('\n4️⃣ Updating database...')

    const { error: updateError } = await supabaseAdmin
      .from('appointments')
      .update({
        pq_appointment_id: apptResult.pqAppointmentId,
        notes: (appointment.notes || '') + `\n\n[Retroactively synced to IntakeQ on ${new Date().toISOString()}]`
      })
      .eq('id', appointment.id)

    if (updateError) {
      console.error('❌ Failed to update appointment:', updateError)
      throw updateError
    }

    console.log('✅ Database updated successfully')

    console.log('\n' + '='.repeat(80))
    console.log('✅ FIX COMPLETE!')
    console.log('='.repeat(80))
    console.log(`\nAppointment ${appointment.id} is now synced to IntakeQ`)
    console.log(`PracticeQ ID: ${apptResult.pqAppointmentId}`)

  } catch (error: any) {
    console.error('\n❌ FIX FAILED:', error.message)
    console.error('Error details:', error)
    throw error
  }

  // Handle duplicate patient records
  console.log('\n\n👥 CHECKING FOR DUPLICATE PATIENT RECORDS...\n')

  const { data: duplicates, error: dupError } = await supabaseAdmin
    .from('patients')
    .select('*')
    .eq('email', patient.email)

  if (dupError) {
    console.error('❌ Failed to check for duplicates:', dupError)
  } else if (duplicates && duplicates.length > 1) {
    console.log(`⚠️ Found ${duplicates.length} patient records with email ${patient.email}:\n`)

    duplicates.forEach((dup, i) => {
      console.log(`${i + 1}. Patient ID: ${dup.id}`)
      console.log(`   Created: ${dup.created_at}`)
      console.log(`   Name: ${dup.first_name} ${dup.last_name}`)
      console.log(`   Phone: ${dup.phone}`)
      console.log(`   DOB: ${dup.date_of_birth}`)
      console.log('')
    })

    console.log('⚠️ RECOMMENDATION: Manually merge these duplicate patient records')
    console.log('   Keep the oldest record and update all appointments to reference it')
  } else {
    console.log('✅ No duplicate patient records found')
  }
}

fixCharlesHaynesBooking()
  .then(() => {
    console.log('\n✅ Script complete')
    process.exit(0)
  })
  .catch(err => {
    console.error('\n❌ Script failed:', err)
    process.exit(1)
  })
