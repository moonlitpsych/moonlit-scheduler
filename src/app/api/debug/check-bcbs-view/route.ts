import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Find Regence BCBS payer
    const { data: payers, error: payerError } = await supabaseAdmin
      .from('payers')
      .select('id, name')
      .or('name.ilike.%regence%,name.ilike.%bluecross%,name.ilike.%bcbs%')

    if (payerError) throw payerError

    console.log('Found payers:', payers)

    if (!payers || payers.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No BCBS payers found'
      })
    }

    const regencePayer = payers.find(p => p.name.includes('Regence'))

    if (!regencePayer) {
      return NextResponse.json({
        success: false,
        message: 'Regence payer not found',
        payers
      })
    }

    // Check v_bookable_provider_payer view
    const { data: viewData, error: viewError } = await supabaseAdmin
      .from('v_bookable_provider_payer')
      .select('*')
      .eq('payer_id', regencePayer.id)

    console.log('View query result:', { viewData, viewError })

    // Check direct contracts
    const { data: directContracts, error: directError } = await supabaseAdmin
      .from('provider_contracts')
      .select(`
        *,
        providers (first_name, last_name)
      `)
      .eq('payer_id', regencePayer.id)
      .eq('is_active', true)

    // Check supervision relationships
    const { data: supervisionData, error: supervisionError } = await supabaseAdmin
      .from('provider_supervision_relationships')
      .select(`
        *,
        rendering:providers!rendering_provider_id (first_name, last_name),
        billing:providers!billing_provider_id (first_name, last_name)
      `)
      .eq('payer_id', regencePayer.id)
      .eq('is_active', true)

    return NextResponse.json({
      success: true,
      payer: regencePayer,
      viewResults: {
        count: viewData?.length || 0,
        data: viewData,
        error: viewError
      },
      directContracts: {
        count: directContracts?.length || 0,
        data: directContracts,
        error: directError
      },
      supervisionRelationships: {
        count: supervisionData?.length || 0,
        data: supervisionData,
        error: supervisionError
      }
    })

  } catch (error: any) {
    console.error('Debug endpoint error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
