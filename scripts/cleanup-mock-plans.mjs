#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function main() {
  console.log('🧹 Cleaning up mock plan data...\n')

  // Step 1: Safety check
  console.log('1️⃣  Checking junction table...')
  const { count: junctionCount } = await supabase
    .from('provider_payer_accepted_plans')
    .select('*', { count: 'exact', head: true })

  if (junctionCount && junctionCount > 0) {
    console.error(`❌ Cannot proceed: ${junctionCount} rows in provider_payer_accepted_plans`)
    console.error('   Delete junction table entries first')
    process.exit(1)
  }
  console.log('✅ Junction table is empty\n')

  // Step 2: Find Big 3 payers
  console.log('2️⃣  Finding Big 3 payers...')
  const { data: payers } = await supabase
    .from('payers')
    .select('id, name')
    .or('name.ilike.%regence%,name.ilike.%selecthealth%,name.ilike.%aetna%')

  const payerIds = payers?.map(p => p.id) || []
  console.log(`✅ Found ${payers?.length} payers: ${payers?.map(p => p.name).join(', ')}\n`)

  // Step 3: Get plan IDs
  console.log('3️⃣  Getting plan IDs to delete...')
  const { data: plansToDelete } = await supabase
    .from('payer_plans')
    .select('id')
    .in('payer_id', payerIds)

  const planIds = plansToDelete?.map(p => p.id) || []
  console.log(`✅ Found ${planIds.length} plans to delete\n`)

  // Step 4: Delete aliases
  if (planIds.length > 0) {
    console.log('4️⃣  Deleting plan aliases...')
    const { error: aliasError, count: aliasCount } = await supabase
      .from('payer_plan_aliases')
      .delete({ count: 'exact' })
      .in('plan_id', planIds)

    if (aliasError) {
      console.error('❌ Error deleting aliases:', aliasError)
      process.exit(1)
    }
    console.log(`✅ Deleted ${aliasCount} aliases\n`)
  }

  // Step 5: Delete plans
  console.log('5️⃣  Deleting mock plans...')
  const { error: planError, count: planCount } = await supabase
    .from('payer_plans')
    .delete({ count: 'exact' })
    .in('payer_id', payerIds)

  if (planError) {
    console.error('❌ Error deleting plans:', planError)
    process.exit(1)
  }
  console.log(`✅ Deleted ${planCount} plans\n`)

  // Step 6: Delete networks
  console.log('6️⃣  Deleting mock networks...')
  const { error: networkError, count: networkCount } = await supabase
    .from('payer_networks')
    .delete({ count: 'exact' })
    .in('payer_id', payerIds)

  if (networkError) {
    console.error('❌ Error deleting networks:', networkError)
    process.exit(1)
  }
  console.log(`✅ Deleted ${networkCount} networks\n`)

  console.log('✅ Mock data cleanup complete!')
  console.log('\nNext: Run add-real-selecthealth-plans.mjs')
}

main().catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
