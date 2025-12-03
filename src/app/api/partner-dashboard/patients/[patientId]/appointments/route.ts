/**
 * Partner Dashboard API - Patient Appointments
 * Get past and upcoming appointments for a specific patient
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ patientId: string }> }
) {
  try {
    // Await params (Next.js 15 requirement)
    const { patientId } = await params

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

    // Get partner user
    const { data: partnerUser, error: userError } = await supabaseAdmin
      .from('partner_users')
      .select('id, organization_id, role')
      .eq('auth_user_id', session.user.id)
      .eq('is_active', true)
      .single()

    if (userError || !partnerUser) {
      return NextResponse.json(
        { success: false, error: 'Partner user not found' },
        { status: 404 }
      )
    }

    // Verify patient belongs to partner's organization
    const { data: affiliation, error: affiliationError } = await supabaseAdmin
      .from('patient_organization_affiliations')
      .select('id')
      .eq('patient_id', patientId)
      .eq('organization_id', partnerUser.organization_id)
      .eq('status', 'active')
      .single()

    if (affiliationError || !affiliation) {
      return NextResponse.json(
        { success: false, error: 'Patient not found or not affiliated with your organization' },
        { status: 404 }
      )
    }

    const now = new Date().toISOString()

    // Fetch past appointments
    const { data: pastAppointments, error: pastError } = await supabaseAdmin
      .from('appointments')
      .select(`
        id,
        start_time,
        end_time,
        status,
        appointment_type,
        notes,
        meeting_url,
        practiceq_generated_google_meet,
        providers:providers!appointments_provider_id_fkey (
          id,
          first_name,
          last_name
        )
      `)
      .eq('patient_id', patientId)
      .lt('start_time', now)
      .order('start_time', { ascending: false })
      .limit(20)

    if (pastError) {
      console.error('Error fetching past appointments:', pastError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch appointments' },
        { status: 500 }
      )
    }

    // Fetch upcoming appointments
    const { data: upcomingAppointments, error: upcomingError } = await supabaseAdmin
      .from('appointments')
      .select(`
        id,
        start_time,
        end_time,
        status,
        appointment_type,
        notes,
        meeting_url,
        practiceq_generated_google_meet,
        providers:providers!appointments_provider_id_fkey (
          id,
          first_name,
          last_name
        )
      `)
      .eq('patient_id', patientId)
      .gte('start_time', now)
      .in('status', ['scheduled', 'confirmed'])
      .order('start_time', { ascending: true })
      .limit(10)

    if (upcomingError) {
      console.error('Error fetching upcoming appointments:', upcomingError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch appointments' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        past: pastAppointments || [],
        upcoming: upcomingAppointments || []
      }
    })

  } catch (error: any) {
    console.error('❌ Error fetching patient appointments:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch patient appointments', details: error.message },
      { status: 500 }
    )
  }
}
