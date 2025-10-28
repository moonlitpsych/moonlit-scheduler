import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

export const dynamic = 'force-dynamic'

/**
 * Debug endpoint to check patient engagement status
 * GET /api/debug/check-patient-status?patient_id=xxx
 */
export async function GET(request: NextRequest) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const searchParams = request.nextUrl.searchParams
  const patientId = searchParams.get('patient_id')

  if (!patientId) {
    return NextResponse.json({
      error: 'Missing patient_id parameter'
    }, { status: 400 })
  }

  try {
    // Get patient info
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('id, first_name, last_name, email')
      .eq('id', patientId)
      .single()

    if (patientError || !patient) {
      return NextResponse.json({
        error: 'Patient not found',
        details: patientError
      }, { status: 404 })
    }

    // Get engagement status from patient_engagement_status table
    const { data: engagementStatus, error: statusError } = await supabase
      .from('patient_engagement_status')
      .select('*')
      .eq('patient_id', patientId)
      .single()

    // Get from activity summary view (what the admin dashboard shows)
    const { data: activitySummary, error: summaryError } = await supabase
      .from('patient_activity_summary')
      .select('engagement_status')
      .eq('patient_id', patientId)
      .single()

    // Get status history
    const { data: statusHistory, error: historyError } = await supabase
      .from('patient_engagement_status_history')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(5)

    return NextResponse.json({
      success: true,
      patient: {
        id: patient.id,
        name: `${patient.first_name} ${patient.last_name}`,
        email: patient.email
      },
      engagement_status_table: engagementStatus || 'No record found (defaults to active)',
      activity_summary_view: activitySummary?.engagement_status || 'No record in view',
      status_history: statusHistory || [],
      potential_issues: {
        no_engagement_record: !engagementStatus ? 'Patient has no explicit engagement status (defaults to active)' : null,
        view_out_of_sync: activitySummary && engagementStatus && activitySummary.engagement_status !== engagementStatus.status
          ? `View shows "${activitySummary.engagement_status}" but table shows "${engagementStatus.status}"`
          : null,
        no_history: !statusHistory || statusHistory.length === 0 ? 'No status change history found' : null
      }
    })
  } catch (error: any) {
    console.error('Error checking patient status:', error)
    return NextResponse.json({
      error: 'Internal server error',
      message: error.message
    }, { status: 500 })
  }
}
