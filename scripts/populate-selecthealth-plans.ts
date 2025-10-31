import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function populateSelectHealthPlans() {
  console.log('🔍 Step 1: Find SelectHealth payer_id')

  const { data: payers, error: payerError } = await supabase
    .from('payers')
    .select('id, payer_name')
    .ilike('payer_name', '%select%health%')

  if (payerError) {
    console.error('Error finding SelectHealth:', payerError)
    return
  }

  if (!payers || payers.length === 0) {
    console.error('❌ SelectHealth payer not found')
    return
  }

  const selectHealthPayerId = payers[0].id
  console.log(`✅ Found SelectHealth: ${payers[0].payer_name} (${selectHealthPayerId})`)

  console.log('\n🔍 Step 2: Find Dr. Privratsky\'s provider_id')

  const { data: providers, error: providerError } = await supabase
    .from('providers')
    .select('id, first_name, last_name')
    .ilike('last_name', '%privratsky%')

  if (providerError) {
    console.error('Error finding Dr. Privratsky:', providerError)
    return
  }

  if (!providers || providers.length === 0) {
    console.error('❌ Dr. Privratsky not found')
    return
  }

  const privratsky = providers[0]
  console.log(`✅ Found Dr. ${privratsky.first_name} ${privratsky.last_name} (${privratsky.id})`)

  console.log('\n🔍 Step 3: Find Dr. Privratsky\'s SelectHealth contract')

  const { data: contracts, error: contractError } = await supabase
    .from('provider_payer_networks')
    .select('*')
    .eq('provider_id', privratsky.id)
    .eq('payer_id', selectHealthPayerId)

  if (contractError) {
    console.error('Error finding contract:', contractError)
    return
  }

  if (!contracts || contracts.length === 0) {
    console.error('❌ No SelectHealth contract found for Dr. Privratsky')
    return
  }

  const contract = contracts[0]
  console.log(`✅ Found contract: ${contract.id}`)
  console.log(`   Status: ${contract.status}`)
  console.log(`   Effective: ${contract.effective_date}`)
  console.log(`   Expiration: ${contract.expiration_date || 'N/A'}`)

  console.log('\n🔍 Step 4: Find SelectHealth plans in payer_plans table')

  const { data: plans, error: plansError } = await supabase
    .from('payer_plans')
    .select('*')
    .eq('payer_id', selectHealthPayerId)
    .order('plan_name')

  if (plansError) {
    console.error('Error finding plans:', plansError)
    return
  }

  console.log(`\n✅ Found ${plans?.length || 0} SelectHealth plans:`)
  plans?.forEach((plan, idx) => {
    console.log(`   ${idx + 1}. ${plan.plan_name} (${plan.id})`)
    console.log(`      Active: ${plan.is_active}, Default: ${plan.is_default || false}`)
  })

  console.log('\n🔍 Step 5: Match contract plans to database plans')

  const contractPlans = [
    'Select Choice',
    'Select Care',
    'Select Med',
    'Select Value',
    'SelectHealth Share',
    'Select Access' // Medicaid/CHIP
  ]

  const matchedPlans: any[] = []
  const unmatchedPlans: string[] = []

  for (const contractPlan of contractPlans) {
    // Try exact match first
    let match = plans?.find(p => p.plan_name === contractPlan)

    // Try case-insensitive match
    if (!match) {
      match = plans?.find(p => p.plan_name.toLowerCase() === contractPlan.toLowerCase())
    }

    // Try partial match (contains)
    if (!match) {
      match = plans?.find(p =>
        p.plan_name.toLowerCase().includes(contractPlan.toLowerCase()) ||
        contractPlan.toLowerCase().includes(p.plan_name.toLowerCase())
      )
    }

    if (match) {
      matchedPlans.push({ contractPlan, dbPlan: match })
      console.log(`   ✅ "${contractPlan}" → ${match.plan_name} (${match.id})`)
    } else {
      unmatchedPlans.push(contractPlan)
      console.log(`   ❌ "${contractPlan}" → NO MATCH FOUND`)
    }
  }

  if (unmatchedPlans.length > 0) {
    console.log(`\n⚠️ WARNING: ${unmatchedPlans.length} contract plans not found in database:`)
    unmatchedPlans.forEach(p => console.log(`   - ${p}`))
    console.log('\nYou may need to add these plans to payer_plans table first.')
  }

  if (matchedPlans.length === 0) {
    console.log('\n❌ No plans matched. Cannot populate junction table.')
    return
  }

  console.log('\n🔍 Step 6: Check if junction table entries already exist')

  const { data: existingEntries, error: existingError } = await supabase
    .from('provider_payer_accepted_plans')
    .select('*')
    .eq('provider_payer_network_id', contract.id)

  if (existingError) {
    console.error('Error checking existing entries:', existingError)
    return
  }

  console.log(`   Found ${existingEntries?.length || 0} existing entries`)

  console.log('\n🔍 Step 7: Generate INSERT statements')

  const inserts = matchedPlans.map(({ dbPlan }) => ({
    provider_payer_network_id: contract.id,
    plan_id: dbPlan.id
  }))

  console.log(`\nPreparing to insert ${inserts.length} rows into provider_payer_accepted_plans:`)
  inserts.forEach((insert, idx) => {
    const planName = matchedPlans[idx].dbPlan.plan_name
    console.log(`   ${idx + 1}. Contract ${contract.id} → Plan ${insert.plan_id} (${planName})`)
  })

  console.log('\n⏸️  DRY RUN - Review the above and confirm before inserting')
  console.log('\nTo actually insert, uncomment the insert code below and run again.')

  // UNCOMMENT TO ACTUALLY INSERT:
  /*
  console.log('\n🚀 Inserting into provider_payer_accepted_plans...')

  const { data: insertData, error: insertError } = await supabase
    .from('provider_payer_accepted_plans')
    .insert(inserts)
    .select()

  if (insertError) {
    console.error('❌ Insert failed:', insertError)
    return
  }

  console.log(`✅ Successfully inserted ${insertData?.length || 0} rows`)
  insertData?.forEach((row, idx) => {
    const planName = matchedPlans[idx].dbPlan.plan_name
    console.log(`   ${idx + 1}. ${row.id} - ${planName}`)
  })
  */
}

populateSelectHealthPlans().catch(console.error)
