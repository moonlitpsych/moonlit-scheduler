import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const supabase = await createServerClient()

  const results: any = {
    step1_payer: null,
    step2_provider: null,
    step3_contract: null,
    step4_plans: [],
    step5_matches: [],
    step6_existing: [],
    step7_inserts: []
  }

  try {
    // Step 1: Find SelectHealth payer_id
    const { data: payers, error: payerError } = await supabase
      .from('payers')
      .select('id, name')
      .ilike('name', '%select%health%')

    if (payerError) throw payerError
    if (!payers || payers.length === 0) {
      return NextResponse.json({ error: 'SelectHealth payer not found' }, { status: 404 })
    }

    results.step1_payer = payers[0]
    const selectHealthPayerId = payers[0].id

    // Step 2: Find Dr. Privratsky's provider_id
    const { data: providers, error: providerError } = await supabase
      .from('providers')
      .select('id, first_name, last_name')
      .ilike('last_name', '%privratsky%')

    if (providerError) throw providerError
    if (!providers || providers.length === 0) {
      return NextResponse.json({ error: 'Dr. Privratsky not found' }, { status: 404 })
    }

    results.step2_provider = providers[0]
    const privratsky = providers[0]

    // Step 3: Find Dr. Privratsky's SelectHealth contract
    const { data: contracts, error: contractError } = await supabase
      .from('provider_payer_networks')
      .select('*')
      .eq('provider_id', privratsky.id)
      .eq('payer_id', selectHealthPayerId)

    if (contractError) throw contractError
    if (!contracts || contracts.length === 0) {
      return NextResponse.json({ error: 'No SelectHealth contract found for Dr. Privratsky' }, { status: 404 })
    }

    results.step3_contract = contracts[0]
    const contract = contracts[0]

    // Step 4: Find SelectHealth plans in payer_plans table
    const { data: plans, error: plansError } = await supabase
      .from('payer_plans')
      .select('*')
      .eq('payer_id', selectHealthPayerId)
      .order('plan_name')

    if (plansError) throw plansError

    results.step4_plans = plans || []

    // Step 5: Match contract plans to database plans
    const contractPlans = [
      'Select Choice',
      'Select Care',
      'Select Med',
      'Select Value',
      'SelectHealth Share',
      'Select Access' // Medicaid/CHIP
    ]

    const matches: any[] = []
    const unmatched: string[] = []

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
        matches.push({
          contractPlan,
          dbPlan: {
            id: match.id,
            plan_name: match.plan_name,
            is_active: match.is_active,
            is_default: match.is_default
          }
        })
      } else {
        unmatched.push(contractPlan)
      }
    }

    results.step5_matches = {
      matched: matches,
      unmatched
    }

    // Step 6: Check if junction table entries already exist
    const { data: existingEntries, error: existingError } = await supabase
      .from('provider_payer_accepted_plans')
      .select('*')
      .eq('provider_payer_network_id', contract.id)

    if (existingError) throw existingError

    results.step6_existing = existingEntries || []

    // Step 7: Generate INSERT statements
    const inserts = matches.map(({ dbPlan }) => ({
      provider_payer_network_id: contract.id,
      plan_id: dbPlan.id,
      plan_name_for_reference: dbPlan.plan_name // Not inserted, just for display
    }))

    results.step7_inserts = inserts

    return NextResponse.json({
      success: true,
      summary: {
        payer: results.step1_payer.name,
        provider: `${results.step2_provider.first_name} ${results.step2_provider.last_name}`,
        contract_id: results.step3_contract.id,
        contract_status: results.step3_contract.status,
        total_selecthealth_plans: results.step4_plans.length,
        matched_plans: matches.length,
        unmatched_plans: unmatched.length,
        existing_entries: results.step6_existing.length,
        ready_to_insert: inserts.length
      },
      details: results
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      details: results
    }, { status: 500 })
  }
}
