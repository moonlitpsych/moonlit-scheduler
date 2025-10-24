/**
 * Check Partner Tables Schema
 * Run with: npx tsx scripts/check-partner-tables.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkTables() {
  console.log('🔍 Checking partner-related tables...\n')

  // Check partner_user_patient_assignments
  const { data: assignmentsColumns, error: assignmentsError } = await supabase
    .rpc('exec_sql', {
      sql_query: `
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'partner_user_patient_assignments'
        ORDER BY ordinal_position;
      `
    })

  console.log('📋 partner_user_patient_assignments table:')
  if (assignmentsError) {
    console.log('  ❌ Error:', assignmentsError.message)
  } else if (!assignmentsColumns || assignmentsColumns.length === 0) {
    console.log('  ⚠️  Table does not exist')
  } else {
    console.log('  ✓ Table exists with columns:')
    console.log(JSON.stringify(assignmentsColumns, null, 2))
  }

  console.log('\n')

  // Check patient_activity_log
  const { data: activityColumns, error: activityError } = await supabase
    .rpc('exec_sql', {
      sql_query: `
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'patient_activity_log'
        ORDER BY ordinal_position;
      `
    })

  console.log('📋 patient_activity_log table:')
  if (activityError) {
    console.log('  ❌ Error:', activityError.message)
  } else if (!activityColumns || activityColumns.length === 0) {
    console.log('  ⚠️  Table does not exist')
  } else {
    console.log('  ✓ Table exists with columns:')
    console.log(JSON.stringify(activityColumns, null, 2))
  }

  console.log('\n')

  // Check partner_users columns
  const { data: partnerUsersColumns, error: puError } = await supabase
    .rpc('exec_sql', {
      sql_query: `
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'partner_users'
        ORDER BY ordinal_position;
      `
    })

  console.log('📋 partner_users table (existing columns):')
  if (puError) {
    console.log('  ❌ Error:', puError.message)
  } else if (!partnerUsersColumns || partnerUsersColumns.length === 0) {
    console.log('  ⚠️  Table does not exist')
  } else {
    console.log('  ✓ Table exists with columns:')
    console.log(JSON.stringify(partnerUsersColumns, null, 2))
  }
}

checkTables()
