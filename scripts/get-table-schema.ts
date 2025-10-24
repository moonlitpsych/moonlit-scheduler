/**
 * Get Table Schema
 * Run with: npx tsx scripts/get-table-schema.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function getTableSchema(tableName: string) {
  console.log(`\n📋 Schema for ${tableName}:\n`)

  // Get a single row to see the structure
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .limit(1)

  if (error) {
    console.log('❌ Error:', error.message)
    return
  }

  if (!data || data.length === 0) {
    console.log('⚠️  Table is empty, but exists. Showing keys from empty result:')
    const { data: emptyData } = await supabase
      .from(tableName)
      .select('*')
      .limit(0)

    console.log('  No data to infer schema from')
    return
  }

  const row = data[0]
  console.log('Columns found:')
  Object.keys(row).forEach(key => {
    console.log(`  - ${key}: ${typeof row[key]} (value: ${JSON.stringify(row[key])})`)
  })
}

async function main() {
  await getTableSchema('partner_user_patient_assignments')
  await getTableSchema('partner_users')
}

main()
