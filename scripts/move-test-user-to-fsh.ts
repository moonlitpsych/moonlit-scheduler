/**
 * Move test partner user to FSH organization
 * Run with: npx tsx scripts/move-test-user-to-fsh.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const FSH_ORG_ID = 'c621d896-de55-4ea7-84c2-a01502249e82'
const BETH_CONTACT_ID = '442a8086-642e-47a1-8ddd-f389adb0f0f7'
const TEST_EMAIL = 'testpartner@example.com'

async function moveTestUserToFSH() {
  console.log('🔄 Moving test user to FSH organization...\n')

  // Find the test user
  const { data: testUser, error: userError } = await supabase
    .from('partner_users')
    .select('id, email, full_name, organization_id, role, auth_user_id')
    .eq('email', TEST_EMAIL)
    .single()

  if (userError || !testUser) {
    console.error('❌ Test user not found')
    return
  }

  console.log('Current user details:')
  console.log(`  Email: ${testUser.email}`)
  console.log(`  Name: ${testUser.full_name || 'Not set'}`)
  console.log(`  Current Org ID: ${testUser.organization_id}`)
  console.log(`  Role: ${testUser.role}`)
  console.log(`  Auth User ID: ${testUser.auth_user_id}\n`)

  // Update to FSH
  const { error: updateError } = await supabase
    .from('partner_users')
    .update({
      organization_id: FSH_ORG_ID,
      full_name: 'Beth Whipey (Test)',
      contact_id: BETH_CONTACT_ID,
      role: 'partner_case_manager'  // Beth is a case manager
    })
    .eq('id', testUser.id)

  if (updateError) {
    console.error('❌ Error updating user:', updateError.message)
    return
  }

  console.log('✅ Test user successfully moved to FSH!\n')
  console.log('Updated details:')
  console.log(`  Email: ${TEST_EMAIL}`)
  console.log(`  Password: TestPassword123!`)
  console.log(`  Name: Beth Whipey (Test)`)
  console.log(`  Organization: First Step House`)
  console.log(`  Role: partner_case_manager`)
  console.log(`  Contact ID: ${BETH_CONTACT_ID}`)
  console.log(`\n🔗 Login at: http://localhost:3000/partner-auth/login`)
}

moveTestUserToFSH()
