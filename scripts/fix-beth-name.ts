/**
 * Fix Beth's name from "Whipey" to "Whipkey"
 * Run with: npx tsx scripts/fix-beth-name.ts
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
const TEST_EMAIL = 'testpartner@example.com'

async function fixBethName() {
  console.log('🔧 Fixing Beth\'s name from "Whipey" to "Whipkey"...\n')

  // Update the partner user
  const { data, error } = await supabase
    .from('partner_users')
    .update({
      full_name: 'Beth Whipkey (Test)'
    })
    .eq('email', TEST_EMAIL)
    .eq('organization_id', FSH_ORG_ID)
    .select()

  if (error) {
    console.error('❌ Error updating name:', error.message)
    return
  }

  if (data && data.length > 0) {
    console.log('✅ Updated successfully!')
    console.log(`   Name: ${data[0].full_name}`)
    console.log(`   Email: ${data[0].email}`)
    console.log(`   Role: ${data[0].role}`)
  } else {
    console.log('⚠️  No user found to update')
  }
}

fixBethName()
