/**
 * Partner Dashboard API - Patient Activity Log
 * Get activity log for a specific patient
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: { patientId: string } }
) {
  try {
    // Get authenticated user
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    if (sessionError || !session) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get partner user
    const { data: partnerUser, error: userError } = await supabaseAdmin
      .from('partner_users')
      .select('id, organization_id, role')
      .eq('auth_user_id', session.user.id)
      .eq('is_active', true)
      .single()

    if (userError || !partnerUser) {
      return NextResponse.json(
        { success: false, error: 'Partner user not found' },
        { status: 404 }
      )
    }

    // Verify patient belongs to partner's organization
    const { data: affiliation, error: affiliationError } = await supabaseAdmin
      .from('patient_organization_affiliations')
      .select('id')
      .eq('patient_id', params.patientId)
      .eq('organization_id', partnerUser.organization_id)
      .eq('status', 'active')
      .single()

    if (affiliationError || !affiliation) {
      return NextResponse.json(
        { success: false, error: 'Patient not found or not affiliated with your organization' },
        { status: 404 }
      )
    }

    // Get activity log
    const { data: activities, error: activitiesError } = await supabaseAdmin
      .from('patient_activity_log')
      .select('id, activity_type, title, description, created_at, actor_name')
      .eq('patient_id', params.patientId)
      .eq('organization_id', partnerUser.organization_id)
      .eq('visible_to_partner', true)
      .order('created_at', { ascending: false })
      .limit(50)

    if (activitiesError) {
      console.error('Error fetching activity log:', activitiesError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch activity log' },
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
    console.error('❌ Error fetching patient activity:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch patient activity', details: error.message },
      { status: 500 }
    )
  }
}
