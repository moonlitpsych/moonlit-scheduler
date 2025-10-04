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