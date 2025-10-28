/**
 * Mark Patient as Test API
 *
 * PUT /api/patients/[id]/mark-test
 * - Updates patient's is_test_patient flag
 * - Used by admin to mark test data
 *
 * Request Body:
 * {
 *   is_test_patient: boolean
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const { id: patientId } = await params

  try {
    const body = await request.json()

    // Validate required field
    if (typeof body.is_test_patient !== 'boolean') {
      return NextResponse.json(
        { error: 'Missing or invalid required field: is_test_patient (must be boolean)' },
        { status: 400 }
      )
    }

    // Check if patient exists
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('id, first_name, last_name, email')
      .eq('id', patientId)
      .single()

    if (patientError || !patient) {
      return NextResponse.json(
        { error: 'Patient not found' },
        { status: 404 }
      )
    }

    // Update is_test_patient flag
    const { data: updatedPatient, error: updateError } = await supabase
      .from('patients')
      .update({
        is_test_patient: body.is_test_patient,
        updated_at: new Date().toISOString()
      })
      .eq('id', patientId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating test patient flag:', updateError)
      return NextResponse.json(
        {
          error: 'Failed to update test patient flag',
          message: updateError.message
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Patient ${body.is_test_patient ? 'marked' : 'unmarked'} as test data`,
      patient_id: patientId,
      patient_name: `${patient.first_name} ${patient.last_name}`,
      is_test_patient: body.is_test_patient
    })

  } catch (error: any) {
    console.error('Error in mark-test PUT:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message
      },
      { status: 500 }
    )
  }
}
