// scripts/test-athena-connection.ts
import 'dotenv/config'
import { athenaService } from '../src/lib/services/athenaService'

async function testAthenaConnection() {
  console.log('🧪 Testing Athena Health API Connection...\n')

  try {
    // Test basic connection
    console.log('1️⃣ Testing authentication...')
    const connectionTest = await athenaService.testConnection()
    
    if (connectionTest.success) {
      console.log('✅ Authentication successful!')
      console.log(`   Practice ID: ${connectionTest.data?.practice_id}`)
      console.log(`   Environment: ${connectionTest.data?.environment}`)
      console.log(`   Providers found: ${connectionTest.data?.providers_found}`)
    } else {
      console.error('❌ Authentication failed:', connectionTest.error)
      return
    }

    console.log('\n2️⃣ Testing provider fetch...')
    const providers = await athenaService.getProviders()
    console.log(`✅ Successfully fetched ${providers.length} providers`)
    
    if (providers.length > 0) {
      console.log('   Sample providers:')
      providers.slice(0, 3).forEach((provider, i) => {
        console.log(`   ${i + 1}. ${provider.firstname} ${provider.lastname} (ID: ${provider.providerid})`)
      })
    }

    console.log('\n3️⃣ Testing provider sync...')
    const syncResult = await athenaService.syncProviders()
    console.log(`✅ Sync completed: ${syncResult.synced} synced, ${syncResult.errors} errors`)

    console.log('\n🎉 All tests passed! Athena integration is working correctly.')

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message)
    console.error('Stack trace:', error.stack)
    process.exit(1)
  }
}

// Run the test
testAthenaConnection()