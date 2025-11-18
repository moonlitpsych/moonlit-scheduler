/**
 * Unified Patient Roster API
 *
 * Single endpoint serving partner, provider, and admin dashboards with consistent response format.
 *
 * Query Parameters:
 * - user_type: 'partner' | 'provider' | 'admin' (required)
 * - user_id: partner_user_id or provider_id (required for partner/provider)
 * - search: Text search across name, email, phone
 * - status: Engagement status filter
 * - appointment_filter: 'all' | 'has_future' | 'no_future'
 * - organization_id: Filter by organization
 * - provider_id: Filter by provider (admin only)
 * - payer_id: Filter by payer
 * - filter_type: Partner-specific quick filters
 * - show_test_patients: Include test patients (admin only)
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20 for partner, 50 for provider/admin)
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import type { PatientRosterResponse, PatientRosterItem, UserRole } from '@/types/patient-roster'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Required parameters
    const userType = searchParams.get('user_type') as UserRole | null
    const userId = searchParams.get('user_id') // partner_user_id or provider_id

    if (!userType || !['partner', 'provider', 'admin'].includes(userType)) {
      return NextResponse.json(
        { error: 'Invalid or missing user_type parameter' },
        { status: 400 }
      )
    }

    if ((userType === 'partner' || userType === 'provider') && !userId) {
      return NextResponse.json(
        { error: `user_id required for ${userType} role` },
        { status: 400 }
      )
    }

    // Parse filters
    const search = searchParams.get('search') || undefined
    const status = searchParams.get('status') || undefined
    const appointmentFilter = searchParams.get('appointment_filter') || 'all'
    const organizationId = searchParams.get('organization_id') || undefined
    const providerId = searchParams.get('provider_id') || undefined
    const payerId = searchParams.get('payer_id') || undefined
    const filterType = searchParams.get('filter_type') || 'all'
    const showTestPatients = searchParams.get('show_test_patients') === 'true'

    // Pagination
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || (userType === 'partner' ? '20' : '50'))
    const offset = (page - 1) * limit

    // Fetch patients based on user type
    let patientsData: PatientRosterItem[] = []
    let totalCount = 0
    let stats = { total: 0, active: 0, no_future_appointment: 0 }

    if (userType === 'partner') {
      const result = await fetchPartnerPatients(userId!, {
        search,
        status,
        appointmentFilter,
        filterType,
        offset,
        limit
      })
      patientsData = result.patients
      totalCount = result.total
      stats = result.stats
    } else if (userType === 'provider') {
      const result = await fetchProviderPatients(userId!, {
        search,
        status,
        appointmentFilter,
        organizationId,
        payerId,
        offset,
        limit
      })
      patientsData = result.patients
      totalCount = result.total
      stats = result.stats
    } else if (userType === 'admin') {
      const result = await fetchAdminPatients({
        search,
        status,
        appointmentFilter,
        organizationId,
        providerId,
        payerId,
        showTestPatients,
        offset,
        limit
      })
      patientsData = result.patients
      totalCount = result.total
      stats = result.stats
    }

    const totalPages = Math.ceil(totalCount / limit)

    const response: PatientRosterResponse = {
      patients: patientsData,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages,
        hasMore: page < totalPages
      },
      stats,
      filters_applied: {
        searchTerm: search,
        engagementStatus: status as any,
        appointmentFilter: appointmentFilter as any,
        organizationId,
        providerId,
        payerId,
        filterType: filterType as any,
        showTestPatients
      }
    }

    return NextResponse.json(response)

  } catch (error: any) {
    console.error('❌ Error in unified roster API:', error)
    return NextResponse.json(
      { error: 'Failed to fetch patients', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * Fetch patients for partner dashboard
 */
