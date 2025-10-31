import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()

  const log: string[] = []

  try {
    // ==========================================================================
    // STEP 1: Safety check - ensure junction table is empty
    // ==========================================================================
    log.push('🔍 Step 1: Checking junction table...')

    const { count: junctionCount } = await supabase
      .from('provider_payer_accepted_plans')
      .select('*', { count: 'exact', head: true })

    if (junctionCount && junctionCount > 0) {
      return NextResponse.json({
        success: false,
        error: `Cannot proceed: ${junctionCount} rows exist in provider_payer_accepted_plans. Delete those first.`,
        log
      }, { status: 400 })
    }

    log.push('✅ Junction table is empty, safe to proceed')

    // ==========================================================================
    // STEP 2: Get Big 3 payer IDs
    // ==========================================================================
    log.push('\n🔍 Step 2: Finding Big 3 payers...')

    const { data: payers } = await supabase
      .from('payers')
      .select('id, name')
      .or('name.ilike.%regence%,name.ilike.%selecthealth%,name.ilike.%aetna%')

    const payerIds = payers?.map(p => p.id) || []
    log.push(`✅ Found ${payers?.length} payers: ${payers?.map(p => p.name).join(', ')}`)

    // ==========================================================================
    // STEP 3: Delete mock plan aliases
    // ==========================================================================
    log.push('\n🗑️  Step 3: Deleting plan aliases...')

    const { data: plansToDelete } = await supabase
      .from('payer_plans')
      .select('id')
      .in('payer_id', payerIds)

    const planIds = plansToDelete?.map(p => p.id) || []

    if (planIds.length > 0) {
      const { error: aliasDeleteError } = await supabase
        .from('payer_plan_aliases')
        .delete()
        .in('plan_id', planIds)

      if (aliasDeleteError) throw aliasDeleteError
      log.push(`✅ Deleted aliases for ${planIds.length} plans`)
    }

    // ==========================================================================
    // STEP 4: Delete mock plans
    // ==========================================================================
    log.push('\n🗑️  Step 4: Deleting mock plans...')

    const { error: plansDeleteError, count: plansDeleted } = await supabase
      .from('payer_plans')
      .delete({ count: 'exact' })
      .in('payer_id', payerIds)

    if (plansDeleteError) throw plansDeleteError
    log.push(`✅ Deleted ${plansDeleted || 0} mock plans`)

    // ==========================================================================
    // STEP 5: Delete mock networks
    // ==========================================================================
    log.push('\n🗑️  Step 5: Deleting mock networks...')

    const { error: networksDeleteError, count: networksDeleted } = await supabase
      .from('payer_networks')
      .delete({ count: 'exact' })
      .in('payer_id', payerIds)

    if (networksDeleteError) throw networksDeleteError
    log.push(`✅ Deleted ${networksDeleted || 0} mock networks`)

    // ==========================================================================
    // STEP 6: Add real SelectHealth contract plans
    // ==========================================================================
    log.push('\n📝 Step 6: Adding real SelectHealth contract plans...')

    const { data: selectHealthPayer } = await supabase
      .from('payers')
      .select('id')
      .ilike('name', '%selecthealth%')
      .single()

    if (!selectHealthPayer) {
      throw new Error('SelectHealth payer not found')
    }

    const contractPlans = [
      {
        payer_id: selectHealthPayer.id,
        plan_name: 'Select Choice',
        plan_type: 'PPO',
        is_default: true,
        is_active: true,
        effective_date: '2025-10-13',
        notes: 'From Dr. Privratsky contract, pages 23-24. Standard SelectHealth product.'
      },
      {
        payer_id: selectHealthPayer.id,
        plan_name: 'Select Care',
        plan_type: 'PPO',
        is_default: false,
        is_active: true,
        effective_date: '2025-10-13',
        notes: 'From Dr. Privratsky contract, pages 25-26'
      },
      {
        payer_id: selectHealthPayer.id,
        plan_name: 'Select Med',
        plan_type: 'PPO',
        is_default: false,
        is_active: true,
        effective_date: '2025-10-13',
        notes: 'From Dr. Privratsky contract, pages 27-28'
      },
      {
        payer_id: selectHealthPayer.id,
        plan_name: 'Select Value',
        plan_type: 'HMO',
        is_default: false,
        is_active: true,
        effective_date: '2025-10-13',
        notes: 'From Dr. Privratsky contract, page 29'
      },
      {
        payer_id: selectHealthPayer.id,
        plan_name: 'SelectHealth Share',
        plan_type: 'PPO',
        is_default: false,
        is_active: true,
        effective_date: '2025-10-13',
        notes: 'From Dr. Privratsky contract, pages 30-31. Health sharing product.'
      },
      {
        payer_id: selectHealthPayer.id,
        plan_name: 'Select Access',
        plan_type: 'Medicaid',
        is_default: false,
        is_active: true,
        effective_date: '2025-10-13',
        notes: 'From Dr. Privratsky contract, pages 32-36. Medicaid/CHIP product.'
      }
    ]

    const { data: insertedPlans, error: insertError } = await supabase
      .from('payer_plans')
      .insert(contractPlans)
      .select()

    if (insertError) throw insertError
    log.push(`✅ Added ${insertedPlans?.length} real SelectHealth contract plans`)

    // ==========================================================================
    // STEP 7: Add plan aliases
    // ==========================================================================
    log.push('\n📝 Step 7: Adding plan aliases...')

    const aliases: any[] = []

    insertedPlans?.forEach(plan => {
      const planAliases = getPlanAliases(plan.id, plan.plan_name)
      aliases.push(...planAliases)
    })

    const { error: aliasInsertError } = await supabase
      .from('payer_plan_aliases')
      .insert(aliases)

    if (aliasInsertError) throw aliasInsertError
    log.push(`✅ Added ${aliases.length} plan aliases`)

    // ==========================================================================
    // VERIFICATION
    // ==========================================================================
    log.push('\n🔍 Verification:')

    const { count: finalPlanCount } = await supabase
      .from('payer_plans')
      .select('*', { count: 'exact', head: true })
      .eq('payer_id', selectHealthPayer.id)

    const { count: finalAliasCount } = await supabase
      .from('payer_plan_aliases')
      .select('*', { count: 'exact', head: true })
      .in('plan_id', insertedPlans?.map(p => p.id) || [])

    log.push(`   SelectHealth plans: ${finalPlanCount}`)
    log.push(`   Plan aliases: ${finalAliasCount}`)

    return NextResponse.json({
      success: true,
      message: 'Mock data deleted, real contract data added',
      log,
      summary: {
        deleted: {
          networks: networksDeleted,
          plans: plansDeleted
        },
        added: {
          plans: insertedPlans?.length,
          aliases: aliases.length
        }
      }
    })
  } catch (error: any) {
    log.push(`\n❌ Error: ${error.message}`)
    return NextResponse.json({
      success: false,
      error: error.message,
      log
    }, { status: 500 })
  }
}

