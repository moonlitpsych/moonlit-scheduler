/**
 * Check for existing partner test users
 * Run with: npx tsx scripts/check-partner-test-users.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkTestUsers() {
  console.log('🔍 Checking for partner test users...\n')

  // Check for partner users
  const { data: partnerUsers, error: puError } = await supabase
    .from('partner_users')
    .select(`
      id,
      email,
      full_name,
      role,
      is_active,
      auth_user_id,
      organization:organizations(name)
    `)
    .order('created_at', { ascending: false })

  if (puError) {
    console.error('❌ Error fetching partner users:', puError.message)
    return
  }

  if (!partnerUsers || partnerUsers.length === 0) {
    console.log('⚠️  No partner users found in database')
    console.log('\nTo create a test user, you can:')
    console.log('1. Use the invitation API: POST /api/partner-auth/invite')
    console.log('2. Or manually insert a record with auth account')
    return
  }

  console.log(`✅ Found ${partnerUsers.length} partner user(s):\n`)

  partnerUsers.forEach((user, index) => {
    console.log(`${index + 1}. ${user.full_name || user.email}`)
    console.log(`   Email: ${user.email}`)
    console.log(`   Organization: ${user.organization?.name || 'Unknown'}`)
    console.log(`   Role: ${user.role}`)
    console.log(`   Active: ${user.is_active ? 'Yes' : 'No'}`)
    console.log(`   Auth Account: ${user.auth_user_id ? 'Yes ✓' : 'No (needs invitation)'}`)
    console.log('')
  })

  // Check for auth users that might be partners
  console.log('🔐 Checking Supabase Auth users...\n')

  const { data: { users: authUsers }, error: authError } = await supabase.auth.admin.listUsers()

  if (authError) {
    console.error('❌ Error fetching auth users:', authError.message)
    return
  }

  const partnerAuthIds = new Set(partnerUsers.map(u => u.auth_user_id).filter(Boolean))

  console.log(`Total auth users: ${authUsers.length}`)
  console.log(`Partner auth accounts: ${partnerAuthIds.size}`)

  // Find auth users that are partners
  const partnerAuthUsers = authUsers.filter(u => partnerAuthIds.has(u.id))

  if (partnerAuthUsers.length > 0) {
    console.log('\n✅ Partner users with auth accounts (ready to login):\n')
    partnerAuthUsers.forEach(authUser => {
      const partnerUser = partnerUsers.find(pu => pu.auth_user_id === authUser.id)
      console.log(`   📧 ${authUser.email}`)
      console.log(`   Name: ${partnerUser?.full_name || 'Not set'}`)
      console.log(`   Organization: ${partnerUser?.organization?.name || 'Unknown'}`)
      console.log(`   Role: ${partnerUser?.role}`)
      console.log('')
    })
  }
}

checkTestUsers()
