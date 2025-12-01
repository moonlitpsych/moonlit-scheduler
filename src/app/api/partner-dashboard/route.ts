// Partner Dashboard API - Main dashboard data for case managers
import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'
import { PartnerDashboardFilters } from '@/types/partner-types'
import { isAdminEmail } from '@/lib/admin-auth'

// GET - Get dashboard data for partner user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Get authenticated user from Supabase session
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    if (sessionError || !session) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check for impersonation (admin viewing as partner)
    const partnerUserId = searchParams.get('partner_user_id')

    // SECURITY: If partner_user_id is provided, verify the requester is an admin
    if (partnerUserId) {
      const isAdmin = await isAdminEmail(session.user.email || '')
      if (!isAdmin) {
        console.warn('⚠️ Non-admin attempted to use partner_user_id parameter:', session.user.email)
        return NextResponse.json(
          { success: false, error: 'Admin access required for impersonation' },
          { status: 403 }
        )
      }
    }

    // Get partner user record
    let partnerUserQuery = supabaseAdmin
      .from('partner_users')
      .select(`
        *,
        organization:organizations!partner_users_organization_id_fkey(*)
      `)
      .eq('is_active', true)

    if (partnerUserId) {
      // Admin is impersonating - use provided partner_user_id
      partnerUserQuery = partnerUserQuery.eq('id', partnerUserId)
    } else {
      // Regular partner user - lookup by auth_user_id
      partnerUserQuery = partnerUserQuery.eq('auth_user_id', session.user.id)
    }

    const { data: partnerUser, error: userError } = await partnerUserQuery.single()

    if (userError || !partnerUser) {
      return NextResponse.json(
        { success: false, error: 'Partner user not found or inactive' },
        { status: 404 }
      )
    }

    const organizationId = partnerUser.organization_id

    // Parse filters
    const filters: PartnerDashboardFilters = {
      date_range: {
        start_date: searchParams.get('start_date') || new Date().toISOString().split('T')[0],
        end_date: searchParams.get('end_date') || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      },
      provider_ids: searchParams.get('provider_ids')?.split(',') || undefined,
      appointment_status: searchParams.get('appointment_status')?.split(',') || ['scheduled', 'confirmed'],
      search: searchParams.get('search') || undefined,
      assigned_to_me: searchParams.get('assigned_to_me') === 'true'
    }

    console.log('📊 Fetching partner dashboard data:', {
      partner_user_id: partnerUser.id,
      organization_id: organizationId,
      filters
    })

    // 1. Get upcoming appointments for organization's patients
    let appointmentsQuery = supabaseAdmin
      .from('appointments')
      .select(`
        *,
        providers(
          id,
          first_name,
          last_name,
          title
        ),
        payers(
          id,
          name
        ),
        patients!inner(
          id,
          first_name,
          last_name,
          phone,
          email,
          status,
          patient_organization_affiliations!inner(
            id,
            organization_id,
            status,
            affiliation_type,
            roi_consent_status
          )
        )
      `)
      .eq('patients.patient_organization_affiliations.organization_id', organizationId)
      .eq('patients.patient_organization_affiliations.status', 'active')
      .gte('start_time', filters.date_range?.start_date + 'T00:00:00Z')
      .lte('start_time', filters.date_range?.end_date + 'T23:59:59Z')

    // Apply appointment status filter
    if (filters.appointment_status?.length) {
      appointmentsQuery = appointmentsQuery.in('status', filters.appointment_status)
    }

    // Apply provider filter
    if (filters.provider_ids?.length) {
      appointmentsQuery = appointmentsQuery.in('provider_id', filters.provider_ids)
    }

    appointmentsQuery = appointmentsQuery
      .order('start_time', { ascending: true })
      .limit(50) // Limit to reasonable number

    const { data: appointments, error: appointmentsError } = await appointmentsQuery

    if (appointmentsError) {
      console.error('❌ Error fetching appointments:', appointmentsError)
      throw new Error('Failed to fetch appointments')
    }

    // 2. Get patients assigned to this user (if assigned_to_me filter is true)
    let myPatients = []
    if (filters.assigned_to_me) {
      const { data: assignedPatients, error: assignedError } = await supabaseAdmin
        .from('partner_user_patient_assignments')
        .select(`
          *,
          patients(
            *,
            primary_insurance_payer:payers(id, name)
          )
        `)
        .eq('partner_user_id', partnerUser.id)
        .eq('status', 'active')

      if (assignedError) {
        console.error('❌ Error fetching assigned patients:', assignedError)
      } else {
        myPatients = assignedPatients?.map(assignment => assignment.patients) || []
      }
    }

    // 3. Get organization statistics
    const [
      { count: totalPatients },
      { count: activePatients },
      { count: appointmentsThisWeek },
      { count: pendingChanges }
    ] = await Promise.all([
      // Total patients affiliated with organization
      supabaseAdmin
        .from('patient_organization_affiliations')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId),

      // Active patients
      supabaseAdmin
        .from('patient_organization_affiliations')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('status', 'active'),

      // Appointments this week
      supabaseAdmin
        .from('appointments')
        .select(`
          *,
          patients!inner(
            patient_organization_affiliations!inner(
              organization_id
            )
          )
        `, { count: 'exact', head: true })
        .eq('patients.patient_organization_affiliations.organization_id', organizationId)
        .gte('start_time', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .lte('start_time', new Date().toISOString()),

      // Pending appointment change requests
      supabaseAdmin
        .from('appointment_change_requests')
        .select(`
          *,
          appointments!inner(
            patients!inner(
              patient_organization_affiliations!inner(
                organization_id
              )
            )
          )
        `, { count: 'exact', head: true })
        .eq('appointments.patients.patient_organization_affiliations.organization_id', organizationId)
        .eq('status', 'pending')
    ])

    // 4. Get recent appointment change requests for this organization
    const { data: recentChanges, error: changesError } = await supabaseAdmin
      .from('appointment_change_requests')
      .select(`
        *,
        appointments(
          id,
          start_time,
          patients(
            id,
            first_name,
            last_name
          ),
          providers(
            id,
            first_name,
            last_name
          )
        ),
        requested_by_user:partner_users(
          id,
          first_name,
          last_name
        )
      `)
      .eq('requested_by_user.organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(10)

    const dashboardData = {
      upcoming_appointments: appointments || [],
      my_assigned_patients: myPatients,
      recent_changes: recentChanges || [],
      organization_stats: {
        total_patients: totalPatients || 0,
        active_patients: activePatients || 0,
        appointments_this_week: appointmentsThisWeek || 0,
        pending_changes: pendingChanges || 0
      }
    }

    console.log('✅ Dashboard data retrieved:', {
      partner_user_id: partnerUser.id,
      appointments_count: appointments?.length || 0,
      my_patients_count: myPatients.length,
      recent_changes_count: recentChanges?.length || 0
    })

    return NextResponse.json({
      success: true,
      data: dashboardData
    })

  } catch (error: any) {
    console.error('❌ Partner dashboard error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Failed to fetch dashboard data',
        details: error.message
      },
      { status: 500 }
    )
  }
}

