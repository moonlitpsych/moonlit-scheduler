/**
 * Reset partner user password for testing
 * Run with: npx tsx scripts/reset-partner-password.ts testpartner@example.com newpassword123
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function resetPassword(email: string, newPassword: string) {
  console.log(`🔐 Resetting password for: ${email}\n`)

  // Find partner user
  const { data: partnerUser, error: puError } = await supabase
    .from('partner_users')
    .select('id, auth_user_id, full_name')
    .eq('email', email)
    .single()

  if (puError || !partnerUser) {
    console.error('❌ Partner user not found')
    return
  }

  if (!partnerUser.auth_user_id) {
    console.error('❌ Partner user has no auth account')
    return
  }

  // Update password
  const { data, error } = await supabase.auth.admin.updateUserById(
    partnerUser.auth_user_id,
    { password: newPassword }
  )

  if (error) {
    console.error('❌ Error updating password:', error.message)
    return
  }

  console.log('✅ Password updated successfully!')
  console.log(`\n📧 Email: ${email}`)
  console.log(`🔒 Password: ${newPassword}`)
  console.log(`\n🔗 Login at: http://localhost:3000/partner-auth/login`)
}

const email = process.argv[2]
const password = process.argv[3] || 'password123'

if (!email) {
  console.error('Usage: npx tsx scripts/reset-partner-password.ts <email> [password]')
  process.exit(1)
}

resetPassword(email, password)
