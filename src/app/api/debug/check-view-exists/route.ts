import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Query pg_views to see if the view exists and get its definition
    const { data: viewInfo, error: viewError } = await supabaseAdmin
      .from('pg_views')
      .select('*')
      .eq('viewname', 'v_bookable_provider_payer')
      .single()

    if (viewError) {
      return NextResponse.json({
        success: false,
        exists: false,
        error: viewError.message
      })
    }

    // Try to query the view directly with no filters
    const { data: allData, error: queryError } = await supabaseAdmin
      .from('v_bookable_provider_payer')
      .select('*')
      .limit(10)

    // Query for Regence BCBS specifically (no date filter!)
    const payerId = 'b9e556b7-1070-47b8-8467-ef1ee5c68e4e'
    const { data: bcbsData, error: bcbsError } = await supabaseAdmin
      .from('v_bookable_provider_payer')
      .select('*')
      .eq('payer_id', payerId)

    return NextResponse.json({
      success: true,
      view: {
        exists: !!viewInfo,
        definition: viewInfo?.definition,
        schemaname: viewInfo?.schemaname
      },
      sampleData: {
        count: allData?.length || 0,
        data: allData
      },
      regenceBCBS: {
        count: bcbsData?.length || 0,
        data: bcbsData,
        error: bcbsError?.message
      }
    })

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
