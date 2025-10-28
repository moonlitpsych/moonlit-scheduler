/**
 * Patient Engagement Status API
 *
 * GET /api/patients/[id]/engagement-status
 * - Returns current engagement status for a patient
 *
 * PUT /api/patients/[id]/engagement-status
 * - Updates patient engagement status
 * - Logs change to history table
 * - Sends notification to admin if changed by case manager
 *
 * Request Body:
 * {
 *   status: 'active' | 'discharged' | 'transferred' | 'deceased' | 'inactive',
 *   effective_date: '2025-10-21T00:00:00Z',  // Optional, defaults to now
 *   change_reason: 'Patient completed treatment program',  // Optional
 *   changed_by_email: 'user@example.com'  // Required
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

const VALID_STATUSES = ['active', 'discharged', 'transferred', 'deceased', 'inactive']

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const { id: patientId } = await params

  try {
    // Get current engagement status
    const { data, error } = await supabase
      .from('patient_engagement_status')
      .select('*')
      .eq('patient_id', patientId)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned
      console.error('Error fetching engagement status:', error)
      return NextResponse.json(
        {
          error: 'Failed to fetch engagement status',
          message: error.message
        },
        { status: 500 }
      )
    }

    // If no status exists, return default 'active'
    if (!data) {
      return NextResponse.json({
        patient_id: patientId,
        status: 'active',
        effective_date: null,
        is_default: true,
        message: 'No explicit status set - defaulting to active'
      })
    }

    return NextResponse.json(data)

  } catch (error: any) {
    console.error('Error in engagement-status GET:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message
      },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const { id: patientId } = await params

  try {
    const body = await request.json()

    // Validate required fields
    if (!body.status) {
      return NextResponse.json(
        { error: 'Missing required field: status' },
        { status: 400 }
      )
    }

    if (!body.changed_by_email) {
      return NextResponse.json(
        { error: 'Missing required field: changed_by_email' },
        { status: 400 }
      )
    }

    // Validate status value
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json(
        {
          error: 'Invalid status value',
          valid_values: VALID_STATUSES
        },
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

    // Get current status to check if it's actually changing
    const { data: currentStatus } = await supabase
      .from('patient_engagement_status')
      .select('status, id')
      .eq('patient_id', patientId)
      .single()

    const previousStatus = currentStatus?.status || 'active'

    // If status isn't changing, return early
    if (previousStatus === body.status) {
      return NextResponse.json({
        message: 'Status unchanged',
        patient_id: patientId,
        status: body.status,
        changed: false
      })
    }

    // Prepare update/insert data
    const statusData = {
      patient_id: patientId,
      status: body.status,
      effective_date: body.effective_date || new Date().toISOString(),
      changed_by_email: body.changed_by_email,
      change_reason: body.change_reason || null,
      previous_status: previousStatus,
      updated_at: new Date().toISOString()
    }

    // Upsert engagement status
    const { data: updatedStatus, error: updateError } = await supabase
      .from('patient_engagement_status')
      .upsert(statusData, {
        onConflict: 'patient_id',
        ignoreDuplicates: false
      })
      .select()
      .single()

    if (updateError) {
      console.error('Error updating engagement status:', updateError)
      return NextResponse.json(
        {
          error: 'Failed to update engagement status',
          message: updateError.message
        },
        { status: 500 }
      )
    }

    // Determine if this needs admin notification
    // (Case managers changing status to non-active should notify admin)
    const needsNotification = body.status !== 'active' && body.changed_by_type === 'partner_user'

    // Update history record to mark notification needed
    if (needsNotification) {
      const { error: historyError } = await supabase
        .from('patient_engagement_status_history')
        .update({
          notification_sent: false,
          changed_by_type: 'partner_user'
        })
        .eq('patient_id', patientId)
        .eq('new_status', body.status)
        .order('created_at', { ascending: false })
        .limit(1)

      if (historyError) {
        console.warn('Failed to mark history for notification:', historyError)
      }
    }

    // Refresh materialized view (WAIT for it to complete to ensure UI shows updated data)
    console.log('🔄 Refreshing patient_activity_summary materialized view...')
    const { error: refreshError } = await supabase.rpc('refresh_patient_activity_summary')

    if (refreshError) {
      console.error('⚠️ Failed to refresh patient activity summary:', refreshError.message)
      // Don't fail the entire request, but warn about it
    } else {
      console.log('✅ Successfully refreshed patient activity summary')
    }

    return NextResponse.json({
      message: 'Engagement status updated successfully',
      patient_id: patientId,
      patient_name: `${patient.first_name} ${patient.last_name}`,
      previous_status: previousStatus,
      new_status: body.status,
      effective_date: statusData.effective_date,
      changed_by: body.changed_by_email,
      needs_admin_notification: needsNotification,
      changed: true
    })

  } catch (error: any) {
    console.error('Error in engagement-status PUT:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message
      },
      { status: 500 }
    )
  }
}
