import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    // Query Merrick's provider data
    const { data: providers, error: providerError } = await supabaseAdmin
      .from('providers')
      .select('id, first_name, last_name, intakeq_practitioner_id, is_bookable, accepts_new_patients')
      .ilike('last_name', '%Merrick%')

    if (providerError) {
      return NextResponse.json({ error: 'Provider query failed', details: providerError }, { status: 500 })
    }

    if (!providers || providers.length === 0) {
      return NextResponse.json({ error: 'No provider found with last name containing "Merrick"' }, { status: 404 })
    }

    const merrick = providers[0]

    // Query Merrick's appointments with various statuses
    const { data: appointments, error: apptError } = await supabaseAdmin
      .from('appointments')
      .select('id, start_time, end_time, status, appointment_type, pq_appointment_id')
      .eq('provider_id', merrick.id)
      .order('start_time', { ascending: false })
      .limit(20)

    if (apptError) {
      return NextResponse.json({
        error: 'Appointments query failed',
        details: apptError,
        provider: merrick
      }, { status: 500 })
    }

    // Get distinct status values
    const statuses = appointments ? [...new Set(appointments.map(a => a.status))] : []

    return NextResponse.json({
      provider: merrick,
      intakeq_practitioner_id: merrick.intakeq_practitioner_id,
      intakeq_id_present: !!merrick.intakeq_practitioner_id,
      appointments_count: appointments?.length || 0,
      appointments: appointments,
      distinct_statuses: statuses,
      analysis: {
        has_intakeq_id: !!merrick.intakeq_practitioner_id,
        is_bookable: merrick.is_bookable,
        accepts_new_patients: merrick.accepts_new_patients,
        scheduled_appointments: appointments?.filter(a => a.status === 'scheduled').length || 0,
        other_status_appointments: appointments?.filter(a => a.status !== 'scheduled').length || 0
      }
    })
  } catch (error: any) {
    return NextResponse.json({
      error: 'Unexpected error',
      message: error.message
    }, { status: 500 })
  }
}
