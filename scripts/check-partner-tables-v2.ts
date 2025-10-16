/**
 * Check Partner Tables Schema (Direct Query)
 * Run with: npx tsx scripts/check-partner-tables-v2.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkTable(tableName: string) {
  console.log(`📋 Checking ${tableName}...`)

  try {
    // Try to select from the table
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(0)

    if (error) {
      if (error.message.includes('does not exist') || error.code === '42P01') {
        console.log(`  ⚠️  Table does not exist\n`)
        return { exists: false }
      } else {
        console.log(`  ❌ Error: ${error.message}\n`)
        return { exists: false, error }
      }
    } else {
      console.log(`  ✓ Table exists\n`)
      return { exists: true }
    }
  } catch (err: any) {
    console.log(`  ❌ Error: ${err.message}\n`)
    return { exists: false, error: err }
  }
}

async function main() {
  console.log('🔍 Checking partner-related tables...\n')

  const tables = [
    'partner_users',
    'partner_user_patient_assignments',
    'patient_activity_log',
    'patient_organization_affiliations'
  ]

  const results: Record<string, any> = {}

  for (const table of tables) {
    results[table] = await checkTable(table)
  }

  console.log('📊 Summary:')
  for (const [table, result] of Object.entries(results)) {
    console.log(`  ${result.exists ? '✓' : '✗'} ${table}`)
  }
  console.log('')
}

main()
