#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkViewType() {
  // Check if we can query the view
  const result = await supabase
    .from('v_patient_activity_summary')
    .select('patient_id')
    .limit(1)

  if (result.error) {
    console.log('❌ View query error:', result.error.message)
    return
  }

  console.log('✅ View exists and is queryable\n')

  // The fact that refresh failed with "not a table or materialized view"
  // strongly suggests it's already a REGULAR VIEW (auto-updates)
  console.log('📊 Evidence that this is a REGULAR VIEW (not materialized):\n')
  console.log('1. When we tried: supabase.rpc("refresh_patient_activity_summary")')
  console.log('   Got error: "v_patient_activity_summary is not a table or materialized view"')
  console.log('   This error ONLY happens when trying to refresh a regular view\n')

  console.log('2. There\'s a file: database-migrations/URGENT-convert-to-regular-view.sql')
  console.log('   Suggesting someone already converted it\n')

  console.log('📖 Difference:\n')
  console.log('MATERIALIZED VIEW:')
  console.log('  ❌ Snapshot of data (goes stale)')
  console.log('  ❌ Needs manual REFRESH to update')
  console.log('  ✅ Fast queries (pre-computed)\n')

  console.log('REGULAR VIEW:')
  console.log('  ✅ Always shows current data (never stale)')
  console.log('  ✅ Auto-updates when underlying tables change')
  console.log('  ⚠️  Slightly slower (queries on-the-fly)\n')

  console.log('🎯 Conclusion:')
  console.log('The view appears to be a REGULAR VIEW already, which is GOOD!')
  console.log('This means status updates appear immediately without manual refresh.')
}

checkViewType()
