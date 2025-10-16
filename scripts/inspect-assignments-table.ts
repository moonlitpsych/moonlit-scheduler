/**
 * Inspect partner_user_patient_assignments table structure
 * Run with: npx tsx scripts/inspect-assignments-table.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function inspectTable() {
  console.log('🔍 Inspecting partner_user_patient_assignments table...\n')

  // Try to get the table definition from pg_catalog
  const { data: tableInfo, error: tableError } = await supabase
    .from('partner_user_patient_assignments')
    .select('*')
    .limit(0) // Just get structure

  if (tableError) {
    console.log('❌ Error accessing table:', tableError.message)
    return
  }

  console.log('✅ Table exists and is accessible\n')

  // Check for specific columns
  const columnsToCheck = [
    'id',
    'partner_user_id',
    'patient_id',
    'organization_id',
    'assignment_type',
    'assigned_date',
    'status',
    'created_at',
    'updated_at'
  ]

  console.log('Checking for expected columns:\n')

  for (const col of columnsToCheck) {
    const { error } = await supabase
      .from('partner_user_patient_assignments')
      .select(col)
      .limit(0)

    if (error) {
      console.log(`  ✗ ${col} - MISSING`)
    } else {
      console.log(`  ✓ ${col} - EXISTS`)
    }
  }

  console.log('\n')

  // Try to get actual column names by attempting a select *
  console.log('Attempting to infer columns from select *...')

  const { data: sampleData, error: sampleError } = await supabase
    .from('partner_user_patient_assignments')
    .select('*')
    .limit(1)

  if (sampleError) {
    console.log('❌ Could not fetch sample data:', sampleError.message)
  } else if (!sampleData || sampleData.length === 0) {
    console.log('⚠️  Table is empty')
  } else {
    console.log('\n✓ Sample row columns:')
    Object.keys(sampleData[0]).forEach(key => {
      console.log(`  - ${key}`)
    })
  }
}

inspectTable()
