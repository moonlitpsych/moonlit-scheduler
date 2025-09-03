// Organization Appointments Feed API - Uses org_appointment_feed_v
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Get partner user ID from headers
    const partnerUserId = request.headers.get('x-partner-user-id')
    
    if (!partnerUserId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Partner user authentication required' 
        },
        { status: 401 }
      )
    }

    // Get user's organization
    const { data: partnerUser, error: userError } = await supabaseAdmin
      .from('partner_users')
      .select('organization_id, role')
      .eq('id', partnerUserId)
      .eq('status', 'active')
      .single()

    if (userError || !partnerUser?.organization_id) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Partner user or organization not found' 
        },
        { status: 404 }
      )
    }

    // Parse filters
    const filter = searchParams.get('filter') || 'all' // upcoming, past, all
    const page = parseInt(searchParams.get('page') || '1')
    const perPage = Math.min(parseInt(searchParams.get('per_page') || '20'), 100)
    const offset = (page - 1) * perPage
    const providerId = searchParams.get('provider_id')
    const status = searchParams.get('status')
    const search = searchParams.get('search') // patient name search

    console.log('📅 Fetching organization appointments:', { 
      organizationId: partnerUser.organization_id,
      filter, 
      page, 
      perPage,
      providerId,
      status,
      search
    })

    // Build appointments query - using org_appointment_feed_v if it exists, otherwise construct manually
    let query: any
    
    try {
      // Try to use the view first
      query = supabaseAdmin
        .from('org_appointment_feed_v')
        .select('*', { count: 'exact' })
        .eq('organization_id', partnerUser.organization_id)
    } catch (viewError) {
      // Fallback to manual query if view doesn't exist
      console.log('📝 View not available, using manual query')
      
      query = supabaseAdmin
        .from('appointments')
        .select(`
          id,
          provider_id,
          start_time,
          end_time,
          timezone,
          status,
          appointment_type,
          notes,
          cancellation_reason,
          created_at,
          updated_at,
          patient_info,
          insurance_info,
          providers!inner(
            id,
            first_name,
            last_name,
            title
          )
        `, { count: 'exact' })
        .in('patient_id', 
          supabaseAdmin
            .from('patient_affiliations')
            .select('patient_id')
            .eq('organization_id', partnerUser.organization_id)
            .eq('status', 'active')
        )
    }

    // Apply time-based filter
    const now = new Date()
    if (filter === 'upcoming') {
      query = query.gte('start_time', now.toISOString())
    } else if (filter === 'past') {
      query = query.lt('start_time', now.toISOString())
    }

    // Apply additional filters
    if (providerId) {
      query = query.eq('provider_id', providerId)
    }
    
    if (status) {
      query = query.eq('status', status)
    }

    // Apply search filter (patient name)
    if (search) {
      // Search in patient_info JSONB field
      query = query.or(`
        patient_info->>'first_name'.ilike.%${search}%,
        patient_info->>'last_name'.ilike.%${search}%
      `)
    }

    // Apply pagination and ordering
    const orderDirection = filter === 'past' ? 'desc' : 'asc'
    query = query
      .order('start_time', { ascending: orderDirection === 'asc' })
      .range(offset, offset + perPage - 1)

    const { data: appointments, error, count } = await query

    if (error) {
      console.error('❌ Error fetching appointments:', error)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to fetch appointments',
          details: error.message
        },
        { status: 500 }
      )
    }

    // Process appointments for display
    const processedAppointments = (appointments || []).map(appointment => ({
      id: appointment.id,
      provider: {
        id: appointment.provider_id,
        name: appointment.providers ? 
          `Dr. ${appointment.providers.first_name} ${appointment.providers.last_name}` :
          `Dr. ${appointment.provider_info?.first_name || ''} ${appointment.provider_info?.last_name || ''}`.trim(),
        title: appointment.providers?.title || appointment.provider_info?.title
      },
      patient: {
        name: `${appointment.patient_info?.first_name || ''} ${appointment.patient_info?.last_name || ''}`.trim(),
        initials: getInitials(appointment.patient_info?.first_name, appointment.patient_info?.last_name),
        phone: appointment.patient_info?.phone,
        email: appointment.patient_info?.email
      },
      schedule: {
        start_time: appointment.start_time,
        end_time: appointment.end_time,
        timezone: appointment.timezone || 'America/Denver',
        duration_minutes: appointment.end_time && appointment.start_time ? 
          Math.round((new Date(appointment.end_time).getTime() - new Date(appointment.start_time).getTime()) / (1000 * 60)) : 
          60
      },
      status: appointment.status,
      appointment_type: appointment.appointment_type,
      insurance: appointment.insurance_info,
      notes: appointment.notes,
      cancellation_reason: appointment.cancellation_reason,
      can_reschedule: canRescheduleAppointment(appointment),
      created_at: appointment.created_at,
      updated_at: appointment.updated_at
    }))

    const totalPages = Math.ceil((count || 0) / perPage)

    // Log access for audit
    await supabaseAdmin
      .from('scheduler_audit_logs')
      .insert({
        action: 'org_appointments_viewed',
        resource_type: 'appointments',
        resource_id: partnerUser.organization_id,
        details: {
          filter,
          page,
          per_page: perPage,
          total_results: count,
          partner_user_id: partnerUserId,
          filters_applied: { providerId, status, search }
        }
      })

    console.log('✅ Appointments fetched:', {
      total: count,
      returned: processedAppointments.length,
      filter,
      organization_id: partnerUser.organization_id
    })

    return NextResponse.json({
      success: true,
      data: {
        appointments: processedAppointments,
        pagination: {
          page,
          per_page: perPage,
          total: count || 0,
          total_pages: totalPages,
          has_next: page < totalPages,
          has_prev: page > 1
        },
        filters: {
          applied: { filter, providerId, status, search },
          available_providers: await getAvailableProviders(partnerUser.organization_id),
          available_statuses: ['scheduled', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show']
        }
      }
    })

  } catch (error: any) {
    console.error('❌ Organization appointments error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch organization appointments',
        details: error.message
      },
      { status: 500 }
    )
  }
}

// Helper function to get patient initials
function getInitials(firstName?: string, lastName?: string): string {
  if (!firstName && !lastName) return '??'
  return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase()
}

// Helper function to determine if appointment can be rescheduled
function canRescheduleAppointment(appointment: any): boolean {
  const now = new Date()
  const appointmentTime = new Date(appointment.start_time)
  const hoursUntilAppt = (appointmentTime.getTime() - now.getTime()) / (1000 * 60 * 60)
  
  // Can reschedule if appointment is more than 24 hours away and not cancelled/completed
  return hoursUntilAppt > 24 && !['cancelled', 'completed', 'no_show'].includes(appointment.status)
}

// Helper function to get available providers for organization
async function getAvailableProviders(organizationId: string) {
  try {
    // Get providers who have had appointments with this organization's patients
    const { data: providers } = await supabaseAdmin
      .from('providers')
      .select('id, first_name, last_name, title')
      .in('id', 
        supabaseAdmin
          .from('appointments')
          .select('provider_id')
          .in('patient_id',
            supabaseAdmin
              .from('patient_affiliations')
              .select('patient_id')
              .eq('organization_id', organizationId)
              .eq('status', 'active')
          )
      )
      .limit(20)

    return (providers || []).map(p => ({
      id: p.id,
      name: `Dr. ${p.first_name} ${p.last_name}`,
      title: p.title
    }))
  } catch (error) {
    console.warn('Could not fetch available providers:', error)
    return []
  }
}