// Admin API endpoint for coverage data (By Provider and By Payer views)
import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

interface CoverageItem {
  id: string
  name: string
  network_status: 'in_network' | 'supervised'
  effective_date: string | null
  expiration_date: string | null
  bookable_from_date: string | null
  supervising_attendings?: string[]
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const viewType = searchParams.get('view') // 'provider' or 'payer'
    const entityId = searchParams.get('id') // provider_id or payer_id
    const mode = searchParams.get('mode') || 'today' // 'today' or 'service_date'
    const serviceDate = searchParams.get('service_date') || new Date().toISOString().split('T')[0]

    if (!viewType || !entityId) {
      return NextResponse.json({
        error: 'Missing required parameters: view and id',
        usage: 'GET /api/admin/bookability/coverage?view=provider&id=<provider_id>&mode=today'
      }, { status: 400 })
    }

    console.log('🔍 Admin: Fetching coverage data for:', { viewType, entityId, mode, serviceDate })

    let coverageData: CoverageItem[] = []

    if (viewType === 'provider') {
      // Get all payers this provider accepts
      const { data: bookableData, error: bookableError } = await supabaseAdmin
        .from('v_bookable_provider_payer')
        .select(`
          payer_id,
          network_status,
          effective_date,
          expiration_date,
          bookable_from_date
        `)
        .eq('provider_id', entityId)

      if (bookableError) {
        console.error('❌ Error fetching provider coverage:', bookableError)
        throw bookableError
      }

      // Filter by mode and date
      const targetDate = mode === 'today' ? new Date().toISOString().split('T')[0] : serviceDate
      const filteredData = (bookableData || []).filter(row => {
        if (mode === 'today' || mode === 'service_date') {
          // Check if effective on target date
          if (row.effective_date && new Date(row.effective_date) > new Date(targetDate)) {
            return false
          }
          if (row.expiration_date && new Date(row.expiration_date) < new Date(targetDate)) {
            return false
          }
          if (row.bookable_from_date && new Date(row.bookable_from_date) > new Date(targetDate)) {
            return false
          }
        }
        return true
      })

      // Get payer names separately
      const payerIds = [...new Set(filteredData.map(row => row.payer_id))]
      const { data: payerNames, error: payerError } = await supabaseAdmin
        .from('payers')
        .select('id, name')
        .in('id', payerIds)

      if (payerError) {
        console.error('❌ Error fetching payer names:', payerError)
      }

      const payerMap = new Map((payerNames || []).map(p => [p.id, p.name]))

      coverageData = filteredData.map(row => ({
        id: row.payer_id,
        name: payerMap.get(row.payer_id) || 'Unknown Payer',
        network_status: row.network_status,
        effective_date: row.effective_date,
        expiration_date: row.expiration_date,
        bookable_from_date: row.bookable_from_date
      }))

    } else if (viewType === 'payer') {
      // Get all providers that accept this payer
      const { data: bookableData, error: bookableError } = await supabaseAdmin
        .from('v_bookable_provider_payer')
        .select(`
          provider_id,
          network_status,
          effective_date,
          expiration_date,
          bookable_from_date
        `)
        .eq('payer_id', entityId)

      if (bookableError) {
        console.error('❌ Error fetching payer coverage:', bookableError)
        throw bookableError
      }

      // Filter by mode and date
      const targetDate = mode === 'today' ? new Date().toISOString().split('T')[0] : serviceDate
      const filteredData = (bookableData || []).filter(row => {
        if (mode === 'today' || mode === 'service_date') {
          // Check if effective on target date
          if (row.effective_date && new Date(row.effective_date) > new Date(targetDate)) {
            return false
          }
          if (row.expiration_date && new Date(row.expiration_date) < new Date(targetDate)) {
            return false
          }
          if (row.bookable_from_date && new Date(row.bookable_from_date) > new Date(targetDate)) {
            return false
          }
        }
        return true
      })

      // Get provider names separately
      const providerIds = [...new Set(filteredData.map(row => row.provider_id))]
      const { data: providerNames, error: providerError } = await supabaseAdmin
        .from('providers')
        .select('id, first_name, last_name')
        .in('id', providerIds)

      if (providerError) {
        console.error('❌ Error fetching provider names:', providerError)
      }

      const providerMap = new Map((providerNames || []).map(p => [p.id, `${p.first_name} ${p.last_name}`]))

      coverageData = filteredData.map(row => ({
        id: row.provider_id,
        name: providerMap.get(row.provider_id) || 'Unknown Provider',
        network_status: row.network_status,
        effective_date: row.effective_date,
        expiration_date: row.expiration_date,
        bookable_from_date: row.bookable_from_date
      }))
    }

    console.log(`✅ Successfully fetched ${coverageData.length} coverage relationships`)

    return NextResponse.json({
      success: true,
      data: coverageData,
      metadata: {
        view_type: viewType,
        entity_id: entityId,
        mode,
        service_date: serviceDate,
        total_relationships: coverageData.length,
        direct_relationships: coverageData.filter(item => item.network_status === 'in_network').length,
        supervised_relationships: coverageData.filter(item => item.network_status === 'supervised').length
      }
    })

  } catch (error: any) {
    console.error('❌ Error in admin bookability coverage endpoint:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch coverage data',
        details: error.message
      },
      { status: 500 }
    )
  }
}