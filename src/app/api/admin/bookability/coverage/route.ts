// Admin API endpoint for coverage data (By Provider and By Payer views)
//
// MODE SELECTION:
// - mode=today (or 'bookable_today'): Uses v_bookable_provider_payer view (evaluates as of CURRENT_DATE)
// - mode=service_date (or 'schedulable_on_service_date'): Uses fn_bookable_provider_payer_asof(svc_date) RPC
//   to get bookability as of an arbitrary future/past service date
import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

interface CoverageItem {
  id: string
  name: string
  network_status: 'in_network' | 'supervised'
  effective_date: string | null
  expiration_date: string | null
  bookable_from_date: string | null
  // For supervised rows: the supervising attending (the view's billing_provider_id).
  billing_provider_id?: string | null
  supervisor_name?: string | null
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const viewType = searchParams.get('view') // 'provider' or 'payer'
    const entityId = searchParams.get('id') // provider_id or payer_id
    const modeParam = searchParams.get('mode') || 'today'
    const serviceDate = searchParams.get('service_date') || new Date().toISOString().split('T')[0]

    // Normalize mode parameter (accept both old and new naming)
    const mode = modeParam === 'bookable_today' || modeParam === 'today' ? 'today' : 'service_date'

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
      let bookableData: any[] = []
      let bookableError: any = null

      if (mode === 'service_date') {
        // Use RPC function for arbitrary service date evaluation
        const { data, error } = await supabaseAdmin.rpc('fn_bookable_provider_payer_asof', {
          svc_date: serviceDate
        })
        bookableData = data || []
        bookableError = error

        // Filter to this provider
        if (!bookableError) {
          bookableData = bookableData.filter(row => row.provider_id === entityId)
        }
      } else {
        // Use view for today's bookability (CURRENT_DATE evaluation)
        const { data, error } = await supabaseAdmin
          .from('v_bookable_provider_payer')
          .select(`
            payer_id,
            network_status,
            billing_provider_id,
            effective_date,
            expiration_date,
            bookable_from_date
          `)
          .eq('provider_id', entityId)

        bookableData = data || []
        bookableError = error
      }

      if (bookableError) {
        console.error('❌ Error fetching provider coverage:', bookableError)
        throw bookableError
      }

      // Get payer names separately
      const payerIds = [...new Set(bookableData.map(row => row.payer_id))]
      const { data: payerNames, error: payerError } = await supabaseAdmin
        .from('payers')
        .select('id, name')
        .in('id', payerIds)

      if (payerError) {
        console.error('❌ Error fetching payer names:', payerError)
      }

      const payerMap = new Map((payerNames || []).map(p => [p.id, p.name]))

      coverageData = bookableData.map(row => ({
        id: row.payer_id,
        name: payerMap.get(row.payer_id) || 'Unknown Payer',
        network_status: row.network_status,
        billing_provider_id: row.billing_provider_id ?? null,
        effective_date: row.effective_date,
        expiration_date: row.expiration_date,
        bookable_from_date: row.bookable_from_date
      }))

    } else if (viewType === 'payer') {
      // Get all providers that accept this payer
      let bookableData: any[] = []
      let bookableError: any = null

      if (mode === 'service_date') {
        // Use RPC function for arbitrary service date evaluation
        const { data, error } = await supabaseAdmin.rpc('fn_bookable_provider_payer_asof', {
          svc_date: serviceDate
        })
        bookableData = data || []
        bookableError = error

        // Filter to this payer
        if (!bookableError) {
          bookableData = bookableData.filter(row => row.payer_id === entityId)
        }
      } else {
        // Use view for today's bookability (CURRENT_DATE evaluation)
        const { data, error } = await supabaseAdmin
          .from('v_bookable_provider_payer')
          .select(`
            provider_id,
            network_status,
            billing_provider_id,
            effective_date,
            expiration_date,
            bookable_from_date
          `)
          .eq('payer_id', entityId)

        bookableData = data || []
        bookableError = error
      }

      if (bookableError) {
        console.error('❌ Error fetching payer coverage:', bookableError)
        throw bookableError
      }

      // Get provider names separately
      const providerIds = [...new Set(bookableData.map(row => row.provider_id))]
      const { data: providerNames, error: providerError } = await supabaseAdmin
        .from('providers')
        .select('id, first_name, last_name')
        .in('id', providerIds)

      if (providerError) {
        console.error('❌ Error fetching provider names:', providerError)
      }

      const providerMap = new Map((providerNames || []).map(p => [p.id, `${p.first_name} ${p.last_name}`]))

      coverageData = bookableData.map(row => ({
        id: row.provider_id,
        name: providerMap.get(row.provider_id) || 'Unknown Provider',
        network_status: row.network_status,
        billing_provider_id: row.billing_provider_id ?? null,
        effective_date: row.effective_date,
        expiration_date: row.expiration_date,
        bookable_from_date: row.bookable_from_date
      }))
    }

    // Resolve supervising-attending names — only for supervised rows. (The asof RPC
    // also populates billing_provider_id on direct rows with the provider's own id, so
    // we must gate on network_status, not just billing_provider_id being present.)
    const supervisorIds = [...new Set(
      coverageData
        .filter(r => r.network_status === 'supervised')
        .map(r => r.billing_provider_id)
        .filter((id): id is string => !!id)
    )]
    let supervisorMap = new Map<string, string>()
    if (supervisorIds.length > 0) {
      const { data: supervisors } = await supabaseAdmin
        .from('providers')
        .select('id, first_name, last_name')
        .in('id', supervisorIds)
      supervisorMap = new Map((supervisors || []).map(p => [p.id, `${p.first_name} ${p.last_name}`]))
    }
    coverageData = coverageData.map(r => ({
      ...r,
      supervisor_name: (r.network_status === 'supervised' && r.billing_provider_id)
        ? (supervisorMap.get(r.billing_provider_id) || 'Unknown')
        : null
    }))

    // Distinct active supervisors across supervised rows — answers "is there an
    // active supervisor for this payer on this date?" at a glance.
    const activeSupervisors = [...new Set(
      coverageData
        .filter(r => r.network_status === 'supervised' && r.supervisor_name)
        .map(r => r.supervisor_name as string)
    )]

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
        supervised_relationships: coverageData.filter(item => item.network_status === 'supervised').length,
        active_supervisors: activeSupervisors
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