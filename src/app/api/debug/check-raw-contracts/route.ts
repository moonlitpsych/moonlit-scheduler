import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const payerId = 'b9e556b7-1070-47b8-8467-ef1ee5c68e4e' // Regence BCBS
    const today = new Date().toISOString().split('T')[0]

    // Check payer_contracts table
    const { data: contracts, error: contractError } = await supabaseAdmin
      .from('payer_contracts')
      .select(`
        *,
        provider:providers!provider_id (
          id, first_name, last_name, is_active, is_bookable, accepts_new_patients
        )
      `)
      .eq('payer_id', payerId)
      .eq('is_active', true)

    // Check supervision_relationships table
    const { data: supervisions, error: supervisionError } = await supabaseAdmin
      .from('supervision_relationships')
      .select(`
        *,
        rendering:providers!rendering_provider_id (
          id, first_name, last_name, is_active, is_bookable, accepts_new_patients
        ),
        billing:providers!billing_provider_id (
          id, first_name, last_name, is_active, is_bookable
        )
      `)
      .eq('payer_id', payerId)
      .eq('is_active', true)

    return NextResponse.json({
      success: true,
      today,
      directContracts: {
        count: contracts?.length || 0,
        data: contracts,
        error: contractError?.message
      },
      supervisions: {
        count: supervisions?.length || 0,
        data: supervisions,
        error: supervisionError?.message
      },
      summary: {
        total: (contracts?.length || 0) + (supervisions?.length || 0),
        direct: contracts?.length || 0,
        supervised: supervisions?.length || 0
      }
    })

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
