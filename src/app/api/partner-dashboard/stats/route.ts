/**
 * Partner Dashboard API - Dashboard Statistics
 * Returns stats for the dashboard home page
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
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
    const { searchParams } = new URL(request.url)
    const partnerUserId = searchParams.get('partner_user_id')

    // Get partner user record
    let partnerUserQuery = supabaseAdmin
      .from('partner_users')
      .select('id, organization_id, role, is_active')
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
        { success: false, error: 'Partner user not found' },
        { status: 404 }
      )
    }

    // Get total patients (via affiliations)
    const { count: totalPatients } = await supabaseAdmin
      .from('patient_organization_affiliations')
      .select('patient_id', { count: 'exact', head: true })
      .eq('organization_id', partnerUser.organization_id)
      .eq('status', 'active')

    // Get active patients (those with valid ROI consent)
    const { data: affiliations } = await supabaseAdmin
      .from('patient_organization_affiliations')
      .select('consent_on_file, consent_expires_on')
      .eq('organization_id', partnerUser.organization_id)
      .eq('status', 'active')

    const activePatients = affiliations?.filter(a => {
      if (!a.consent_on_file) return false
      if (a.consent_expires_on && new Date(a.consent_expires_on) < new Date()) return false
      return true
    }).length || 0

    // Get appointments this week
    const now = new Date()
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay()) // Sunday
    startOfWeek.setHours(0, 0, 0, 0)

    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 7)

    // Get patient IDs for this organization
    const { data: orgAffiliations } = await supabaseAdmin
      .from('patient_organization_affiliations')
      .select('patient_id')
      .eq('organization_id', partnerUser.organization_id)
      .eq('status', 'active')

    const patientIds = orgAffiliations?.map(a => a.patient_id) || []

    let appointmentsThisWeek = 0
    if (patientIds.length > 0) {
      const { count } = await supabaseAdmin
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .in('patient_id', patientIds)
        .in('status', ['scheduled', 'confirmed'])
        .gte('start_time', startOfWeek.toISOString())
        .lt('start_time', endOfWeek.toISOString())

      appointmentsThisWeek = count || 0
    }

    // Get upcoming appointments with full details
    let upcomingAppointments: any[] = []
    if (patientIds.length > 0) {
      const { data: appointments, error: apptError } = await supabaseAdmin
        .from('appointments')
        .select(`
          id,
          start_time,
          end_time,
          status,
          providers!appointments_provider_id_fkey (
            id,
            first_name,
            last_name,
            title
          ),
          patients (
            id,
            first_name,
            last_name,
            phone
          ),
          payers (
            id,
            name
          )
        `)
        .in('patient_id', patientIds)
        .in('status', ['scheduled', 'confirmed'])
        .gte('start_time', now.toISOString())
        .order('start_time', { ascending: true })
        .limit(10)

      if (!apptError && appointments) {
        upcomingAppointments = appointments
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        organization_stats: {
          total_patients: totalPatients || 0,
          active_patients: activePatients,
          appointments_this_week: appointmentsThisWeek
        },
        upcoming_appointments: upcomingAppointments
      }
    })

  } catch (error: any) {
    console.error('❌ Error fetching dashboard stats:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dashboard stats', details: error.message },
      { status: 500 }
    )
  }
}
