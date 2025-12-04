/**
 * Admin Organizations API - Team Members
 * GET /api/admin/organizations/[id]/team - Get team members for an organization
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isAdminEmail } from '@/lib/admin-auth'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

async function verifyAdminAccess() {
  try {
    const supabase = createServerComponentClient({ cookies })
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user || !isAdminEmail(user.email || '')) {
      return { authorized: false, user: null }
    }

    return { authorized: true, user }
  } catch (error) {
    console.error('Admin verification error:', error)
    return { authorized: false, user: null }
  }
}

// GET - Get team members for an organization
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { authorized } = await verifyAdminAccess()
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    const { id } = await params

    // Verify organization exists
    const { data: organization, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('id, name')
      .eq('id', id)
      .single()

    if (orgError || !organization) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 404 }
      )
    }

    // Get team members
    const { data: teamMembers, error: teamError } = await supabaseAdmin
      .from('partner_users')
      .select(`
        id,
        full_name,
        email,
        role,
        is_active,
        auth_user_id,
        last_login_at,
        created_at,
        updated_at
      `)
      .eq('organization_id', id)
      .order('full_name', { ascending: true })

    if (teamError) {
      console.error('Error fetching team members:', teamError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch team members' },
        { status: 500 }
      )
    }

    // Get pending invitations for this organization
    const { data: pendingInvites } = await supabaseAdmin
      .from('partner_auth_tokens')
      .select('email, expires_at, created_at')
      .eq('organization_id', id)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())

    // Create a map of pending invites by email
    const pendingInviteMap = new Map(
      (pendingInvites || []).map(invite => [invite.email.toLowerCase(), invite])
    )

    // Get assignment counts for each team member
    const teamMembersWithDetails = await Promise.all(
      (teamMembers || []).map(async (member) => {
        // Get active assignment count
        const { count: activePatientCount } = await supabaseAdmin
          .from('partner_user_patient_assignments')
          .select('id', { count: 'exact', head: true })
          .eq('partner_user_id', member.id)
          .eq('status', 'active')

        // Compute status based on auth_user_id and is_active
        let status: 'active' | 'pending' | 'inactive'
        let invitationExpires: string | null = null

        if (!member.is_active) {
          status = 'inactive'
        } else if (!member.auth_user_id) {
          // User record exists but hasn't signed up yet
          // Check if there's a pending invite
          const pendingInvite = pendingInviteMap.get(member.email.toLowerCase())
          if (pendingInvite) {
            status = 'pending'
            invitationExpires = pendingInvite.expires_at
          } else {
            // User record exists but no pending invite - could be expired or never sent
            status = 'pending'
          }
        } else {
          status = 'active'
        }

        return {
          id: member.id,
          full_name: member.full_name,
          email: member.email,
          role: member.role,
          is_active: member.is_active,
          status,
          active_patient_count: activePatientCount || 0,
          last_login_at: member.last_login_at,
          invitation_expires: invitationExpires,
          created_at: member.created_at
        }
      })
    )

    // Also include pending invites that don't have a partner_user record yet
    const existingEmails = new Set(
      (teamMembers || []).map(m => m.email.toLowerCase())
    )

    const pendingOnlyInvites = (pendingInvites || [])
      .filter(invite => !existingEmails.has(invite.email.toLowerCase()))
      .map(invite => ({
        id: null,
        full_name: null,
        email: invite.email,
        role: null,
        is_active: false,
        status: 'pending' as const,
        active_patient_count: 0,
        last_login_at: null,
        invitation_expires: invite.expires_at,
        created_at: invite.created_at
      }))

    const allMembers = [...teamMembersWithDetails, ...pendingOnlyInvites]

    return NextResponse.json({
      success: true,
      data: {
        organization: {
          id: organization.id,
          name: organization.name
        },
        team_members: allMembers,
        count: allMembers.length,
        active_count: allMembers.filter(m => m.status === 'active').length,
        pending_count: allMembers.filter(m => m.status === 'pending').length,
        inactive_count: allMembers.filter(m => m.status === 'inactive').length
      }
    })

  } catch (error: any) {
    console.error('❌ Error fetching organization team:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch team members', details: error.message },
      { status: 500 }
    )
  }
}
