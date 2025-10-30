// src/app/api/debug/list-intakeq-clients/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

/**
 * Debug endpoint to list appointments with IntakeQ client IDs
 *
 * Usage:
 *   GET /api/debug/list-intakeq-clients?limit=10
 *
 * Purpose:
 *   - Find appointments with pq_client_id (IntakeQ client IDs)
 *   - Provide test data for copay checking
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')

    console.log(`🔍 [IntakeQ Clients] Fetching appointments with IntakeQ client IDs (limit: ${limit})`)

    // Query appointments that have IntakeQ appointment IDs
    const { data: appointments, error } = await supabase
      .from('appointments')
      .select('id, start_time, pq_appointment_id, patient_info')
      .not('pq_appointment_id', 'is', null)
      .order('start_time', { ascending: false })
      .limit(limit)

    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    const intakeqAppointmentIds = [...new Set(appointments?.map(a => a.pq_appointment_id).filter(Boolean))]

    console.log(`✅ [IntakeQ Clients] Found ${appointments?.length || 0} appointments with ${intakeqAppointmentIds.length} unique IntakeQ appointment IDs`)

    return NextResponse.json({
      success: true,
      totalAppointments: appointments?.length || 0,
      uniqueIntakeqAppointmentIds: intakeqAppointmentIds.length,
      note: 'Client IDs are not stored in appointments table. To get client ID, fetch appointment from IntakeQ API.',
      appointments: appointments?.map(apt => ({
        appointmentId: apt.id,
        startTime: apt.start_time,
        patientEmail: apt.patient_info ? (apt.patient_info as any).email : 'Unknown',
        intakeqAppointmentId: apt.pq_appointment_id,
        patientName: apt.patient_info
          ? `${(apt.patient_info as any).firstName} ${(apt.patient_info as any).lastName}`
          : 'Unknown'
      })),
      testInstructions: {
        step1: 'Pick an IntakeQ appointment ID from the list above',
        step2: 'Call: GET /api/debug/check-intakeq-copay?appointment_id={INTAKEQ_APPOINTMENT_ID}',
        step3: 'The endpoint will fetch the appointment from IntakeQ (which contains ClientId), then fetch the client profile'
      }
    })

  } catch (error: any) {
    console.error('❌ [IntakeQ Clients] Error:', error)

    return NextResponse.json(
      {
        success: false,
        error: error.message,
        details: error.stack
      },
      { status: 500 }
    )
  }
}
