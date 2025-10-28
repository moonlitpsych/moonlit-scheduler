import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isAdminEmail } from '@/lib/admin-auth'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

async function verifyAdminAccess() {
  try {
    const cookieStore = await cookies()
    const supabase = createServerComponentClient({ cookies: () => cookieStore })
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user || !isAdminEmail(user.email || '')) {
      return { authorized: false, user: null }
    }

    return { authorized: true, user }
  } catch (error) {
    console.error('Admin verification error:', error)
    return { authorized: false, user: null }
  }
}

interface PayerSelectionStats {
  id: string
  name: string
  payer_type: string
  state: string

  // Credentialing requirements
  requires_individual_contract: boolean
  allows_supervised: boolean
  requires_attending: boolean
  supervision_level: string | null

  // Statistics
  total_contracts: number           // Count of provider_payer_networks
  bookable_providers: number        // Count from v_bookable_provider_payer
  current_census: number            // Patients with this as active payer

  // Workflow info
  workflow_type: string | null
  typical_approval_days: number | null

  // Provider-specific flags
  already_credentialing: boolean    // Provider has application in progress
  already_contracted: boolean       // Provider has active contract
  is_recommended: boolean           // Highlighted for attendings if requires_attending=true
}

/**
 * GET /api/admin/payers/selection-stats
 *
 * Returns payer list with statistics for provider credentialing selection.
 *
 * Query params:
 * - providerId (optional): If provided, includes provider-specific flags
 */
export async function GET(request: NextRequest) {
  try {
    const { authorized } = await verifyAdminAccess()
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const providerId = searchParams.get('providerId')

    console.log(`🔍 Fetching payer selection stats${providerId ? ` for provider ${providerId}` : ''}...`)

    // Step 1: Get all payers with credentialing workflows
    const { data: payers, error: payersError } = await supabaseAdmin
      .from('payers')
      .select(`
        id,
        name,
        payer_type,
        state,
        requires_individual_contract,
        allows_supervised,
        requires_attending,
        supervision_level
      `)
      .order('name', { ascending: true })

    if (payersError) {
      console.error('❌ Error fetching payers:', payersError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch payers' },
        { status: 500 }
      )
    }

    // Step 2: Get contract counts per payer
    const { data: contractCounts, error: contractsError } = await supabaseAdmin
      .from('provider_payer_networks')
      .select('payer_id')
      .eq('status', 'in_network')

    if (contractsError) {
      console.error('❌ Error fetching contract counts:', contractsError)
    }

    const contractCountMap = new Map<string, number>()
    contractCounts?.forEach(contract => {
      const current = contractCountMap.get(contract.payer_id) || 0
      contractCountMap.set(contract.payer_id, current + 1)
    })

    // Step 3: Get bookable provider counts from canonical view
    const { data: bookableCounts, error: bookableError } = await supabaseAdmin
      .from('v_bookable_provider_payer')
      .select('payer_id, provider_id')

    if (bookableError) {
      console.error('❌ Error fetching bookable counts:', bookableError)
    }

    const bookableCountMap = new Map<string, Set<string>>()
    bookableCounts?.forEach(bp => {
      if (!bookableCountMap.has(bp.payer_id)) {
        bookableCountMap.set(bp.payer_id, new Set())
      }
      bookableCountMap.get(bp.payer_id)!.add(bp.provider_id)
    })

    // Step 4: Get current patient census (patients with this as active payer)
    // Using subquery to get latest appointment per patient
    const { data: censusCounts, error: censusError } = await supabaseAdmin
      .rpc('get_current_payer_census')
      .catch(async () => {
        // If RPC doesn't exist, fall back to direct query
        console.log('📊 Using fallback census query...')

        const { data, error } = await supabaseAdmin.from('appointments').select(`
          patient_id,
          payer_id,
          start_datetime
        `).not('payer_id', 'is', null)
        .order('start_datetime', { ascending: false })

        if (error) throw error

        // Get latest appointment per patient in memory
        const latestByPatient = new Map<string, string>()
        data?.forEach(apt => {
          if (!latestByPatient.has(apt.patient_id) && apt.payer_id) {
            latestByPatient.set(apt.patient_id, apt.payer_id)
          }
        })

        // Count patients per payer
        const censusByPayer = new Map<string, number>()
        latestByPatient.forEach((payerId) => {
          censusByPayer.set(payerId, (censusByPayer.get(payerId) || 0) + 1)
        })

        return Array.from(censusByPayer.entries()).map(([payer_id, census]) => ({
          payer_id,
          census
        }))
      })

    if (censusError) {
      console.error('❌ Error fetching patient census:', censusError)
    }

    const censusCountMap = new Map<string, number>()
    if (Array.isArray(censusCounts)) {
      censusCounts.forEach((item: any) => {
        censusCountMap.set(item.payer_id, item.census || 0)
      })
    }

    // Step 5: Get credentialing workflows
    const { data: workflows, error: workflowsError } = await supabaseAdmin
      .from('payer_credentialing_workflows')
      .select('payer_id, workflow_type, typical_approval_days')

    if (workflowsError) {
      console.error('❌ Error fetching workflows:', workflowsError)
    }

    const workflowMap = new Map<string, { type: string, days: number | null }>()
    workflows?.forEach(wf => {
      workflowMap.set(wf.payer_id, {
        type: wf.workflow_type,
        days: wf.typical_approval_days
      })
    })

    // Step 6: If providerId provided, get provider-specific data
    let providerApplications = new Set<string>()
    let providerContracts = new Set<string>()
    let providerIsAttending = false

    if (providerId) {
      // Check if provider is attending (role-based)
      const { data: provider } = await supabaseAdmin
        .from('providers')
        .select('role')
        .eq('id', providerId)
        .single()

      providerIsAttending = provider?.role?.toLowerCase().includes('psychiatrist') &&
                            !provider?.role?.toLowerCase().includes('resident')

      // Get provider applications
      const { data: applications } = await supabaseAdmin
        .from('provider_payer_applications')
        .select('payer_id')
        .eq('provider_id', providerId)
        .in('application_status', ['in_progress', 'submitted', 'under_review'])

      applications?.forEach(app => providerApplications.add(app.payer_id))

      // Get provider contracts
      const { data: contracts } = await supabaseAdmin
        .from('provider_payer_networks')
        .select('payer_id')
        .eq('provider_id', providerId)
        .eq('status', 'in_network')

      contracts?.forEach(contract => providerContracts.add(contract.payer_id))
    }

    // Step 7: Combine all data
    const stats: PayerSelectionStats[] = payers?.map(payer => {
      const workflow = workflowMap.get(payer.id)
      const bookableSet = bookableCountMap.get(payer.id)

      return {
        id: payer.id,
        name: payer.name,
        payer_type: payer.payer_type,
        state: payer.state,

        requires_individual_contract: payer.requires_individual_contract || false,
        allows_supervised: payer.allows_supervised || false,
        requires_attending: payer.requires_attending || false,
        supervision_level: payer.supervision_level,

        total_contracts: contractCountMap.get(payer.id) || 0,
        bookable_providers: bookableSet?.size || 0,
        current_census: censusCountMap.get(payer.id) || 0,

        workflow_type: workflow?.type || null,
        typical_approval_days: workflow?.days || null,

        already_credentialing: providerApplications.has(payer.id),
        already_contracted: providerContracts.has(payer.id),
        is_recommended: providerIsAttending && payer.requires_attending
      }
    }) || []

    console.log(`✅ Returning ${stats.length} payers with statistics`)

    return NextResponse.json({
      success: true,
      data: stats
    })

  } catch (error) {
    console.error('❌ Payer selection stats API error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
