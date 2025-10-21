/**
 * GET /api/patients/[id]/status-history
 *
 * Returns complete audit trail of engagement status changes for a patient.
 * Includes who changed it, when, why, and whether admin was notified.
 *
 * Query Parameters:
 * - limit: Max results (default: 50)
 * - offset: Pagination offset (default: 0)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const patientId = params.id

  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)
    const offset = parseInt(searchParams.get('offset') || '0')

    // Verify patient exists
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

    // Get status change history
    const { data: history, error: historyError, count } = await supabase
      .from('patient_engagement_status_history')
      .select('*', { count: 'exact' })
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (historyError) {
      console.error('Error fetching status history:', historyError)
      return NextResponse.json(
        {
          error: 'Failed to fetch status history',
          message: historyError.message
        },
        { status: 500 }
      )
    }

    // Get current status
    const { data: currentStatus } = await supabase
      .from('patient_engagement_status')
      .select('status, effective_date, changed_by_email, updated_at')
      .eq('patient_id', patientId)
      .single()

    return NextResponse.json({
      patient: {
        id: patient.id,
        name: `${patient.first_name} ${patient.last_name}`,
        email: patient.email
      },
      current_status: currentStatus || {
        status: 'active',
        effective_date: null,
        is_default: true
      },
      history: history || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        has_more: count ? offset + limit < count : false
      }
    })

  } catch (error: any) {
    console.error('Error in status-history endpoint:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message
      },
      { status: 500 }
    )
  }
}
