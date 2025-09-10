import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    console.log('🔍 Examining the actual source table: provider_payer_networks...')

    // Get data directly from the source table
    const { data: sourceData, error: sourceError } = await supabaseAdmin
      .from('provider_payer_networks')
      .select(`
        id,
        provider_id,
        payer_id,
        effective_date,
        expiration_date,
        bookable_from_date,
        status,
        notes,
        created_at,
        updated_at
      `)
      .order('effective_date', { ascending: false })
      .limit(10)

    if (sourceError) {
      console.error('❌ Error accessing provider_payer_networks:', sourceError)
      return NextResponse.json({ success: false, error: sourceError })
    }

    // Also get a count of total records
    const { count, error: countError } = await supabaseAdmin
      .from('provider_payer_networks')
      .select('*', { count: 'exact', head: true })

    // Compare with canonical view to see if they match
    const { data: viewData, error: viewError } = await supabaseAdmin
      .from('v_bookable_provider_payer')
      .select(`
        provider_id,
        payer_id,
        effective_date,
        expiration_date,
        bookable_from_date
      `)
      .order('effective_date', { ascending: false })
      .limit(5)

    return NextResponse.json({
      success: true,
      investigation: {
        source_table: {
          name: 'provider_payer_networks',
          total_records: count,
          sample_data: sourceData,
          date_fields_found: ['effective_date', 'expiration_date', 'bookable_from_date']
        },
        canonical_view: {
          name: 'v_bookable_provider_payer', 
          sample_data: viewData
        },
        date_analysis: {
          source_dates: sourceData?.map(record => ({
            effective_date: record.effective_date,
            bookable_from_date: record.bookable_from_date,
            created_at: record.created_at,
            updated_at: record.updated_at,
            status: record.status
          })) || [],
          view_dates: viewData?.map(record => ({
            effective_date: record.effective_date,
            bookable_from_date: record.bookable_from_date
          })) || []
        }
      },
      schema_location: {
        exact_table: 'provider_payer_networks',
        exact_fields: {
          effective_date: 'DATE field - when the network relationship becomes effective',
          expiration_date: 'DATE field - when the network relationship expires (nullable)',
          bookable_from_date: 'DATE field - when patients can start booking (may differ from effective)'
        },
        view_relationship: 'v_bookable_provider_payer view pulls from provider_payer_networks table'
      }
    })

  } catch (error: any) {
    console.error('❌ Error examining source table:', error)
    return NextResponse.json({ success: false, error: error.message })
  }
}