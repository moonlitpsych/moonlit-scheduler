import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST() {
  try {
    console.log('🔄 Setting up simple supervision relationships...')

    // First, create the supervision_relationships table manually via the dashboard
    // For now, let's just create some test data to see if the concept works
    
    // Get provider IDs
    const { data: providers, error: providersError } = await supabaseAdmin
      .from('providers')
      .select('id, first_name, last_name')
      .in('last_name', ['Kaehler', 'Reynolds', 'Privratsky'])

    if (providersError) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch providers',
        details: providersError.message
      }, { status: 500 })
    }

    const tatiana = providers?.find(p => p.last_name === 'Kaehler')
    const reynolds = providers?.find(p => p.last_name === 'Reynolds') 
    const privratsky = providers?.find(p => p.last_name === 'Privratsky')

    // Get Optum payer ID  
    const { data: payers, error: payersError } = await supabaseAdmin
      .from('payers')
      .select('id, name')
      .ilike('name', '%optum%')
      .limit(5)

    if (payersError) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch payers',
        details: payersError.message
      }, { status: 500 })
    }

    // Check current provider-payer networks
    const { data: currentNetworks, error: networksError } = await supabaseAdmin
      .from('provider_payer_networks')
      .select('*')
      .eq('status', 'in_network')
      .in('provider_id', [tatiana?.id, reynolds?.id, privratsky?.id].filter(Boolean))

    if (networksError) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch current networks',
        details: networksError.message
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Data retrieved successfully',
      providers: { tatiana, reynolds, privratsky },
      optum_payers: payers,
      current_networks: currentNetworks,
      next_steps: [
        '1. Find the correct Optum Medicaid payer ID',
        '2. Check if Privratsky has direct relationship with that payer', 
        '3. Create supervision relationships for Tatiana and Reynolds',
        '4. Test the updated booking logic'
      ]
    })

  } catch (error) {
    console.error('❌ Setup failed:', error.message)
    return NextResponse.json({
      success: false,
      error: 'Setup failed',
      details: error.message
    }, { status: 500 })
  }
}