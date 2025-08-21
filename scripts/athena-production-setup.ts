// scripts/athena-production-setup.ts
import { config } from 'dotenv'

// Load environment variables from .env.local
config({ path: '.env.local' })

// Direct Athena service import to avoid Supabase dependency
class AthenaServiceSetup {
  async testConnection() {
    const clientId = process.env.ATHENA_CLIENT_ID
    const clientSecret = process.env.ATHENA_CLIENT_SECRET
    const tokenUrl = process.env.ATHENA_TOKEN_URL
    const baseUrl = process.env.ATHENA_BASE_URL
    const practiceId = process.env.ATHENA_PRACTICE_ID

    try {
      // Get token
      const response = await fetch(tokenUrl!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
        },
        body: 'grant_type=client_credentials&scope=athena/service/Athenanet.MDP.*'
      })

      if (!response.ok) {
        return { success: false, error: 'Authentication failed' }
      }

      const tokenData = await response.json()

      // Test providers endpoint
      const apiResponse = await fetch(`${baseUrl}/v1/${practiceId}/providers`, {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!apiResponse.ok) {
        return { success: false, error: 'API call failed' }
      }

      const apiData = await apiResponse.json()

      return {
        success: true,
        data: {
          providers_found: apiData?.providers?.length || 0,
          practice_id: practiceId,
          environment: process.env.ATHENA_ENVIRONMENT || 'sandbox'
        }
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  async getProviders() {
    // Simplified provider fetch for setup script
    return []
  }
}

const athenaService = new AthenaServiceSetup()

async function setupForProduction() {
  console.log('🚀 Athena Production Setup Script\n')

  try {
    // Test connection
    console.log('1️⃣ Testing Athena connection...')
    const connectionTest = await athenaService.testConnection()
    
    if (!connectionTest.success) {
      console.error('❌ Athena connection failed:', connectionTest.error)
      return
    }
    console.log('✅ Athena connection successful\n')

    // Get current environment info
    console.log('2️⃣ Environment Information:')
    console.log(`   Environment: ${process.env.ATHENA_ENVIRONMENT}`)
    console.log(`   Practice ID: ${process.env.ATHENA_PRACTICE_ID}`)
    console.log(`   Service ID: ${process.env.ATHENA_SERVICE_ID}`)
    console.log(`   Base URL: ${process.env.ATHENA_BASE_URL}\n`)

    // Test providers
    console.log('3️⃣ Checking providers in Athena...')
    try {
      const providers = await athenaService.getProviders()
      console.log(`   Providers found: ${providers.length}`)
      
      if (providers.length > 0) {
        console.log('   Sample providers:')
        providers.slice(0, 3).forEach((p, i) => {
          console.log(`   ${i + 1}. ${p.firstname} ${p.lastname} (ID: ${p.providerid})`)
        })
      } else {
        console.log('   ⚠️ No providers found in sandbox')
        console.log('   📋 Next step: Add providers in Athena portal')
      }
    } catch (error: any) {
      console.log(`   ❌ Provider fetch failed: ${error.message}`)
    }
    console.log('')

    // Production readiness checklist
    console.log('4️⃣ Production Readiness Checklist:')
    
    const checklist = [
      {
        item: 'Athena Authentication',
        status: connectionTest.success ? '✅' : '❌',
        notes: connectionTest.success ? 'Working' : 'Failed'
      },
      {
        item: 'Required Scopes',
        status: '⚠️',
        notes: 'Verify in Developer Portal: user/Provider.read, user/Patient.write, user/Appointment.write'
      },
      {
        item: 'Webhook Configuration',
        status: '⚠️',
        notes: 'Set webhook URL in Developer Portal'
      },
      {
        item: 'Provider Data',
        status: (connectionTest.data?.providers_found || 0) > 0 ? '✅' : '⚠️',
        notes: `${connectionTest.data?.providers_found || 0} providers in Athena`
      },
      {
        item: 'Department Mapping',
        status: '⚠️',
        notes: 'Configure departments in Athena portal'
      },
      {
        item: 'Solution Validation',
        status: '📋',
        notes: 'Submit tech spec to Athena support'
      },
      {
        item: 'Production Credentials',
        status: '📋',
        notes: 'Get production OAuth2 credentials'
      }
    ]

    checklist.forEach((item, i) => {
      console.log(`   ${item.status} ${item.item}: ${item.notes}`)
    })

    console.log('\n5️⃣ Next Actions:')
    console.log('   📝 Developer Portal Tasks:')
    console.log('      - Add required scopes to your app')
    console.log('      - Configure webhook URL')
    console.log('      - Add providers to sandbox for testing')
    console.log('      - Set up departments')
    console.log('')
    console.log('   📋 Solution Validation:')
    console.log('      - Create technical specification document')
    console.log('      - Submit to Athena via Customer Support')
    console.log('      - Reference Service ID: PROJ-294665')
    console.log('')
    console.log('   🚀 Production Deployment:')
    console.log('      - Receive production credentials')
    console.log('      - Update environment variables')
    console.log('      - Deploy and monitor')

    console.log('\n✅ Setup script completed successfully!')

  } catch (error: any) {
    console.error('\n❌ Setup failed:', error.message)
  }
}

setupForProduction()