async function fetchPartnerPatients(
  partnerUserId: string,
  filters: {
    search?: string
    status?: string
    appointmentFilter?: string
    filterType?: string
    offset: number
    limit: number
  }
) {
  // Get partner user info
  const { data: partnerUser } = await supabaseAdmin
    .from('partner_users')
    .select('id, organization_id, role')
    .eq('id', partnerUserId)
    .single()

  if (!partnerUser) {
    throw new Error('Partner user not found')
  }

  // Build base query for count
  let countQuery = supabaseAdmin
    .from('patient_organization_affiliations')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', partnerUser.organization_id)
    .eq('status', 'active')

  // Build main query
  let query = supabaseAdmin
    .from('patient_organization_affiliations')
    .select(`
      id,
      patient_id,
      affiliation_type,
      start_date,
      consent_on_file,
      consent_expires_on,
      roi_file_url,
      last_practiceq_sync_at,
      primary_contact_user_id,
      status,
      patients!inner (
        id,
        first_name,
        last_name,
        email,
        phone,
        date_of_birth,
        status,
        primary_provider_id,
        is_test_patient,
        primary_provider:providers!primary_provider_id (
          id,
          first_name,
          last_name
        ),
        patient_engagement_status (
          status,
          updated_at
        ),
        primary_payer:payers!primary_payer_id (
          id,
          name,
          state
        )
      )
    `)
    .eq('organization_id', partnerUser.organization_id)
    .eq('status', 'active')
    .eq('patients.is_test_patient', false)

  // Apply filters
  if (filters.status && filters.status !== 'all') {
    // Filter will be applied after fetching (engagement_status is in nested object)
  }

  // Get total count
  const { count: totalCount } = await countQuery

  // Apply pagination and fetch
  query = query.order('start_date', { ascending: false })
    .range(filters.offset, filters.offset + filters.limit - 1)

  const { data: affiliations, error } = await query

  if (error) {
    console.error('Error fetching partner patients:', error)
    throw error
  }

  const patientIds = affiliations?.map(a => a.patient_id) || []

  // Fetch appointments for these patients
  const { next, previous } = await fetchAppointmentsForPatients(patientIds)

  // Fetch assignments
  const { data: assignments } = await supabaseAdmin
    .from('partner_user_patient_assignments')
    .select(`
      patient_id,
      partner_user_id,
      assignment_type,
      partner_users (
        full_name
      )
    `)
    .eq('organization_id', partnerUser.organization_id)
    .eq('status', 'active')

  const myAssignments = (assignments || []).filter(a => a.partner_user_id === partnerUserId)
  const primaryAssignments = (assignments || []).filter(a => a.assignment_type === 'primary')

  const assignedPatientIds = new Set(myAssignments.map(a => a.patient_id))
  const assignmentsByPatient = primaryAssignments.reduce((acc, assignment) => {
    acc[assignment.patient_id] = {
      partner_user_id: assignment.partner_user_id,
      partner_user_name: assignment.partner_users?.full_name || 'Unknown'
    }
    return acc
  }, {} as Record<string, any>)

  // Normalize to PatientRosterItem[]
  const patients: PatientRosterItem[] = (affiliations || []).map(affiliation => {
    const patient = affiliation.patients as any
    const engagement_status = patient.patient_engagement_status?.status || 'active'

    return {
      id: patient.id,
      first_name: patient.first_name,
      last_name: patient.last_name,
      email: patient.email,
      phone: patient.phone,
      date_of_birth: patient.date_of_birth,
      engagement_status,

      primary_provider_id: patient.primary_provider_id,
      primary_provider: patient.primary_provider,

      primary_payer_id: patient.primary_payer?.id,
      primary_payer: patient.primary_payer,

      next_appointment: next[patient.id],
      previous_appointment: previous[patient.id],
      has_future_appointment: !!next[patient.id],

      roi: {
        consent_on_file: affiliation.consent_on_file,
        consent_expires_on: affiliation.consent_expires_on,
        consent_status: affiliation.consent_on_file
          ? (affiliation.consent_expires_on && new Date(affiliation.consent_expires_on) < new Date()
            ? 'expired'
            : 'active')
          : 'missing',
        roi_file_url: affiliation.roi_file_url,
        last_practiceq_sync_at: affiliation.last_practiceq_sync_at
      },

      is_assigned_to_me: assignedPatientIds.has(patient.id),
      current_assignment: assignmentsByPatient[patient.id] || null,

      last_practiceq_sync_at: affiliation.last_practiceq_sync_at
    }
  })

  // Client-side filtering
  let filtered = patients

  if (filters.status && filters.status !== 'all') {
    filtered = filtered.filter(p => p.engagement_status === filters.status)
  }

  if (filters.filterType === 'assigned_to_me') {
    filtered = filtered.filter(p => p.is_assigned_to_me)
  } else if (filters.filterType === 'roi_missing') {
    filtered = filtered.filter(p => p.roi?.consent_status === 'missing')
  } else if (filters.filterType === 'active_only') {
    filtered = filtered.filter(p => p.engagement_status === 'active')
  } else if (filters.filterType === 'no_future_appt') {
    filtered = filtered.filter(p => !p.has_future_appointment)
  }

  if (filters.search) {
    const search = filters.search.toLowerCase()
    filtered = filtered.filter(p =>
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(search) ||
      p.email?.toLowerCase().includes(search) ||
      p.phone?.includes(search)
    )
  }

  // Calculate stats
  const stats = {
    total: filtered.length,
    active: filtered.filter(p => p.engagement_status === 'active').length,
    no_future_appointment: filtered.filter(p => !p.has_future_appointment).length,
    assigned_to_me: filtered.filter(p => p.is_assigned_to_me).length
  }

  return {
    patients: filtered,
    total: totalCount || 0,
    stats
  }
}

