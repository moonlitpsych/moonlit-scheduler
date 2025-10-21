const intakeqApiKey = process.env.INTAKEQ_API_KEY!

async function checkCustomFields() {
  console.log('🔍 Checking IntakeQ appointments for custom fields...\n')

  // Get all appointments
  const response = await fetch('https://intakeq.com/api/v1/appointments', {
    headers: { 'X-Auth-Key': intakeqApiKey }
  })

  if (!response.ok) {
    console.error('❌ API error:', response.status)
    return
  }

  const appointments = await response.json()

  console.log(`📊 Total appointments: ${appointments.length}`)

  // Find appointments with custom fields
  const withCustomFields = appointments.filter((a: any) =>
    a.CustomFields && a.CustomFields.length > 0
  )

  console.log(`📋 Appointments with custom fields: ${withCustomFields.length}\n`)

  if (withCustomFields.length > 0) {
    console.log('✅ Sample custom fields:')
    withCustomFields.slice(0, 5).forEach((a: any) => {
      console.log(`\n   Appointment: ${a.ClientName} (${a.Id})`)
      a.CustomFields.forEach((f: any) => {
        console.log(`      ${f.Label || f.Name || 'Field'}: ${f.Value || f.Answer}`)
      })
    })
  } else {
    console.log('⚠️ No custom fields found in any appointments')
  }

  // Look for insurance-related custom fields
  const allCustomFields: any[] = []
  appointments.forEach((a: any) => {
    if (a.CustomFields && a.CustomFields.length > 0) {
      a.CustomFields.forEach((f: any) => {
        const label = (f.Label || f.Name || '').toLowerCase()
        if (label.includes('insurance') || label.includes('payer') || label.includes('plan')) {
          allCustomFields.push({ appointment: a.ClientName, field: f })
        }
      })
    }
  })

  if (allCustomFields.length > 0) {
    console.log('\n\n🏥 Insurance-related custom fields found:')
    allCustomFields.forEach(item => {
      console.log(`   ${item.appointment}: ${item.field.Label || item.field.Name} = ${item.field.Value || item.field.Answer}`)
    })
  }
}

checkCustomFields()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err)
    process.exit(1)
  })
