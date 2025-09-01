import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    console.log('🔍 Checking v_bookable_provider_payer view...')

    // Try to query the view
    const { data: viewData, error: viewError } = await supabaseAdmin
      .from('v_bookable_provider_payer')
      .select('*')
      .limit(10)

    if (viewError) {
      console.error('❌ Error accessing view:', viewError)
      
      // Check if the view exists in the schema
      const { data: tables, error: tablesError } = await supabaseAdmin
        .rpc('get_table_list', {})
        .single()

      return NextResponse.json({
        success: false,
        error: 'View not accessible',
        details: viewError,
        availableTables: tables || 'Could not fetch table list'
      })
    }

    console.log(`✅ Found ${viewData?.length || 0} records in v_bookable_provider_payer`)

    // Get a sample to understand structure
    const sampleRecord = viewData?.[0]
    
    // Look for Reynolds and Privratsky specifically
    const { data: reynoldsData } = await supabaseAdmin
      .from('v_bookable_provider_payer')
      .select('*')
      .ilike('provider_name', '%reynolds%')

    const { data: privatskyData } = await supabaseAdmin
      .from('v_bookable_provider_payer')
      .select('*')
      .ilike('provider_name', '%privratsky%')

    return NextResponse.json({
      success: true,
      totalRecords: viewData?.length || 0,
      sampleRecord,
      viewStructure: sampleRecord ? Object.keys(sampleRecord) : [],
      reynoldsRecords: reynoldsData?.length || 0,
      privatskyRecords: privatskyData?.length || 0,
      reynoldsSample: reynoldsData?.[0] || null,
      privatskySample: privatskyData?.[0] || null
    })

  } catch (error) {
    console.error('❌ Check failed:', error.message)
    return NextResponse.json({
      success: false,
      error: 'Check failed',
      details: error.message
    }, { status: 500 })
  }
}