import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!
const intakeqApiKey = process.env.INTAKEQ_API_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testInsuranceExtraction() {
  console.log('🔍 Testing insurance extraction from IntakeQ custom fields...\n')

  // Patient: Hyrum Bay (e404eb7a-c17c-44c8-8ebf-e23bdc87b39b)
  const patientId = 'e404eb7a-c17c-44c8-8ebf-e23bdc87b39b'
  const email = 'hyrum.bay@gmail.com'

  console.log('📋 Patient: Hyrum Bay')
  console.log('📧 Email:', email)
  console.log()

  // Fetch appointments from IntakeQ
  const startDate = '2025-07-01' // Last 3 months
  const endDate = '2025-10-21'

  console.log(`📡 Fetching IntakeQ appointments for ${email} from ${startDate} to ${endDate}...`)

  const response = await fetch(
    `https://intakeq.com/api/v1/appointments?client=${encodeURIComponent(email)}&startDate=${startDate}&endDate=${endDate}`,
    {
      method: 'GET',
      headers: {
        'X-Auth-Key': intakeqApiKey,
        'Content-Type': 'application/json'
      }
    }
  )

  if (!response.ok) {
    console.error('❌ IntakeQ API error:', response.status)
    return
  }

  const appointments = await response.json()
  console.log(`✅ Found ${appointments.length} appointments\n`)

  if (appointments.length === 0) {
    console.log('No appointments to process')
    return
  }

  // Check each appointment for insurance custom fields
  let insuranceFound = false

  for (const appt of appointments) {
    console.log('─'.repeat(60))
    console.log(`📍 Appointment ${appt.Id}`)
    console.log(`   Date: ${appt.StartDateIso}`)
    console.log(`   Practitioner: ${appt.PractitionerName}`)

    if (appt.CustomFields && appt.CustomFields.length > 0) {
      const insuranceField = appt.CustomFields.find((f: any) => {
        const label = (f.Label || f.Name || '').toLowerCase()
        return label.includes('insurance company') ||
               label.includes('name of your insurance')
      })

      if (insuranceField) {
        const insuranceName = insuranceField.Value || insuranceField.Answer
        console.log(`   🏥 Insurance: ${insuranceName}`)
        insuranceFound = true

        // Test mapping
        const normalized = insuranceName.toLowerCase().trim()
        if (normalized.includes('dmba')) {
          console.log('   ✅ Would map to: DMBA')
        } else if (normalized.includes('health choice') || normalized.includes('hcu')) {
          console.log('   ✅ Would map to: Health Choice Utah')
        } else if (normalized.includes('medicaid')) {
          console.log('   ⚠️ Would map to: Utah Medicaid Fee-for-Service (generic Medicaid)')
        } else {
          console.log(`   ⚠️ Unknown insurance - needs mapping rule`)
        }
      } else {
        console.log('   ⚠️ No insurance custom field')
      }
    } else {
      console.log('   ⚠️ No custom fields')
    }
  }

  console.log('\n' + '═'.repeat(60))

  if (insuranceFound) {
    console.log('✅ Insurance data found in IntakeQ custom fields!')
    console.log('\nWhen you sync this patient from PracticeQ:')
    console.log('1. The sync will extract insurance from custom fields')
    console.log('2. Map it to a payer in the database')
    console.log('3. Update patients.primary_payer_id')
  } else {
    console.log('⚠️ No insurance data found in custom fields')
    console.log('This patient may not have filled out the intake form with insurance info')
  }
}

testInsuranceExtraction()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err)
    process.exit(1)
  })