// POST - Update dashboard preferences or trigger actions
export async function POST(request: NextRequest) {
  try {
    const partnerUser = await getPartnerUserFromAuth(request)
    const body = await request.json()
    const { action, data } = body

    console.log('🎯 Partner dashboard action:', { 
      partner_user_id: partnerUser.id, 
      action 
    })

    switch (action) {
      case 'update_preferences':
        // Update user notification preferences
        const { error: prefsError } = await supabaseAdmin
          .from('partner_users')
          .update({
            notification_preferences: data.notification_preferences,
            timezone: data.timezone || partnerUser.timezone,
            updated_at: new Date().toISOString()
          })
          .eq('id', partnerUser.id)

        if (prefsError) {
          throw new Error('Failed to update preferences')
        }

        return NextResponse.json({
          success: true,
          message: 'Preferences updated successfully'
        })

      case 'mark_notifications_read':
        // This would update notification read status
        // Implementation depends on notification system design
        return NextResponse.json({
          success: true,
          message: 'Notifications marked as read'
        })

      default:
        return NextResponse.json(
          { 
            success: false, 
            error: 'Invalid action' 
          },
          { status: 400 }
        )
    }

  } catch (error: any) {
    console.error('❌ Partner dashboard action error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Failed to process action',
        details: error.message
      },
      { status: 500 }
    )
  }
}