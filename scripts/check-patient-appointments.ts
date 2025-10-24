import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!
const intakeqApiKey = process.env.INTAKEQ_API_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkPatientAppointments() {
  console.log('🔍 Checking patient appointments and IntakeQ data...\n')

  const patientId = 'e404eb7a-c17c-44c8-8ebf-e23bdc87b39b'

  // Get appointments for this patient
  const { data: appointments, error: apptsError } = await supabase
    .from('appointments')
    .select('*')
    .eq('patient_id', patientId)
    .order('start_time', { ascending: false })

  if (apptsError) {
    console.error('❌ Error fetching appointments:', apptsError)
    return
  }

  console.log(`📅 Found ${appointments?.length || 0} appointments for this patient\n`)

  if (!appointments || appointments.length === 0) {
    console.log('No appointments found')
    return
  }

  // Show appointment details
  for (const appt of appointments) {
    console.log('─'.repeat(60))
    console.log('📍 Appointment:', appt.id)
    console.log('   Start Time:', appt.start_time)
    console.log('   Status:', appt.status)
    console.log('   PracticeQ Appointment ID:', appt.pq_appointment_id || 'None')
    console.log('   Provider ID:', appt.provider_id || 'None')

    // If we have a PracticeQ appointment ID, fetch details from IntakeQ
    if (appt.pq_appointment_id) {
      console.log('\n   🔍 Fetching from IntakeQ API...')

      try {
        const response = await fetch(
          `https://intakeq.com/api/v1/appointments/${appt.pq_appointment_id}`,
          {
            method: 'GET',
            headers: {
              'X-Auth-Key': intakeqApiKey,
              'Content-Type': 'application/json'
            }
          }
        )

        if (response.ok) {
          const intakeqAppt = await response.json()
          console.log('   ✅ IntakeQ Appointment Data:')
          console.log('      Client ID:', intakeqAppt.ClientId)
          console.log('      Client Name:', intakeqAppt.ClientName)
          console.log('      Status:', intakeqAppt.Status)
          console.log('      Practitioner:', intakeqAppt.PractitionerName)

          // Now fetch client data with this Client ID
          if (intakeqAppt.ClientId) {
            console.log('\n   📋 Fetching client profile from IntakeQ...')

            const clientResponse = await fetch(
              `https://intakeq.com/api/v1/clients/${intakeqAppt.ClientId}`,
              {
                method: 'GET',
                headers: {
                  'X-Auth-Key': intakeqApiKey,
                  'Content-Type': 'application/json'
                }
              }
            )

            if (clientResponse.ok) {
              const clientData = await clientResponse.json()
              console.log('   ✅ Client Profile Retrieved!')

              // Look for insurance fields
              const insuranceFields = Object.keys(clientData).filter(key =>
                key.toLowerCase().includes('insurance') ||
                key.toLowerCase().includes('payer') ||
                key.toLowerCase().includes('plan') ||
                key.toLowerCase().includes('carrier') ||
                key.toLowerCase().includes('member')
              )

              console.log('\n   🏥 Insurance-related fields:')
              if (insuranceFields.length > 0) {
                insuranceFields.forEach(field => {
                  console.log(`      - ${field}: ${clientData[field]}`)
                })
              } else {
                console.log('      ⚠️ No insurance fields found')
                console.log('\n   📋 All client fields:')
                Object.keys(clientData).forEach(key => {
                  console.log(`      - ${key}`)
                })
              }
            } else {
              console.log('   ❌ Failed to fetch client profile:', clientResponse.status)
            }
          }
        } else {
          console.log('   ❌ Failed to fetch appointment:', response.status)
        }
      } catch (error: any) {
        console.log('   ❌ Error:', error.message)
      }
    }
    console.log()
  }
}

checkPatientAppointments()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err)
    process.exit(1)
  })
