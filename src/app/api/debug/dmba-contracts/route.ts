import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    // Find DMBA payer
    const { data: dmba, error: payerError } = await supabaseAdmin
      .from('payers')
      .select('id, name, payer_type, state, requires_individual_contract, requires_attending, allows_supervised')
      .or('name.ilike.%DMBA%,name.ilike.%deseret%')
      .single()

    if (payerError || !dmba) {
      return NextResponse.json({
        success: false,
        error: 'DMBA payer not found',
        details: payerError
      })
    }

    // Get existing contracts for this payer
    const { data: contracts, error: contractsError } = await supabaseAdmin
      .from('provider_payer_networks')
      .select(`
        id,
        provider_id,
        payer_id,
        status,
        effective_date,
        expiration_date,
        network_id,
        plan_id,
        providers (
          id,
          first_name,
          last_name,
          email,
          is_active,
          is_bookable
        )
      `)
      .eq('payer_id', dmba.id)
      .order('effective_date', { ascending: false })

    // Get all active providers
    const { data: allProviders, error: providersError } = await supabaseAdmin
      .from('providers')
      .select('id, first_name, last_name, email, is_active, is_bookable')
      .eq('is_active', true)
      .order('last_name', { ascending: true })

    // Determine which providers DON'T have DMBA contracts
    const providerIdsWithContracts = new Set(
      contracts?.map(c => c.provider_id) || []
    )

    const providersWithoutDMBA = allProviders?.filter(p =>
      !providerIdsWithContracts.has(p.id)
    ) || []

    return NextResponse.json({
      success: true,
      dmba_payer: dmba,
      existing_contracts: {
        count: contracts?.length || 0,
        contracts: contracts?.map(c => ({
          provider_name: `${c.providers?.first_name} ${c.providers?.last_name}`,
          status: c.status,
          effective_date: c.effective_date,
          has_network: !!c.network_id,
          has_plan: !!c.plan_id
        }))
      },
      providers_without_dmba: {
        count: providersWithoutDMBA.length,
        providers: providersWithoutDMBA.map(p => ({
          id: p.id,
          name: `${p.first_name} ${p.last_name}`,
          email: p.email,
          is_bookable: p.is_bookable
        }))
      },
      all_active_providers_count: allProviders?.length || 0
    })
  } catch (error: any) {
    console.error('Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
