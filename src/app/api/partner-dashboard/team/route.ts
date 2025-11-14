/**
 * Partner Dashboard API - Team Members
 * Returns active case managers and admins in the organization
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
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
    const includeReferrers = searchParams.get('include_referrers') === 'true'

    // Build query for team members
    let query = supabaseAdmin
      .from('partner_users')
      .select('id, full_name, email, role, last_login_at, created_at')
      .eq('organization_id', partnerUser.organization_id)
      .eq('is_active', true)
      .order('full_name', { ascending: true })

    // Filter by role: only case managers and admins (exclude referrers by default)
    if (!includeReferrers) {
      query = query.in('role', ['partner_admin', 'partner_case_manager'])
    }

    const { data: teamMembers, error: teamError } = await query

    if (teamError) {
      console.error('Error fetching team members:', teamError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch team members' },
        { status: 500 }
      )
    }

    // Get assignment counts for each team member
    const teamMembersWithCounts = await Promise.all(
      (teamMembers || []).map(async (member) => {
        const { count } = await supabaseAdmin
          .from('partner_user_patient_assignments')
          .select('id', { count: 'exact', head: true })
          .eq('partner_user_id', member.id)
          .eq('status', 'active')

        return {
          ...member,
          active_patient_count: count || 0
        }
      })
    )

    return NextResponse.json({
      success: true,
      data: {
        team_members: teamMembersWithCounts,
        count: teamMembersWithCounts.length
      }
    })

  } catch (error: any) {
    console.error('❌ Error fetching team members:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch team members', details: error.message },
      { status: 500 }
    )
  }
}
