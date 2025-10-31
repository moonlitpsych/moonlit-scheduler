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

// Real SelectHealth plans from Dr. Privratsky's contract (signed 10/13/2025)
const CONTRACT_PLANS = [
  {
    plan_name: 'Select Choice',
    plan_type: 'PPO',
    is_default: true,
    notes: 'From Dr. Privratsky contract, pages 23-24. Standard SelectHealth product.',
    aliases: ['SelectHealth Choice', 'Select Choice', 'SELECTHEALTH CHOICE', 'CHOICE']
  },
  {
    plan_name: 'Select Care',
    plan_type: 'PPO',
    is_default: false,
    notes: 'From Dr. Privratsky contract, pages 25-26',
    aliases: ['SelectHealth Care', 'Select Care', 'SELECTHEALTH CARE', 'CARE']
  },
  {
    plan_name: 'Select Med',
    plan_type: 'PPO',
    is_default: false,
    notes: 'From Dr. Privratsky contract, pages 27-28',
    aliases: ['SelectHealth Med', 'Select Med', 'SELECTHEALTH MED', 'MED']
  },
  {
    plan_name: 'Select Value',
    plan_type: 'HMO',
    is_default: false,
    notes: 'From Dr. Privratsky contract, page 29',
    aliases: ['SelectHealth Value', 'Select Value', 'SELECTHEALTH VALUE', 'VALUE']
  },
  {
    plan_name: 'SelectHealth Share',
    plan_type: 'PPO',
    is_default: false,
    notes: 'From Dr. Privratsky contract, pages 30-31. Health sharing product.',
    aliases: ['SelectHealth Share', 'SELECTHEALTH SHARE', 'SHARE']
  },
  {
    plan_name: 'Select Access',
    plan_type: 'Medicaid',
    is_default: false,
    notes: 'From Dr. Privratsky contract, pages 32-36. Medicaid/CHIP product.',
    aliases: ['SelectHealth Access', 'Select Access', 'SELECTHEALTH ACCESS', 'ACCESS', 'SelectHealth Medicaid', 'SelectHealth CHIP']
  }
]

async function main() {
  console.log('📝 Adding real SelectHealth contract plans...\n')

  // Step 1: Find SelectHealth payer
  console.log('1️⃣  Finding SelectHealth payer...')
  const { data: selectHealthPayer, error: payerError } = await supabase
    .from('payers')
    .select('id, name')
    .ilike('name', '%selecthealth%')
    .single()

  if (payerError || !selectHealthPayer) {
    console.error('❌ SelectHealth payer not found:', payerError)
    process.exit(1)
  }
  console.log(`✅ Found ${selectHealthPayer.name} (${selectHealthPayer.id})\n`)

  // Step 2: Insert plans
  console.log('2️⃣  Inserting SelectHealth contract plans...')

  const plansToInsert = CONTRACT_PLANS.map(plan => ({
    payer_id: selectHealthPayer.id,
    plan_name: plan.plan_name,
    plan_type: plan.plan_type,
    is_default: plan.is_default,
    is_active: true,
    effective_date: '2025-10-13', // Contract effective date
    notes: plan.notes
  }))

  const { data: insertedPlans, error: insertError } = await supabase
    .from('payer_plans')
    .insert(plansToInsert)
    .select()

  if (insertError) {
    console.error('❌ Error inserting plans:', insertError)
    process.exit(1)
  }
  console.log(`✅ Inserted ${insertedPlans.length} plans\n`)

  insertedPlans.forEach((plan, idx) => {
    console.log(`   ${idx + 1}. ${plan.plan_name} (${plan.plan_type})${plan.is_default ? ' [DEFAULT]' : ''}`)
  })

  // Step 3: Insert aliases
  console.log('\n3️⃣  Inserting plan aliases...')

  const aliasesToInsert = []
  const priorities = [100, 100, 90, 70, 85, 85]

  insertedPlans.forEach((plan, planIdx) => {
    const planConfig = CONTRACT_PLANS.find(p => p.plan_name === plan.plan_name)
    if (!planConfig) return

    planConfig.aliases.forEach((alias, aliasIdx) => {
      aliasesToInsert.push({
        plan_id: plan.id,
        alias_string: alias,
        source: alias === alias.toUpperCase() ? '271_response' : 'insurance_card',
        priority: priorities[aliasIdx] || 70,
        is_active: true
      })
    })
  })

  const { error: aliasError } = await supabase
    .from('payer_plan_aliases')
    .insert(aliasesToInsert)

  if (aliasError) {
    console.error('❌ Error inserting aliases:', aliasError)
    process.exit(1)
  }
  console.log(`✅ Inserted ${aliasesToInsert.length} aliases\n`)

  // Verification
  console.log('4️⃣  Verification:')
  const { count: planCount } = await supabase
    .from('payer_plans')
    .select('*', { count: 'exact', head: true })
    .eq('payer_id', selectHealthPayer.id)

  const { count: aliasCount } = await supabase
    .from('payer_plan_aliases')
    .select('*', { count: 'exact', head: true })
    .in('plan_id', insertedPlans.map(p => p.id))

  console.log(`   SelectHealth plans in DB: ${planCount}`)
  console.log(`   Plan aliases in DB: ${aliasCount}`)

  console.log('\n✅ Real SelectHealth contract data added successfully!')
  console.log('\nNext: Populate provider_payer_accepted_plans junction table')
}

main().catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
