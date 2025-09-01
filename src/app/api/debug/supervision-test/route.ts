import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    console.log('🔍 Testing supervision scenario...')

    // Get Tatiana and Privratsky provider info
    const { data: providers } = await supabaseAdmin
      .from('providers')
      .select('id, first_name, last_name')
      .in('last_name', ['Kaehler', 'Privratsky'])

    const tatiana = providers?.find(p => p.last_name === 'Kaehler')
    const privratsky = providers?.find(p => p.last_name === 'Privratsky')

    console.log('👥 Found providers:', { tatiana: tatiana?.id, privratsky: privratsky?.id })

    // Find Optum Medicaid payer
    const { data: payers } = await supabaseAdmin
      .from('payers')
      .select('id, name')
      .ilike('name', '%optum%medicaid%')

    console.log('🏥 Found Optum payers:', payers)

    // Check current network relationships
    const { data: networks } = await supabaseAdmin
      .from('provider_payer_networks')
      .select('*')
      .in('provider_id', [tatiana?.id, privratsky?.id].filter(Boolean))

    console.log('🔗 Current networks:', networks)

    return NextResponse.json({
      success: true,
      providers: { tatiana, privratsky },
      optum_payers: payers,
      current_networks: networks,
      explanation: "Shows current direct provider-payer relationships. Supervision not implemented yet."
    })

  } catch (error) {
    console.error('❌ Test failed:', error.message)
    return NextResponse.json({
      success: false,
      error: 'Test failed',
      details: error.message
    }, { status: 500 })
  }
}