/**
 * Fetch patients for provider dashboard
 */
async function fetchProviderPatients(
  providerId: string,
  filters: {
    search?: string
    status?: string
    appointmentFilter?: string
    organizationId?: string
    payerId?: string
    offset: number
    limit: number
  }
) {
  // Use activity summary view with provider filter
  let query = supabaseAdmin
    .from('v_patient_activity_summary')
    .select('*', { count: 'exact' })
    .eq('primary_provider_id', providerId)
    .eq('is_test_patient', false)

  if (filters.status && filters.status !== 'all') {
    query = query.eq('engagement_status', filters.status)
  }

  if (filters.appointmentFilter === 'has_future') {
    query = query.eq('has_future_appointment', true)
  } else if (filters.appointmentFilter === 'no_future') {
    query = query.eq('has_future_appointment', false)
  }

  if (filters.organizationId && filters.organizationId !== 'all') {
    query = query.contains('shared_with_org_ids', [filters.organizationId])
  }

  const { data, error, count } = await query
    .order('last_name', { ascending: true })
    .range(filters.offset, filters.offset + filters.limit - 1)

  if (error) {
    console.error('Error fetching provider patients:', error)
    throw error
  }

  const patientIds = (data || []).map((p: any) => p.patient_id)
  const { next, previous } = await fetchAppointmentsForPatients(patientIds)

  // Normalize to PatientRosterItem[]
  const patients: PatientRosterItem[] = (data || []).map((p: any) => ({
    id: p.patient_id,
    first_name: p.first_name,
    last_name: p.last_name,
    email: p.email,
    phone: p.phone,
    engagement_status: p.engagement_status,

    primary_provider_id: p.primary_provider_id,
    primary_provider: p.provider_first_name ? {
      id: p.primary_provider_id,
      first_name: p.provider_first_name,
      last_name: p.provider_last_name
    } : null,

    primary_payer_id: p.primary_payer_id,
    primary_payer: p.payer_name ? {
      id: p.primary_payer_id,
      name: p.payer_name,
      type: p.payer_type,
      state: p.payer_state
    } : null,

    next_appointment: next[p.patient_id],
    previous_appointment: previous[p.patient_id],
    has_future_appointment: p.has_future_appointment,

    shared_with_org_ids: p.shared_with_org_ids,
    affiliation_details: p.affiliation_details,

    primary_case_manager_id: p.primary_case_manager_id,
    case_manager_name: p.case_manager_name,

    last_intakeq_sync: p.last_intakeq_sync
  }))

  // Client-side filters
  let filtered = patients

  if (filters.search) {
    const search = filters.search.toLowerCase()
    filtered = filtered.filter(p =>
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(search) ||
      p.email?.toLowerCase().includes(search) ||
      p.phone?.includes(search)
    )
  }

  if (filters.payerId && filters.payerId !== 'all') {
    filtered = filtered.filter(p => p.primary_payer_id === filters.payerId)
  }

  const stats = {
    total: filtered.length,
    active: filtered.filter(p => p.engagement_status === 'active').length,
    no_future_appointment: filtered.filter(p => !p.has_future_appointment).length,
    with_case_management: filtered.filter(p => p.primary_case_manager_id).length
  }

  return {
    patients: filtered,
    total: count || 0,
    stats
  }
}

/**
 * Fetch patients for admin dashboard
 */
