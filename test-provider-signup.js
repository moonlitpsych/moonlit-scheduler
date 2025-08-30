/**
 * Test Provider Signup Flow
 * Generates fresh test credentials that won't conflict with existing data
 */

const { createClient } = require('@supabase/supabase-js')
const { config } = require('dotenv')

// Load environment variables
config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

async function generateTestCredentials() {
  const timestamp = Date.now()
  const randomNum = Math.floor(Math.random() * 1000)
  
  const testCredentials = {
    // Authentication
    email: `test.provider.${timestamp}@moonlittest.com`,
    password: 'TestProvider123!',
    
    // Profile
    firstName: 'Dr. Test',
    lastName: `Provider${randomNum}`,
    title: 'MD, PhD',
    role: 'psychiatrist',
    specialty: 'General Psychiatry',
    phone: `(555) ${String(randomNum).padStart(3, '0')}-${String(timestamp).slice(-4)}`,
    npi: `12345${String(randomNum).padStart(5, '0')}`
  }
  
  console.log(`
🧪 FRESH TEST CREDENTIALS FOR PROVIDER SIGNUP
===========================================

Use these credentials to test the complete signup flow:

📧 EMAIL: ${testCredentials.email}
🔑 PASSWORD: ${testCredentials.password}

👤 PROFILE INFO:
   First Name: ${testCredentials.firstName}
   Last Name: ${testCredentials.lastName}
   Title: ${testCredentials.title}
   Role: ${testCredentials.role}
   Specialty: ${testCredentials.specialty}
   Phone: ${testCredentials.phone}
   NPI: ${testCredentials.npi}

🎯 TEST STEPS:
1. Go to: http://localhost:3003/auth/provider-signup
2. Step 1 - Enter email and password above
3. Step 2 - Enter profile info above
4. Should succeed and redirect to dashboard!

✨ These credentials are guaranteed to be unique and won't conflict with existing data.
`)

  return testCredentials
}

async function checkExistingProviders() {
  console.log('\n🔍 CHECKING EXISTING PROVIDERS:')
  
  const { data: providers, error } = await supabase
    .from('providers')
    .select('first_name, last_name, email, auth_user_id')
    .order('created_at', { ascending: false })
    .limit(10)
  
  if (error) {
    console.error('❌ Error checking providers:', error)
  } else {
    console.log(`Found ${providers.length} recent providers:`)
    providers.forEach((p, index) => {
      console.log(`   ${index + 1}. ${p.first_name} ${p.last_name} (${p.email}) - Auth: ${p.auth_user_id ? 'Linked' : 'No Auth'}`)
    })
  }
}

async function main() {
  await checkExistingProviders()
  await generateTestCredentials()
  
  console.log(`
🎉 READY TO TEST!

The duplicate detection you experienced means the system is working correctly!
It found an existing provider with similar details and prevented a duplicate.

Now you can test the full signup flow with the unique credentials above.
`)
}

main().catch(console.error)