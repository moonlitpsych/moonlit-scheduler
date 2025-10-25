import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const payerId = 'b9e556b7-1070-47b8-8467-ef1ee5c68e4e' // Regence BCBS

    // Check using the RPC function with future date (11/01/2025)
    const { data: futureData, error: futureError } = await supabaseAdmin
      .rpc('fn_bookable_provider_payer_asof', {
        svc_date: '2025-11-01'
      })

    const futureProviders = futureData?.filter((row: any) => row.payer_id === payerId) || []

    // Check using the view (today's date)
    const { data: todayData, error: todayError } = await supabaseAdmin
      .from('v_bookable_provider_payer')
      .select('*')
      .eq('payer_id', payerId)

    // Get provider names for both
    const allProviderIds = [
      ...new Set([
        ...(futureProviders.map((p: any) => p.provider_id)),
        ...(todayData || []).map((p: any) => p.provider_id)
      ])
    ]

    const { data: providers } = await supabaseAdmin
      .from('providers')
      .select('id, first_name, last_name')
      .in('id', allProviderIds)

    const providerMap = new Map(providers?.map(p => [p.id, `${p.first_name} ${p.last_name}`]))

    return NextResponse.json({
      success: true,
      today: {
        date: new Date().toISOString().split('T')[0],
        count: todayData?.length || 0,
        providers: todayData?.map((p: any) => ({
          name: providerMap.get(p.provider_id),
          ...p
        })),
        error: todayError?.message
      },
      future: {
        date: '2025-11-01',
        count: futureProviders.length,
        providers: futureProviders.map((p: any) => ({
          name: providerMap.get(p.provider_id),
          ...p
        })),
        error: futureError?.message
      }
    })

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
