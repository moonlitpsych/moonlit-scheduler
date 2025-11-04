#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkLogs() {
  console.log('🔍 Checking for recent eligibility check logs...\n')

  // Look for Savannah Cheshire checks
  const { data: logs, error } = await supabase
    .from('eligibility_check_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('❌ Error querying logs:', error)
    return
  }

  console.log(`Found ${logs?.length || 0} recent eligibility checks\n`)

  // Look for DMBA or Savannah
  const dmbaLogs = logs?.filter(log =>
    log.raw_x12_271?.includes('DMBA') ||
    log.raw_x12_271?.includes('Savannah') ||
    log.raw_x12_271?.includes('Cheshire') ||
    log.patient_data?.firstName?.toLowerCase().includes('savannah') ||
    log.patient_data?.lastName?.toLowerCase().includes('cheshire')
  )

  if (dmbaLogs && dmbaLogs.length > 0) {
    console.log(`✅ Found ${dmbaLogs.length} DMBA/Savannah checks:\n`)
    
    dmbaLogs.forEach((log, idx) => {
      console.log(`\n========== CHECK ${idx + 1} (${log.created_at}) ==========`)
      console.log(`Admin: ${log.admin_email}`)
      console.log(`Patient: ${JSON.stringify(log.patient_data)}`)
      console.log(`Office Ally Payer ID: ${log.office_ally_payer_id}`)
      console.log(`\n📄 RAW X12 271 RESPONSE:`)
      console.log('---START---')
      console.log(log.raw_x12_271)
      console.log('---END---')
      console.log(`\nResult:`, JSON.stringify(log.eligibility_result, null, 2))
      console.log(`Response Time: ${log.response_time_ms}ms`)
    })
  } else {
    console.log('❌ No DMBA/Savannah checks found in recent logs')
    
    // Show what we do have
    console.log('\n📋 Recent checks:')
    logs?.slice(0, 5).forEach(log => {
      console.log(`- ${log.created_at}: ${log.patient_data?.firstName} ${log.patient_data?.lastName} (${log.office_ally_payer_id})`)
    })
  }
}

checkLogs().catch(console.error)
