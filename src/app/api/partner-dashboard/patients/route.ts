/**
 * Partner Dashboard API - Get Assigned Patients
 * Returns list of patients assigned to the authenticated partner user
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

    // Get patients based on role
    // partner_admin and partner_case_manager: see all org patients
    // partner_referrer: only see patients they referred
    let patientsQuery

    if (partnerUser.role === 'partner_referrer') {
      // Referrers only see patients they referred
      const { data: patients, error: patientsError } = await supabaseAdmin
        .from('patients')
        .select(`
          id,
          first_name,
          last_name,
          email,
          phone,
          date_of_birth,
          status,
          referred_by_partner_user_id,
          created_at
        `)
        .eq('referred_by_partner_user_id', partnerUser.id)
        .order('created_at', { ascending: false })

      if (patientsError) {
        console.error('Error fetching referred patients:', patientsError)
        return NextResponse.json(
          { success: false, error: 'Failed to fetch patients' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        data: {
          patients: patients || [],
          count: patients?.length || 0
        }
      })
    }

    // Admin and case managers see all org patients via affiliations
    const { data: affiliations, error: affiliationsError } = await supabaseAdmin
      .from('patient_organization_affiliations')
      .select(`
        id,
        patient_id,
        affiliation_type,
        start_date,
        consent_on_file,
        consent_expires_on,
        primary_contact_user_id,
        status,
        patients (
          id,
          first_name,
          last_name,
          email,
          phone,
          date_of_birth,
          status,
          primary_insurance_payer:payers (
            id,
            name
          )
        )
      `)
      .eq('organization_id', partnerUser.organization_id)
      .eq('status', 'active')
      .order('start_date', { ascending: false })

    if (affiliationsError) {
      console.error('Error fetching patient affiliations:', affiliationsError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch patients' },
        { status: 500 }
      )
    }

    // Get assignments for case managers
    const { data: assignments, error: assignmentsError } = await supabaseAdmin
      .from('partner_user_patient_assignments')
      .select('patient_id, assignment_type')
      .eq('partner_user_id', partnerUser.id)
      .eq('status', 'active')

    if (assignmentsError) {
      console.error('Error fetching assignments:', assignmentsError)
    }

    const assignedPatientIds = new Set(assignments?.map(a => a.patient_id) || [])

    // Get upcoming appointments for these patients
    const patientIds = affiliations?.map(a => a.patient_id) || []

    const { data: appointments, error: appointmentsError } = await supabaseAdmin
      .from('appointments')
      .select(`
        id,
        patient_id,
        start_time,
        status,
        providers (
          id,
          first_name,
          last_name
        )
      `)
      .in('patient_id', patientIds)
      .in('status', ['scheduled', 'confirmed'])
      .gte('start_time', new Date().toISOString())
      .order('start_time', { ascending: true })

    if (appointmentsError) {
      console.error('Error fetching appointments:', appointmentsError)
    }

    // Group appointments by patient
    const appointmentsByPatient = (appointments || []).reduce((acc, appt) => {
      if (!acc[appt.patient_id]) {
        acc[appt.patient_id] = []
      }
      acc[appt.patient_id].push(appt)
      return acc
    }, {} as Record<string, any[]>)

    // Format response
    const patientsWithDetails = affiliations?.map(affiliation => ({
      ...affiliation.patients,
      affiliation: {
        id: affiliation.id,
        affiliation_type: affiliation.affiliation_type,
        start_date: affiliation.start_date,
        consent_on_file: affiliation.consent_on_file,
        consent_expires_on: affiliation.consent_expires_on,
        consent_status: affiliation.consent_on_file
          ? (affiliation.consent_expires_on && new Date(affiliation.consent_expires_on) < new Date()
            ? 'expired'
            : 'active')
          : 'missing',
        primary_contact_user_id: affiliation.primary_contact_user_id,
        status: affiliation.status
      },
      is_assigned_to_me: assignedPatientIds.has(affiliation.patient_id),
      next_appointment: appointmentsByPatient[affiliation.patient_id]?.[0] || null,
      upcoming_appointment_count: appointmentsByPatient[affiliation.patient_id]?.length || 0
    })) || []

    return NextResponse.json({
      success: true,
      data: {
        patients: patientsWithDetails,
        count: patientsWithDetails.length,
        assigned_count: patientsWithDetails.filter(p => p.is_assigned_to_me).length
      }
    })

  } catch (error: any) {
    console.error('❌ Error fetching patients:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch patients', details: error.message },
      { status: 500 }
    )
  }
}
