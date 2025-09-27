// Admin API endpoint for bookability health data
import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

interface HealthMetric {
  provider_id?: string
  provider_name?: string
  payer_id?: string
  payer_name?: string
  effective_date?: string
  expiration_date?: string
  updated_at?: string
}

interface HealthData {
  providers_zero_payers: HealthMetric[]
  payers_zero_providers: HealthMetric[]
  contracts_expiring: {
    days_30: HealthMetric[]
    days_60: HealthMetric[]
    days_90: HealthMetric[]
  }
  providers_no_contracts: HealthMetric[]
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const targetDate = searchParams.get('date') || new Date().toISOString().split('T')[0]

    console.log('🔍 Admin: Fetching bookability health data for date:', targetDate)

    // 1. Providers with zero bookable payers (today)
    const providersZeroPayersQuery = `
      WITH bookable_today AS (
        SELECT DISTINCT provider_id
        FROM public.v_bookable_provider_payer
        WHERE bookable_from_date IS NULL OR bookable_from_date <= $1::date
      )
      SELECT p.id AS provider_id,
             p.first_name || ' ' || p.last_name AS provider_name
      FROM public.providers p
      WHERE p.is_active = TRUE
        AND p.is_bookable = TRUE
        AND p.accepts_new_patients = TRUE
        AND NOT EXISTS (SELECT 1 FROM bookable_today bt WHERE bt.provider_id = p.id)
      ORDER BY provider_name;
    `

    // 2. Payers with zero accepting providers (today)
    const payersZeroProvidersQuery = `
      WITH bookable_today AS (
        SELECT DISTINCT payer_id, provider_id
        FROM public.v_bookable_provider_payer
        WHERE bookable_from_date IS NULL OR bookable_from_date <= $1::date
      )
      SELECT pay.id AS payer_id, pay.name AS payer_name
      FROM public.payers pay
      WHERE pay.status_code IN ('approved','active')
        AND NOT EXISTS (
          SELECT 1 FROM bookable_today bt WHERE bt.payer_id = pay.id
        )
      ORDER BY payer_name;
    `

    // 3. Contracts expiring (30/60/90 days)
    const contractsExpiringQuery = `
      SELECT
        ppn.provider_id,
        pr.first_name || ' ' || pr.last_name AS provider_name,
        ppn.payer_id,
        pay.name AS payer_name,
        ppn.effective_date,
        ppn.expiration_date,
        ppn.updated_at,
        ppn.expiration_date - CURRENT_DATE AS days_until_expiration
      FROM public.provider_payer_networks ppn
      JOIN public.providers pr ON pr.id = ppn.provider_id
      JOIN public.payers pay ON pay.id = ppn.payer_id
      WHERE ppn.status = 'in_network'
        AND ppn.expiration_date IS NOT NULL
        AND ppn.expiration_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + ($1::int || ' days')::interval)
      ORDER BY ppn.expiration_date ASC, provider_name;
    `

    // 4. Providers marked bookable but with no effective contract today
    const providersNoContractsQuery = `
      WITH ppn_effective_today AS (
        SELECT DISTINCT n.provider_id
        FROM public.provider_payer_networks n
        WHERE n.status = 'in_network'
          AND (
            n.effective_date IS NOT NULL AND n.effective_date <= $1::date
            AND (n.expiration_date IS NULL OR n.expiration_date >= $1::date)
          )
          AND (n.bookable_from_date IS NULL OR n.bookable_from_date <= $1::date)
      )
      SELECT p.id AS provider_id, p.first_name || ' ' || p.last_name AS provider_name
      FROM public.providers p
      WHERE p.is_active = TRUE AND p.is_bookable = TRUE AND p.accepts_new_patients = TRUE
        AND NOT EXISTS (SELECT 1 FROM ppn_effective_today e WHERE e.provider_id = p.id)
      ORDER BY provider_name;
    `

    // Execute queries in parallel
    const [
      providersZeroPayersResult,
      payersZeroProvidersResult,
      contractsExpiring30Result,
      contractsExpiring60Result,
      contractsExpiring90Result,
      providersNoContractsResult
    ] = await Promise.all([
      supabaseAdmin.rpc('execute_sql', { sql_query: providersZeroPayersQuery, params: [targetDate] }),
      supabaseAdmin.rpc('execute_sql', { sql_query: payersZeroProvidersQuery, params: [targetDate] }),
      supabaseAdmin.rpc('execute_sql', { sql_query: contractsExpiringQuery, params: [30] }),
      supabaseAdmin.rpc('execute_sql', { sql_query: contractsExpiringQuery, params: [60] }),
      supabaseAdmin.rpc('execute_sql', { sql_query: contractsExpiringQuery, params: [90] }),
      supabaseAdmin.rpc('execute_sql', { sql_query: providersNoContractsQuery, params: [targetDate] })
    ])

    // Since we can't use rpc('execute_sql'), let's use the canonical view and direct queries
    // Fall back to using the existing pattern from the main bookability endpoint