async function fetchAdminPatients(
  filters: {
    search?: string
    status?: string
    appointmentFilter?: string
    organizationId?: string
    providerId?: string
    payerId?: string
    showTestPatients?: boolean
    offset: number
    limit: number
  }
) {
  let query = supabaseAdmin
    .from('v_patient_activity_summary')
    .select('*', { count: 'exact' })

  if (!filters.showTestPatients) {
    query = query.eq('is_test_patient', false)
  }

  if (filters.search) {
    query = query.or(`first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`)
  }

  if (filters.status && filters.status !== 'all') {
    query = query.eq('engagement_status', filters.status)
  }

  if (filters.appointmentFilter === 'has_future') {
    query = query.eq('has_future_appointment', true)
  } else if (filters.appointmentFilter === 'no_future') {
    query = query.eq('has_future_appointment', false)
  }

  if (filters.organizationId && filters.organizationId !== 'all') {
    query = query.contains('shared_with_org_ids', [filters.organizationId])
  }

  if (filters.providerId && filters.providerId !== 'all') {
    query = query.eq('primary_provider_id', filters.providerId)
  }

  const { data, error, count } = await query
    .order('last_name', { ascending: true })
    .range(filters.offset, filters.offset + filters.limit - 1)

  if (error) {
    console.error('Error fetching admin patients:', error)
    throw error
  }

  const patientIds = (data || []).map((p: any) => p.patient_id)
  const { next, previous } = await fetchAppointmentsForPatients(patientIds)

  // Normalize to PatientRosterItem[]
  const patients: PatientRosterItem[] = (data || []).map((p: any) => ({
    id: p.patient_id,
    first_name: p.first_name,
    last_name: p.last_name,
    email: p.email,
    phone: p.phone,
    engagement_status: p.engagement_status,

    primary_provider_id: p.primary_provider_id,
    primary_provider: p.provider_first_name ? {
      id: p.primary_provider_id,
      first_name: p.provider_first_name,
      last_name: p.provider_last_name
    } : null,

    primary_payer_id: p.primary_payer_id,
    primary_payer: p.payer_name ? {
      id: p.primary_payer_id,
      name: p.payer_name,
      type: p.payer_type,
      state: p.payer_state
    } : null,

    next_appointment: next[p.patient_id],
    previous_appointment: previous[p.patient_id],
    has_future_appointment: p.has_future_appointment,

    shared_with_org_ids: p.shared_with_org_ids,
    affiliation_details: p.affiliation_details,

    primary_case_manager_id: p.primary_case_manager_id,
    case_manager_name: p.case_manager_name,

    last_intakeq_sync: p.last_intakeq_sync
  }))

  // Client-side payer filter
  let filtered = patients

  if (filters.payerId && filters.payerId !== 'all') {
    filtered = filtered.filter(p => p.primary_payer_id === filters.payerId)
  }

  const stats = {
    total: filtered.length,
    active: filtered.filter(p => p.engagement_status === 'active').length,
    no_future_appointment: filtered.filter(p => !p.has_future_appointment).length,
    with_organizations: filtered.filter(p => (p.shared_with_org_ids || []).length > 0).length
  }

  return {
    patients: filtered,
    total: count || 0,
    stats
  }
}

/**
 * Helper: Fetch next and previous appointments for a list of patients
 */
async function fetchAppointmentsForPatients(patientIds: string[]) {
  if (patientIds.length === 0) {
    return { next: {}, previous: {} }
  }

  const now = new Date().toISOString()

  const [nextResult, previousResult] = await Promise.all([
    supabaseAdmin
      .from('appointments')
      .select(`
        id,
        patient_id,
        start_time,
        status,
        meeting_url,
        location_info,
        practiceq_generated_google_meet,
        providers!appointments_provider_id_fkey (
          id,
          first_name,
          last_name
        )
      `)
      .in('patient_id', patientIds)
      .in('status', ['scheduled', 'confirmed'])
      .gte('start_time', now)
      .order('start_time', { ascending: true }),

    supabaseAdmin
      .from('appointments')
      .select(`
        id,
        patient_id,
        start_time,
        status,
        meeting_url,
        location_info,
        practiceq_generated_google_meet,
        providers!appointments_provider_id_fkey (
          id,
          first_name,
          last_name
        )
      `)
      .in('patient_id', patientIds)
      .in('status', ['completed', 'confirmed', 'no_show'])
      .lt('start_time', now)
      .order('start_time', { ascending: false })
  ])

  const nextByPatient = (nextResult.data || []).reduce((acc: any, appt: any) => {
    if (!acc[appt.patient_id]) {
      acc[appt.patient_id] = appt
    }
    return acc
  }, {})

  const previousByPatient = (previousResult.data || []).reduce((acc: any, appt: any) => {
    if (!acc[appt.patient_id]) {
      acc[appt.patient_id] = appt
    }
    return acc
  }, {})

  return { next: nextByPatient, previous: previousByPatient }
}
