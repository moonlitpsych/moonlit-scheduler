import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const payerId = 'b9e556b7-1070-47b8-8467-ef1ee5c68e4e' // Regence BCBS
    const providerId = 'bc0fc904-7cc9-4d22-a094-6a0eb482128d' // Dr. Reynolds
    const appointmentDate = '2025-11-03'

    console.log('🔍 Testing trigger logic for:', { payerId, providerId, appointmentDate })

    // Test what the RPC function returns for this date
    const { data: rpcData, error: rpcError } = await supabaseAdmin
      .rpc('fn_bookable_provider_payer_asof', {
        svc_date: appointmentDate
      })

    if (rpcError) {
      return NextResponse.json({ error: rpcError.message }, { status: 500 })
    }

    // Filter to this provider and payer
    const relationship = rpcData?.find((row: any) =>
      row.provider_id === providerId && row.payer_id === payerId
    )

    // Also check the view directly (what the trigger might be using)
    const { data: viewData, error: viewError } = await supabaseAdmin
      .from('v_bookable_provider_payer')
      .select('*')
      .eq('provider_id', providerId)
      .eq('payer_id', payerId)
      .maybeSingle()

    return NextResponse.json({
      appointmentDate,
      provider: 'Dr. Reynolds',
      payer: 'Regence BCBS',
      rpcResult: {
        found: !!relationship,
        data: relationship || null
      },
      viewResult: {
        found: !!viewData,
        data: viewData || null
      },
      analysis: {
        shouldBeBookable: relationship ? 'YES - RPC returns this relationship' : 'NO - RPC does not return this relationship',
        triggerWouldBlock: !viewData ? 'YES - View returns nothing' : 'NO - View has data'
      }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
