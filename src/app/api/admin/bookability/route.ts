// Admin API endpoint for bookability data
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export interface BookabilityRow {
  provider_id: string
  provider_first_name: string
  provider_last_name: string
  payer_id: string
  payer_name: string
  network_status: 'in_network' | 'supervised'
  billing_provider_id: string | null
  rendering_provider_id: string | null
  rendering_provider_id_effective: string | null
  state: string | null
  effective_date: string | null
  expiration_date: string | null
  bookable_from_date: string | null
  requires_attending?: boolean
}

export async function GET() {
  try {
    console.log('🔍 Admin: Fetching bookability data from corrected view...')

    // Try the corrected view first, fallback to original if needed
    let viewData, viewError, usingCorrectedView = true

    const correctedViewResult = await supabaseAdmin
      .from('v_bookable_provider_payer_corrected')
      .select(`
        provider_id,
        payer_id,
        network_status,
        billing_provider_id,
        rendering_provider_id,
        rendering_provider_id_effective,
        state,
        effective_date,
        expiration_date,
        bookable_from_date
      `)

    if (correctedViewResult.error) {
      console.log('⚠️ Corrected view not available, falling back to original view...')
      usingCorrectedView = false

      const originalViewResult = await supabaseAdmin
        .from('v_bookable_provider_payer')
        .select(`
          provider_id,
          payer_id,
          network_status,
          billing_provider_id,
          rendering_provider_id,
          state,
          effective_date,
          expiration_date,
          bookable_from_date
        `)

      viewData = originalViewResult.data
      viewError = originalViewResult.error
    } else {
      viewData = correctedViewResult.data
      viewError = correctedViewResult.error
    }

    console.log(`📊 Using ${usingCorrectedView ? 'corrected' : 'original'} bookability view`)

    if (viewError) {
      console.error('❌ Error fetching from canonical view:', viewError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch bookability relationships', details: viewError },
        { status: 500 }
      )
    }

    if (!viewData || viewData.length === 0) {
      console.log('⚠️ No bookability relationships found')
      return NextResponse.json({
        success: true,
        data: [],
        total: 0,
        debug_info: {
          message: 'No bookability relationships found in canonical view'
        }
      })
    }

    console.log(`✅ Found ${viewData.length} bookability relationships from canonical view`)

    // Get unique provider and payer IDs for name resolution
    const uniqueProviderIds = [...new Set(viewData.map(row => row.provider_id))]
    const uniquePayerIds = [...new Set(viewData.map(row => row.payer_id))]

    // Fetch provider names
    const { data: providers, error: providerError } = await supabaseAdmin
      .from('providers')
      .select('id, first_name, last_name')
      .in('id', uniqueProviderIds)

    if (providerError) {
      console.error('❌ Error fetching provider names:', providerError)
    }

    // Fetch payer names and requires_attending
    const { data: payers, error: payerError } = await supabaseAdmin
      .from('payers')
      .select('id, name, requires_attending')
      .in('id', uniquePayerIds)

    if (payerError) {
      console.error('❌ Error fetching payer data:', payerError)
    }

    // Create lookup maps
    const providerMap = new Map((providers || []).map(p => [p.id, p]))
    const payerMap = new Map((payers || []).map(p => [p.id, p]))

    // Transform data to our interface
    const transformedData: BookabilityRow[] = viewData.map(row => {
      const provider = providerMap.get(row.provider_id)
      const payer = payerMap.get(row.payer_id)

      return {
        provider_id: row.provider_id,
        provider_first_name: provider?.first_name || 'Unknown',
        provider_last_name: provider?.last_name || 'Provider',
        payer_id: row.payer_id,
        payer_name: payer?.name || 'Unknown Payer',
        network_status: row.network_status,
        billing_provider_id: row.billing_provider_id,
        rendering_provider_id: row.rendering_provider_id,
        rendering_provider_id_effective: usingCorrectedView ? row.rendering_provider_id_effective : row.rendering_provider_id,
        state: row.state,
        effective_date: row.effective_date,
        expiration_date: row.expiration_date,
        bookable_from_date: row.bookable_from_date,
        requires_attending: payer?.requires_attending || false
      }
    })

    console.log(`✅ Successfully transformed ${transformedData.length} bookability relationships`)
    
    // Log some sample data for debugging
    const supervisionCount = transformedData.filter(row => row.network_status === 'supervised').length
    const directCount = transformedData.filter(row => row.network_status === 'in_network').length
    const requiresAttendingCount = transformedData.filter(row => row.requires_attending).length

    console.log(`📊 Bookability breakdown:`, {
      total: transformedData.length,
      direct: directCount,
      supervised: supervisionCount,
      requires_attending: requiresAttendingCount
    })

    return NextResponse.json({
      success: true,
      data: transformedData,
      total: transformedData.length,
      debug_info: {
        canonical_view_records: viewData.length,
        providers_found: providers?.length || 0,
        payers_found: payers?.length || 0,
        breakdown: {
          direct: directCount,
          supervised: supervisionCount,
          requires_attending: requiresAttendingCount
        }
      }
    })

  } catch (error: any) {
    console.error('❌ Error in admin bookability endpoint:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch bookability data', 
        details: error.message 
      },
      { status: 500 }
    )
  }
}