    // 1. Get all bookable relationships from canonical view
    const { data: bookableData, error: bookableError } = await supabaseAdmin
      .from('v_bookable_provider_payer')
      .select('provider_id, payer_id, bookable_from_date')

    if (bookableError) {
      console.error('❌ Error fetching bookable data:', bookableError)
    }

    // Filter for today's bookable relationships
    const todayBookable = (bookableData || []).filter(row =>
      !row.bookable_from_date || new Date(row.bookable_from_date) <= new Date(targetDate)
    )

    const bookableProviderIds = new Set(todayBookable.map(row => row.provider_id))
    const bookablePayerIds = new Set(todayBookable.map(row => row.payer_id))

    // 1. Providers with zero bookable payers
    const { data: allProviders, error: providersError } = await supabaseAdmin
      .from('providers')
      .select('id, first_name, last_name')
      .eq('is_active', true)
      .eq('is_bookable', true)
      .eq('accepts_new_patients', true)

    const providersZeroPayers = (allProviders || [])
      .filter(p => !bookableProviderIds.has(p.id))
      .map(p => ({
        provider_id: p.id,
        provider_name: `${p.first_name} ${p.last_name}`
      }))

    // 2. Payers with zero accepting providers
    const { data: allPayers, error: payersError } = await supabaseAdmin
      .from('payers')
      .select('id, name')
      .in('status_code', ['approved', 'active'])

    const payersZeroProviders = (allPayers || [])
      .filter(p => !bookablePayerIds.has(p.id))
      .map(p => ({
        payer_id: p.id,
        payer_name: p.name
      }))

    // 3. Contracts expiring soon
    const { data: expiringContracts, error: contractsError } = await supabaseAdmin
      .from('provider_payer_networks')
      .select(`
        provider_id,
        payer_id,
        effective_date,
        expiration_date,
        updated_at,
        providers!inner(first_name, last_name),
        payers!inner(name)
      `)
      .eq('status', 'in_network')
      .not('expiration_date', 'is', null)
      .gte('expiration_date', new Date().toISOString().split('T')[0])
      .lte('expiration_date', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])

    const contractsByDays = {
      days_30: [],
      days_60: [],
      days_90: []
    }

    if (expiringContracts) {
      const today = new Date()
      expiringContracts.forEach(contract => {
        const expirationDate = new Date(contract.expiration_date)
        const daysUntilExpiration = Math.ceil((expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

        const contractData = {
          provider_id: contract.provider_id,
          provider_name: `${contract.providers.first_name} ${contract.providers.last_name}`,
          payer_id: contract.payer_id,
          payer_name: contract.payers.name,
          effective_date: contract.effective_date,
          expiration_date: contract.expiration_date,
          updated_at: contract.updated_at
        }

        if (daysUntilExpiration <= 30) contractsByDays.days_30.push(contractData)
        if (daysUntilExpiration <= 60) contractsByDays.days_60.push(contractData)
        if (daysUntilExpiration <= 90) contractsByDays.days_90.push(contractData)
      })
    }

    // 4. Providers marked bookable but with no effective contract today
    const { data: effectiveContracts, error: effectiveError } = await supabaseAdmin
      .from('provider_payer_networks')
      .select('provider_id')
      .eq('status', 'in_network')
      .lte('effective_date', targetDate)
      .or(`expiration_date.is.null,expiration_date.gte.${targetDate}`)
      .or(`bookable_from_date.is.null,bookable_from_date.lte.${targetDate}`)

    const effectiveProviderIds = new Set((effectiveContracts || []).map(c => c.provider_id))

    const providersNoContracts = (allProviders || [])
      .filter(p => !effectiveProviderIds.has(p.id))
      .map(p => ({
        provider_id: p.id,
        provider_name: `${p.first_name} ${p.last_name}`
      }))

    const healthData: HealthData = {
      providers_zero_payers: providersZeroPayers,
      payers_zero_providers: payersZeroProviders,
      contracts_expiring: contractsByDays,
      providers_no_contracts: providersNoContracts
    }

    console.log('✅ Successfully fetched bookability health data:', {
      providers_zero_payers: healthData.providers_zero_payers.length,
      payers_zero_providers: healthData.payers_zero_providers.length,
      contracts_expiring_30: healthData.contracts_expiring.days_30.length,
      contracts_expiring_60: healthData.contracts_expiring.days_60.length,
      contracts_expiring_90: healthData.contracts_expiring.days_90.length,
      providers_no_contracts: healthData.providers_no_contracts.length
    })

    return NextResponse.json({
      success: true,
      data: healthData,
      target_date: targetDate,
      debug_info: {
        total_bookable_relationships: todayBookable.length,
        unique_bookable_providers: bookableProviderIds.size,
        unique_bookable_payers: bookablePayerIds.size,
        query_errors: {
          bookable_error: bookableError,
          providers_error: providersError,
          payers_error: payersError,
          contracts_error: contractsError,
          effective_error: effectiveError
        }
      }
    })

  } catch (error: any) {
    console.error('❌ Error in admin bookability health endpoint:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch bookability health data',
        details: error.message
      },
      { status: 500 }
    )
  }
}