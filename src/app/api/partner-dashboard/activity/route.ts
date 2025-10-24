/**
 * Partner Dashboard API - Activity Feed
 * Returns activity log entries for patients affiliated with partner organization
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

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const patientId = searchParams.get('patient_id')
    const limit = parseInt(searchParams.get('limit') || '50')

    let query = supabaseAdmin
      .from('patient_activity_log')
      .select(`
        id,
        patient_id,
        organization_id,
        appointment_id,
        activity_type,
        title,
        description,
        metadata,
        actor_type,
        actor_id,
        actor_name,
        visible_to_partner,
        created_at,
        patients (
          id,
          first_name,
          last_name
        ),
        appointments (
          id,
          start_time,
          status,
          providers (
            first_name,
            last_name
          )
        )
      `)
      .eq('visible_to_partner', true)
      .order('created_at', { ascending: false })
      .limit(limit)

    // Filter by patient if specified
    if (patientId) {
      query = query.eq('patient_id', patientId)
    } else {
      // Filter by organization for general feed
      query = query.eq('organization_id', partnerUser.organization_id)
    }

    const { data: activities, error: activitiesError } = await query

    if (activitiesError) {
      console.error('Error fetching activities:', activitiesError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch activity feed' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        activities: activities || [],
        count: activities?.length || 0
      }
    })

  } catch (error: any) {
    console.error('❌ Error fetching activity feed:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch activity feed', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST - Create activity log entry
 * For partner-initiated actions (notes, transfers, etc.)
 */
export async function POST(request: NextRequest) {
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
      .select('id, organization_id, full_name, is_active')
      .eq('auth_user_id', session.user.id)
      .eq('is_active', true)
      .single()

    if (userError || !partnerUser) {
      return NextResponse.json(
        { success: false, error: 'Partner user not found' },
        { status: 404 }
      )
    }

    // Get request body
    const body = await request.json()
    const {
      patient_id,
      appointment_id,
      activity_type,
      title,
      description,
      metadata
    } = body

    if (!patient_id || !activity_type || !title) {
      return NextResponse.json(
        { success: false, error: 'patient_id, activity_type, and title are required' },
        { status: 400 }
      )
    }

    // Valid activity types for partner users
    const validTypes = [
      'note_added',
      'case_manager_assigned',
      'case_manager_transferred',
      'roi_granted',
      'roi_expired'
    ]

    if (!validTypes.includes(activity_type)) {
      return NextResponse.json(
        { success: false, error: `Invalid activity_type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Create activity log entry
    const { data: activity, error: insertError } = await supabaseAdmin
      .from('patient_activity_log')
      .insert({
        patient_id,
        organization_id: partnerUser.organization_id,
        appointment_id: appointment_id || null,
        activity_type,
        title,
        description: description || null,
        metadata: metadata || null,
        actor_type: 'partner_user',
        actor_id: partnerUser.id,
        actor_name: partnerUser.full_name || 'Partner User',
        visible_to_partner: true,
        visible_to_patient: false // Partner actions not visible to patient by default
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating activity log entry:', insertError)
      return NextResponse.json(
        { success: false, error: 'Failed to create activity log entry' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: activity
    })

  } catch (error: any) {
    console.error('❌ Error creating activity log entry:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create activity log entry', details: error.message },
      { status: 500 }
    )
  }
}
