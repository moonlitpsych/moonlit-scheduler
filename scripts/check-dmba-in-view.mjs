#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkDMBA() {
  console.log('🔍 Checking if DMBA appears in eligibility view...\n')

  const { data, error } = await supabase
    .from('v_office_ally_eligibility_configs')
    .select('*')
    .order('category')
    .order('payer_display_name')

  if (error) {
    console.error('❌ Error:', error)
    return
  }

  console.log(`Total payers in view: ${data?.length || 0}\n`)

  const dmba = data?.find(p => p.office_ally_payer_id === '001076973' || p.payer_display_name?.includes('DMBA'))

  if (dmba) {
    console.log('✅ DMBA FOUND in eligibility view:')
    console.log(JSON.stringify(dmba, null, 2))
  } else {
    console.log('❌ DMBA NOT FOUND in view')
    console.log('\nAll payers in view:')
    data?.forEach((p, i) => {
      console.log(`${i + 1}. ${p.payer_display_name} (${p.office_ally_payer_id})`)
    })
  }
}

checkDMBA().catch(console.error)
