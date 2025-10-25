import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const payerId = 'b9e556b7-1070-47b8-8467-ef1ee5c68e4e' // Regence BCBS

    // Try the correct table name: payer_contracts
    const { data: payerContracts, error: contractError } = await supabaseAdmin
      .from('payer_contracts')
      .select(`
        *,
        providers (first_name, last_name, is_active, is_bookable, accepts_new_patients)
      `)
      .eq('payer_id', payerId)

    // Try supervision_relationships
    const { data: supervisionRels, error: supervisionError } = await supabaseAdmin
      .from('supervision_relationships')
      .select(`
        *,
        rendering:providers!rendering_provider_id (first_name, last_name, is_active, is_bookable),
        billing:providers!billing_provider_id (first_name, last_name, is_active, is_bookable)
      `)
      .eq('payer_id', payerId)

    // Check if view exists
    const { data: viewCheck, error: viewError } = await supabaseAdmin
      .from('v_bookable_provider_payer')
      .select('*')
      .limit(1)

    return NextResponse.json({
      success: true,
      payerContracts: {
        count: payerContracts?.length || 0,
        data: payerContracts,
        error: contractError?.message
      },
      supervisionRelationships: {
        count: supervisionRels?.length || 0,
        data: supervisionRels,
        error: supervisionError?.message
      },
      viewExists: {
        exists: !viewError,
        error: viewError?.message,
        sampleData: viewCheck
      }
    })

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
