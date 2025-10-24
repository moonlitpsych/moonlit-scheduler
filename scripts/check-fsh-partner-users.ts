/**
 * Check for FSH partner users
 * Run with: npx tsx scripts/check-fsh-partner-users.ts
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

async function checkFSHUsers() {
  console.log('🔍 Checking for FSH (First Step House) partner users...\n')

  // Get FSH organization details
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('id', FSH_ORG_ID)
    .single()

  if (orgError || !org) {
    console.error('❌ FSH organization not found:', orgError?.message)
    return
  }

  console.log(`✅ Organization: ${org.name}`)
  console.log(`   ID: ${org.id}\n`)

  // Check for partner users affiliated with FSH
  const { data: partnerUsers, error: puError } = await supabase
    .from('partner_users')
    .select('id, email, full_name, role, is_active, auth_user_id, contact_id')
    .eq('organization_id', FSH_ORG_ID)
    .order('created_at', { ascending: false })

  if (puError) {
    console.error('❌ Error fetching partner users:', puError.message)
    return
  }

  if (!partnerUsers || partnerUsers.length === 0) {
    console.log('⚠️  No partner users found for FSH')
    console.log('\nOptions:')
    console.log('1. Create a new FSH partner user')
    console.log('2. Update existing testpartner@example.com to FSH organization')
    return
  }

  console.log(`✅ Found ${partnerUsers.length} FSH partner user(s):\n`)

  partnerUsers.forEach((user, index) => {
    console.log(`${index + 1}. ${user.full_name || user.email}`)
    console.log(`   Email: ${user.email}`)
    console.log(`   Role: ${user.role}`)
    console.log(`   Active: ${user.is_active ? 'Yes' : 'No'}`)
    console.log(`   Auth Account: ${user.auth_user_id ? 'Yes ✓' : 'No (needs invitation)'}`)
    console.log(`   Contact ID: ${user.contact_id || 'None'}`)

    if (user.contact_id === BETH_CONTACT_ID) {
      console.log(`   ⭐ This is Beth Whipey's account`)
    }
    console.log('')
  })

  // Check for auth users
  const usersWithAuth = partnerUsers.filter(u => u.auth_user_id)

  if (usersWithAuth.length > 0) {
    console.log('\n✅ Partner users ready to login:\n')
    usersWithAuth.forEach(user => {
      console.log(`   📧 ${user.email}`)
      console.log(`   Name: ${user.full_name || 'Not set'}`)
      console.log(`   Role: ${user.role}`)
      console.log(`   🔗 Login at: http://localhost:3000/partner-auth/login`)
      console.log('')
    })
  } else {
    console.log('\n⚠️  No FSH users have auth accounts yet')
    console.log('   You can create one with the reset-partner-password script')
  }
}

checkFSHUsers()
