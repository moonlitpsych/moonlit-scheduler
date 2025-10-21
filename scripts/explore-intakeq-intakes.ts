const intakeqApiKey = process.env.INTAKEQ_API_KEY!

async function exploreIntakeQIntakes() {
  console.log('🔍 Exploring IntakeQ Intakes API...\n')

  // Try to get intakes for client ID 31 (Hyrum Bay)
  const clientId = 31

  console.log('1️⃣ Trying GET /intakes with client filter...')
  try {
    const response1 = await fetch(
      `https://intakeq.com/api/v1/intakes?clientId=${clientId}`,
      {
        method: 'GET',
        headers: {
          'X-Auth-Key': intakeqApiKey,
          'Content-Type': 'application/json'
        }
      }
    )

    console.log('   Status:', response1.status)

    if (response1.ok) {
      const data = await response1.json()
      console.log('   ✅ Response:')
      console.log(JSON.stringify(data, null, 2))
    } else {
      const text = await response1.text()
      console.log('   ❌ Error:', text.substring(0, 200))
    }
  } catch (error: any) {
    console.log('   ❌ Exception:', error.message)
  }

  console.log('\n2️⃣ Trying GET /clients/{clientId}/intakes...')
  try {
    const response2 = await fetch(
      `https://intakeq.com/api/v1/clients/${clientId}/intakes`,
      {
        method: 'GET',
        headers: {
          'X-Auth-Key': intakeqApiKey,
          'Content-Type': 'application/json'
        }
      }
    )

    console.log('   Status:', response2.status)

    if (response2.ok) {
      const data = await response2.json()
      console.log('   ✅ Response:')
      console.log(JSON.stringify(data, null, 2))
    } else {
      const text = await response2.text()
      console.log('   ❌ Error:', text.substring(0, 200))
    }
  } catch (error: any) {
    console.log('   ❌ Exception:', error.message)
  }

  console.log('\n3️⃣ Trying GET /intakes (all intakes)...')
  try {
    const response3 = await fetch(
      `https://intakeq.com/api/v1/intakes`,
      {
        method: 'GET',
        headers: {
          'X-Auth-Key': intakeqApiKey,
          'Content-Type': 'application/json'
        }
      }
    )

    console.log('   Status:', response3.status)

    if (response3.ok) {
      const data = await response3.json()
      if (Array.isArray(data)) {
        console.log(`   ✅ Found ${data.length} intakes`)
        // Show first one
        if (data.length > 0) {
          console.log('\n   Sample intake:')
          console.log(JSON.stringify(data[0], null, 2))
        }
      } else {
        console.log('   ✅ Response:')
        console.log(JSON.stringify(data, null, 2))
      }
    } else {
      const text = await response3.text()
      console.log('   ❌ Error:', text.substring(0, 200))
    }
  } catch (error: any) {
    console.log('   ❌ Exception:', error.message)
  }

  console.log('\n4️⃣ Checking what APIs are available...')
  console.log('   Common IntakeQ API endpoints:')
  console.log('   - GET /clients - List all clients')
  console.log('   - GET /clients/{id} - Get client details')
  console.log('   - GET /appointments - List appointments')
  console.log('   - GET /intakes - List intake forms')
  console.log('   - GET /questionnaires - List questionnaire templates')
  console.log('   - GET /practitioners - List practitioners')
  console.log('   - GET /services - List services')
}

exploreIntakeQIntakes()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err)
    process.exit(1)
  })
