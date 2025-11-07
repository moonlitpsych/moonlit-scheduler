/**
 * DEBUG: Check patient IntakeQ link
 * GET /api/debug/check-patient-intakeq?email=patient@example.com
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { intakeQService } from '@/lib/services/intakeQService'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')
    const patientId = searchParams.get('patientId')

    if (!email && !patientId) {
      return NextResponse.json({
        error: 'Provide email or patientId parameter'
      }, { status: 400 })
    }

    // 1. Find patient in database
    let query = supabaseAdmin
      .from('patients')
      .select('id, first_name, last_name, email, practiceq_client_id')

    if (email) {
      query = query.eq('email', email)
    } else {
      query = query.eq('id', patientId)
    }

    const { data: patient, error: patientError } = await query.single()

    if (patientError || !patient) {
      return NextResponse.json({
        error: 'Patient not found',
        details: patientError?.message
      }, { status: 404 })
    }

    const result: any = {
      patient: {
        id: patient.id,
        name: `${patient.first_name} ${patient.last_name}`,
        email: patient.email,
        practiceq_client_id: patient.practiceq_client_id
      },
      intakeq_link_status: patient.practiceq_client_id ? 'LINKED' : 'NOT_LINKED',
      intakeq_api_status: null,
      rate_limit: intakeQService.getRateLimitStatus()
    }

    // 2. If linked, test IntakeQ API access
    if (patient.practiceq_client_id) {
      try {
        const client = await intakeQService.getClient(patient.practiceq_client_id)
        result.intakeq_api_status = 'SUCCESS'
        result.intakeq_client = {
          id: client.Id,
          name: `${client.FirstName} ${client.LastName}`,
          email: client.Email
        }

        // Try to get notes
        try {
          const notes = await intakeQService.getClientNotes(patient.practiceq_client_id, { limit: 5 })
          result.notes_count = notes.length
          result.locked_notes_count = notes.filter((n: any) => n.Status === 'locked').length
        } catch (notesError: any) {
          result.notes_error = notesError.message
        }

      } catch (apiError: any) {
        result.intakeq_api_status = 'FAILED'
        result.intakeq_api_error = apiError.message
      }
    }

    return NextResponse.json(result, { status: 200 })

  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}
