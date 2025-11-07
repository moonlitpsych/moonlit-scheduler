/**
 * DEBUG: Find and link patient's IntakeQ client ID from their appointment
 * GET /api/debug/link-patient-from-appointment?appointmentId=xxx
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { intakeQService } from '@/lib/services/intakeQService'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const appointmentId = searchParams.get('appointmentId')

    if (!appointmentId) {
      return NextResponse.json({
        error: 'appointmentId parameter required'
      }, { status: 400 })
    }

    // 1. Get appointment from database
    const { data: appointment, error: apptError } = await supabaseAdmin
      .from('appointments')
      .select('id, patient_id, pq_appointment_id, start_time')
      .eq('id', appointmentId)
      .single()

    if (apptError || !appointment) {
      return NextResponse.json({
        error: 'Appointment not found',
        details: apptError?.message
      }, { status: 404 })
    }

    const result: any = {
      appointment: {
        id: appointment.id,
        patient_id: appointment.patient_id,
        pq_appointment_id: appointment.pq_appointment_id,
        start_time: appointment.start_time
      }
    }

    // 2. If appointment has IntakeQ ID, fetch it to get client ID
    if (appointment.pq_appointment_id) {
      try {
        const intakeqAppt = await intakeQService.getAppointment(appointment.pq_appointment_id)

        result.intakeq_appointment = {
          id: intakeqAppt.Id,
          client_id: intakeqAppt.ClientId,
          client_name: intakeqAppt.ClientName
        }

        // 3. Check if patient needs to be linked
        const { data: patient } = await supabaseAdmin
          .from('patients')
          .select('id, first_name, last_name, practiceq_client_id')
          .eq('id', appointment.patient_id)
          .single()

        result.patient = patient

        if (patient && !patient.practiceq_client_id && intakeqAppt.ClientId) {
          // 4. Update patient with IntakeQ client ID
          const { error: updateError } = await supabaseAdmin
            .from('patients')
            .update({ practiceq_client_id: intakeqAppt.ClientId })
            .eq('id', appointment.patient_id)

          if (updateError) {
            result.link_status = 'FAILED'
            result.link_error = updateError.message
          } else {
            result.link_status = 'SUCCESS'
            result.message = `✅ Linked patient ${patient.first_name} ${patient.last_name} to IntakeQ client ${intakeqAppt.ClientId}`
          }
        } else if (patient?.practiceq_client_id) {
          result.link_status = 'ALREADY_LINKED'
          result.message = `Patient already linked to IntakeQ client ${patient.practiceq_client_id}`
        }

      } catch (intakeqError: any) {
        result.intakeq_error = intakeqError.message
        result.link_status = 'INTAKEQ_API_FAILED'
      }
    } else {
      result.link_status = 'NO_INTAKEQ_APPOINTMENT_ID'
      result.message = 'Appointment does not have an IntakeQ ID (pq_appointment_id is null)'
    }

    return NextResponse.json(result)

  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}
