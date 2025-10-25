import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!
const intakeqApiKey = process.env.INTAKEQ_API_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testIntakeQClientData() {
  console.log('🔍 Testing IntakeQ client data retrieval...\n')

  // Get patient Hyrum Bay who we just synced
  const patientId = 'e404eb7a-c17c-44c8-8ebf-e23bdc87b39b'

  const { data: patient, error: patientError } = await supabase
    .from('patients')
    .select('*')
    .eq('id', patientId)
    .single()

  if (patientError || !patient) {
    console.error('❌ Patient not found:', patientError)
    return
  }

  console.log('📋 Patient:', patient.first_name, patient.last_name)
  console.log('📧 Email:', patient.email)
  console.log('🏥 Current Payer ID:', patient.primary_payer_id || 'None')
  console.log('🔗 IntakeQ Client ID:', patient.intakeq_client_id || 'None')
  console.log()

  if (!patient.intakeq_client_id) {
    console.log('❌ Patient has no IntakeQ client ID - cannot fetch client data')
    return
  }

  // Fetch client data from IntakeQ
  console.log('📡 Fetching client data from IntakeQ API...')

  try {
    const response = await fetch(
      `https://intakeq.com/api/v1/clients/${patient.intakeq_client_id}`,
      {
        method: 'GET',
        headers: {
          'X-Auth-Key': intakeqApiKey,
          'Content-Type': 'application/json'
        }
      }
    )

    if (!response.ok) {
      console.error('❌ IntakeQ API error:', response.status, response.statusText)
      const errorText = await response.text()
      console.error('Error details:', errorText)
      return
    }

    const clientData = await response.json()

    console.log('\n✅ IntakeQ Client Data:')
    console.log(JSON.stringify(clientData, null, 2))

    console.log('\n🏥 Insurance fields to look for:')
    const insuranceFields = Object.keys(clientData).filter(key =>
      key.toLowerCase().includes('insurance') ||
      key.toLowerCase().includes('payer') ||
      key.toLowerCase().includes('plan') ||
      key.toLowerCase().includes('carrier')
    )

    if (insuranceFields.length > 0) {
      console.log('Found insurance-related fields:')
      insuranceFields.forEach(field => {
        console.log(`  - ${field}: ${clientData[field]}`)
      })
    } else {
      console.log('⚠️ No insurance-related fields found in top-level keys')
      console.log('Checking all field values...')
    }

  } catch (error: any) {
    console.error('❌ Error fetching from IntakeQ:', error.message)
  }
}

testIntakeQClientData()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err)
    process.exit(1)
  })
