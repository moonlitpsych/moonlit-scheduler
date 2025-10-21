import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!
const intakeqApiKey = process.env.INTAKEQ_API_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function exploreIntakeQAppointmentData() {
  console.log('🔍 Exploring full IntakeQ appointment data...\n')

  const patientId = 'e404eb7a-c17c-44c8-8ebf-e23bdc87b39b'

  // Get one recent appointment
  const { data: appointment, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('patient_id', patientId)
    .not('pq_appointment_id', 'is', null)
    .order('start_time', { ascending: false })
    .limit(1)
    .single()

  if (error || !appointment) {
    console.error('❌ Error fetching appointment:', error)
    return
  }

  console.log('📍 Appointment ID:', appointment.pq_appointment_id)
  console.log()

  try {
    const response = await fetch(
      `https://intakeq.com/api/v1/appointments/${appointment.pq_appointment_id}`,
      {
        method: 'GET',
        headers: {
          'X-Auth-Key': intakeqApiKey,
          'Content-Type': 'application/json'
        }
      }
    )

    if (!response.ok) {
      console.error('❌ API error:', response.status)
      return
    }

    const data = await response.json()

    console.log('✅ Full IntakeQ Appointment Response:')
    console.log('═'.repeat(80))
    console.log(JSON.stringify(data, null, 2))
    console.log('═'.repeat(80))
    console.log()

    // Show all top-level keys
    console.log('📋 Top-level fields in response:')
    Object.keys(data).forEach(key => {
      const value = data[key]
      const type = typeof value
      const preview = type === 'object'
        ? (Array.isArray(value) ? `Array(${value.length})` : 'Object')
        : value?.toString().substring(0, 50)

      console.log(`   ${key}: (${type}) ${preview}`)
    })

    // Look for insurance/payer related fields
    console.log('\n🏥 Looking for insurance/payer fields...')
    const insuranceRelated = Object.keys(data).filter(key =>
      key.toLowerCase().includes('insurance') ||
      key.toLowerCase().includes('payer') ||
      key.toLowerCase().includes('plan') ||
      key.toLowerCase().includes('carrier') ||
      key.toLowerCase().includes('member') ||
      key.toLowerCase().includes('policy')
    )

    if (insuranceRelated.length > 0) {
      console.log('   Found:')
      insuranceRelated.forEach(key => {
        console.log(`   - ${key}: ${data[key]}`)
      })
    } else {
      console.log('   ⚠️ No insurance-related fields in appointment response')
    }

    // Check if there's client data embedded
    if (data.Client || data.ClientData || data.ClientInfo) {
      console.log('\n📋 Client data embedded in appointment:')
      const clientData = data.Client || data.ClientData || data.ClientInfo
      console.log(JSON.stringify(clientData, null, 2))
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message)
  }
}

exploreIntakeQAppointmentData()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err)
    process.exit(1)
  })
