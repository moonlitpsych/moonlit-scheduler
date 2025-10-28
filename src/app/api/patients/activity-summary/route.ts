/**
 * GET /api/patients/activity-summary
 *
 * Returns patient activity summary with engagement status and appointment data.
 * Supports filtering by:
 * - Engagement status (active, discharged, etc.)
 * - Organization (for partner users)
 * - Has future appointment (yes/no)
 * - Days since last seen
 * - Provider assignment
 * - Exclude test patients
 *
 * Query Parameters:
 * - status: Filter by engagement status (active, discharged, transferred, deceased, inactive)
 * - organization_id: Filter by organization (for partner dashboard)
 * - has_future_appointment: true/false
 * - no_appointment_since_days: Filter patients not seen in X days
 * - provider_id: Filter by provider
 * - exclude_test_patients: true/false (default: false)
 * - sort_by: last_seen|next_appointment|patient_name (default: patient_name)
 * - sort_order: asc|desc (default: asc)
 * - limit: Max results (default: 100, max: 1000)
 * - offset: Pagination offset (default: 0)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

export async function GET(request: NextRequest) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const { searchParams } = new URL(request.url)

    // Parse query parameters
    const status = searchParams.get('status') || undefined
    const organizationId = searchParams.get('organization_id') || undefined
    const hasFutureAppointment = searchParams.get('has_future_appointment')
    const noAppointmentSinceDays = searchParams.get('no_appointment_since_days')
    const providerId = searchParams.get('provider_id') || undefined
    const excludeTestPatients = searchParams.get('exclude_test_patients') === 'true'
    const sortBy = searchParams.get('sort_by') || 'patient_name'
    const sortOrder = searchParams.get('sort_order') || 'asc'
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 1000)
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build query - TODO: Convert to regular view for real-time data
    let query = supabase
      .from('v_patient_activity_summary')
      .select('*', { count: 'exact' })

    // Apply filters
    if (status) {
      query = query.eq('engagement_status', status)
    }

    if (organizationId) {
      query = query.contains('shared_with_org_ids', [organizationId])
    }

    if (hasFutureAppointment !== null) {
      const hasAppt = hasFutureAppointment === 'true'
      query = query.eq('has_future_appointment', hasAppt)
    }

    if (noAppointmentSinceDays) {
      const days = parseInt(noAppointmentSinceDays)
      query = query.gte('days_since_last_seen', days)
    }

    if (providerId) {
      // Filter by primary provider (assigned provider) for "My Patients" view
      query = query.eq('primary_provider_id', providerId)
    }

    if (excludeTestPatients) {
      // Exclude test patients (default behavior in admin views)
      query = query.eq('is_test_patient', false)
    }

    // Apply sorting
    switch (sortBy) {
      case 'last_seen':
        query = query.order('last_seen_date', {
          ascending: sortOrder === 'asc',
          nullsFirst: false
        })
        break
      case 'next_appointment':
        query = query.order('next_appointment_date', {
          ascending: sortOrder === 'asc',
          nullsFirst: false
        })
        break
      case 'patient_name':
      default:
        query = query.order('last_name', { ascending: sortOrder === 'asc' })
        query = query.order('first_name', { ascending: sortOrder === 'asc' })
        break
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    // Execute query
    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching patient activity summary:', error)
      return NextResponse.json(
        {
          error: 'Failed to fetch patient activity summary',
          message: error.message
        },
        { status: 500 }
      )
    }

    // Return results with pagination metadata
    return NextResponse.json({
      patients: data || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        has_more: count ? offset + limit < count : false
      },
      filters_applied: {
        status,
        organization_id: organizationId,
        has_future_appointment: hasFutureAppointment,
        no_appointment_since_days: noAppointmentSinceDays,
        provider_id: providerId
      }
    })

  } catch (error: any) {
    console.error('Error in activity-summary endpoint:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message
      },
      { status: 500 }
    )
  }
}
