import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    console.log('🔍 Tracing the exact source of bookable and effective dates...')

    // First, let's examine what fields are actually available in the canonical view
    const { data: viewSample, error: viewError } = await supabaseAdmin
      .from('v_bookable_provider_payer')
      .select('*')
      .limit(1)

    if (viewError) {
      console.error('❌ Error accessing canonical view:', viewError)
      return NextResponse.json({ success: false, error: viewError })
    }

    const viewFields = viewSample?.[0] ? Object.keys(viewSample[0]) : []

    console.log('📋 Available fields in v_bookable_provider_payer:', viewFields)

    // Let's also check if we can access the underlying tables that might feed this view
    const tableChecks = {
      provider_payer_networks: null,
      provider_payers: null,
      contracts: null,
      credentialing: null,
      network_agreements: null,
      provider_contracts: null,
      payer_contracts: null,
      provider_payer_contracts: null
    }

    // Check each potential table
    for (const tableName of Object.keys(tableChecks)) {
      try {
        const { data, error } = await supabaseAdmin
          .from(tableName)
          .select('*')
          .limit(1)
        
        if (!error && data) {
          tableChecks[tableName] = {
            exists: true,
            sample_fields: data[0] ? Object.keys(data[0]) : [],
            record_count_sample: data.length
          }
          console.log(`✅ Table ${tableName} exists with fields:`, data[0] ? Object.keys(data[0]) : [])
        } else {
          tableChecks[tableName] = {
            exists: false,
            error: error?.message || 'No data'
          }
        }
      } catch (err) {
        tableChecks[tableName] = {
          exists: false,
          error: err instanceof Error ? err.message : 'Unknown error'
        }
      }
    }

    // Try to get the actual view definition if possible
    let viewDefinition = null
    try {
      const { data: viewDef, error: viewDefError } = await supabaseAdmin
        .rpc('get_view_definition', { view_name: 'v_bookable_provider_payer' })
      
      if (!viewDefError) {
        viewDefinition = viewDef
      }
    } catch (err) {
      console.log('ℹ️ Could not get view definition (function may not exist)')
    }

    // Get a sample of actual data with dates
    const { data: dateSample, error: dateError } = await supabaseAdmin
      .from('v_bookable_provider_payer')
      .select(`
        provider_id,
        payer_id,
        network_status,
        effective_date,
        expiration_date,
        bookable_from_date,
        billing_provider_id,
        rendering_provider_id
      `)
      .limit(5)

    return NextResponse.json({
      success: true,
      schema_investigation: {
        canonical_view: {
          name: 'v_bookable_provider_payer',
          accessible: !viewError,
          fields: viewFields,
          date_fields: viewFields.filter(field => 
            field.includes('date') || field.includes('effective') || field.includes('bookable')
          )
        },
        underlying_tables: tableChecks,
        view_definition: viewDefinition,
        sample_data_with_dates: dateSample
      },
      date_field_locations: {
        confirmed_locations: [
          {
            source: 'v_bookable_provider_payer view',
            fields: ['effective_date', 'expiration_date', 'bookable_from_date']
          }
        ],
        potential_source_tables: Object.entries(tableChecks)
          .filter(([_, info]) => info.exists)
          .map(([tableName, info]) => ({
            table: tableName,
            fields: info.sample_fields?.filter(field => 
              field.includes('date') || field.includes('effective') || field.includes('bookable')
            ) || []
          }))
          .filter(table => table.fields.length > 0)
      }
    })

  } catch (error: any) {
    console.error('❌ Error tracing date sources:', error)
    return NextResponse.json({ success: false, error: error.message })
  }
}