function getPlanAliases(planId: string, planName: string): any[] {
  const aliasMap: Record<string, string[]> = {
    'Select Choice': [
      'SelectHealth Choice',
      'Select Choice',
      'SELECTHEALTH CHOICE',
      'CHOICE'
    ],
    'Select Care': [
      'SelectHealth Care',
      'Select Care',
      'SELECTHEALTH CARE',
      'CARE'
    ],
    'Select Med': [
      'SelectHealth Med',
      'Select Med',
      'SELECTHEALTH MED',
      'MED'
    ],
    'Select Value': [
      'SelectHealth Value',
      'Select Value',
      'SELECTHEALTH VALUE',
      'VALUE'
    ],
    'SelectHealth Share': [
      'SelectHealth Share',
      'SELECTHEALTH SHARE',
      'SHARE'
    ],
    'Select Access': [
      'SelectHealth Access',
      'Select Access',
      'SELECTHEALTH ACCESS',
      'ACCESS',
      'SelectHealth Medicaid',
      'SelectHealth CHIP'
    ]
  }

  const aliasStrings = aliasMap[planName] || []
  const priorities = [100, 100, 90, 70, 85, 85]

  return aliasStrings.map((alias, idx) => ({
    plan_id: planId,
    alias_string: alias,
    source: alias === alias.toUpperCase() ? '271_response' : 'insurance_card',
    priority: priorities[idx] || 70,
    is_active: true
  }))
}
