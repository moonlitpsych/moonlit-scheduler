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
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    if (sessionError || !session) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get partner user record
    const { data: partnerUser, error: userError } = await supabaseAdmin
      .from('partner_users')
      .select('id, organization_id, role, is_active')
      .eq('auth_user_id', session.user.id)
      .eq('is_active', true)
      .single()

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

    // TODO: Pending changes (placeholder for now)
    const pendingChanges = 0

    return NextResponse.json({
      success: true,
      data: {
        organization_stats: {
          total_patients: totalPatients || 0,
          active_patients: activePatients,
          appointments_this_week: appointmentsThisWeek,
          pending_changes: pendingChanges
        }
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
