import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    console.log('🔍 Analyzing supervision-based booking...')

    // First, get Reynolds and Privratsky provider IDs
    const { data: providers } = await supabaseAdmin
      .from('providers')
      .select('id, first_name, last_name, role')
      .in('last_name', ['Reynolds', 'Privratsky'])

    const reynolds = providers?.find(p => p.last_name === 'Reynolds')
    const privratsky = providers?.find(p => p.last_name === 'Privratsky')

    console.log('👥 Found providers:', { reynolds: reynolds?.id, privratsky: privratsky?.id })

    // Check all records in bookable view
    const { data: allBookable } = await supabaseAdmin
      .from('v_bookable_provider_payer')
      .select('*')
      .order('provider_id')

    // Find supervision relationships
    const supervisionCases = allBookable?.filter(record => 
      record.billing_provider_id !== record.provider_id || 
      record.rendering_provider_id !== null
    )

    // Check if Reynolds is bookable with payers where Privratsky is the billing provider
    const reynoldsBookable = allBookable?.filter(record => 
      record.provider_id === reynolds?.id
    )

    const privatskyBilling = allBookable?.filter(record => 
      record.billing_provider_id === privratsky?.id && record.provider_id !== privratsky?.id
    )

    // Get payer names for context
    const payerIds = [...new Set(allBookable?.map(r => r.payer_id) || [])]
    const { data: payers } = await supabaseAdmin
      .from('payers')
      .select('id, name')
      .in('id', payerIds.slice(0, 10)) // Limit for performance

    const payerMap = Object.fromEntries(payers?.map(p => [p.id, p.name]) || [])

    // Analyze current booking API logic
    const { data: currentNetworks } = await supabaseAdmin
      .from('provider_payer_networks')
      .select('provider_id, payer_id, status')
      .eq('status', 'in_network')
      .in('provider_id', [reynolds?.id, privratsky?.id].filter(Boolean))

    return NextResponse.json({
      success: true,
      providers: { reynolds, privratsky },
      analysis: {
        totalBookableRecords: allBookable?.length || 0,
        supervisionCases: supervisionCases?.length || 0,
        reynoldsBookableWith: reynoldsBookable?.length || 0,
        privatskySupervising: privatskyBilling?.length || 0
      },
      examples: {
        supervisionCases: supervisionCases?.slice(0, 3).map(r => ({
          ...r,
          payer_name: payerMap[r.payer_id] || 'Unknown'
        })),
        reynoldsBookable: reynoldsBookable?.map(r => ({
          ...r,
          payer_name: payerMap[r.payer_id] || 'Unknown'
        })),
        privatskySupervising: privatskyBilling?.map(r => ({
          ...r,
          payer_name: payerMap[r.payer_id] || 'Unknown'
        }))
      },
      currentNetworkLogic: {
        reynoldsDirectNetworks: currentNetworks?.filter(n => n.provider_id === reynolds?.id).length || 0,
        privatskyDirectNetworks: currentNetworks?.filter(n => n.provider_id === privratsky?.id).length || 0
      }
    })

  } catch (error) {
    console.error('❌ Analysis failed:', error.message)
    return NextResponse.json({
      success: false,
      error: 'Analysis failed',
      details: error.message
    }, { status: 500 })
  }
}