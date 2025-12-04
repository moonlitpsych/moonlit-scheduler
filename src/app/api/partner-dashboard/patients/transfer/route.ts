/**
 * Partner Dashboard API - Patient Transfer
 * Transfer patient ownership between case managers
 *
 * Also supports admin users (Moonlit staff) - can assign patients to any case manager
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'
import { isAdminEmail } from '@/lib/admin-auth'

export async function POST(request: NextRequest) {
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

    // Check if user is a Moonlit admin (staff)
    const userIsAdmin = await isAdminEmail(session.user.email || '')

    // Get partner user record (may be null for admin users)
    const { data: partnerUser } = await supabaseAdmin
      .from('partner_users')
      .select('id, organization_id, role, is_active, full_name')
      .eq('auth_user_id', session.user.id)
      .eq('is_active', true)
      .single()

    // If not admin AND not a partner user, return 404
    if (!userIsAdmin && !partnerUser) {
      return NextResponse.json(
        { success: false, error: 'Partner user not found' },
        { status: 404 }
      )
    }

    // Only admin, partner_admin, and case_manager can transfer patients
    if (!userIsAdmin && partnerUser && !['partner_admin', 'partner_case_manager'].includes(partnerUser.role)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Get request body with error handling
    let body
    try {
      body = await request.json()
    } catch (err) {
      console.error('Invalid JSON in request body:', err)
      return NextResponse.json(
        { success: false, error: 'Invalid request body' },
        { status: 400 }
      )
    }

    const { patient_id, from_user_id, to_user_id, notes } = body

    if (!patient_id || !to_user_id) {
      return NextResponse.json(
        { success: false, error: 'patient_id and to_user_id are required' },
        { status: 400 }
      )
    }

    // Validate that to_user exists and is active
    // For admins: can assign to any case manager in any organization
    // For partners: must be in same organization
    let toUserQuery = supabaseAdmin
      .from('partner_users')
      .select('id, full_name, role, is_active, organization_id')
      .eq('id', to_user_id)
      .eq('is_active', true)

    // Partners can only assign within their organization
    if (!userIsAdmin && partnerUser) {
      toUserQuery = toUserQuery.eq('organization_id', partnerUser.organization_id)
    }

    const { data: toUser, error: toUserError } = await toUserQuery.single()

    if (toUserError || !toUser) {
      return NextResponse.json(
        { success: false, error: userIsAdmin ? 'Target user not found' : 'Target user not found or not in same organization' },
        { status: 404 }
      )
    }

    // Determine the organization for this assignment
    // For admins: use the target user's organization
    // For partners: use their own organization (same as toUser's)
    const assignmentOrganizationId = toUser.organization_id

    // Only case_manager and admin roles can be assigned patients
    if (!['partner_admin', 'partner_case_manager'].includes(toUser.role)) {
      return NextResponse.json(
        { success: false, error: 'Target user must be a case manager or admin' },
        { status: 400 }
      )
    }

    // Get patient details for activity log
    const { data: patient, error: patientError } = await supabaseAdmin
      .from('patients')
      .select('first_name, last_name')
      .eq('id', patient_id)
      .single()

    if (patientError || !patient) {
      return NextResponse.json(
        { success: false, error: 'Patient not found' },
        { status: 404 }
      )
    }

    // Get current assignment if exists
    const { data: currentAssignment } = await supabaseAdmin
      .from('partner_user_patient_assignments')
      .select('id, partner_user_id, partner_users(full_name)')
      .eq('patient_id', patient_id)
      .eq('organization_id', assignmentOrganizationId)
      .eq('status', 'active')
      .eq('assignment_type', 'primary')
      .single()

    // Validate from_user_id if provided
    if (from_user_id && currentAssignment && currentAssignment.partner_user_id !== from_user_id) {
      return NextResponse.json(
        { success: false, error: 'Patient is not currently assigned to from_user_id' },
        { status: 400 }
      )
    }

    // Check if patient is already assigned to target user
    if (currentAssignment && currentAssignment.partner_user_id === to_user_id) {
      return NextResponse.json(
        { success: false, error: 'Patient is already assigned to this user' },
        { status: 400 }
      )
    }

    // Start transaction: deactivate old assignment and create new one
    const now = new Date().toISOString()

    // Deactivate current assignment if exists
    if (currentAssignment) {
      const { error: deactivateError } = await supabaseAdmin
        .from('partner_user_patient_assignments')
        .update({
          status: 'transferred',
          transfer_date: now,
          transfer_notes: notes || null
        })
        .eq('id', currentAssignment.id)

      if (deactivateError) {
        console.error('Error deactivating current assignment:', deactivateError)
        return NextResponse.json(
          { success: false, error: 'Failed to deactivate current assignment' },
          { status: 500 }
        )
      }
    }

    // Create new assignment
    // For admins: use session email as actor name
    const actorName = partnerUser?.full_name || (userIsAdmin ? session.user.email : 'Unknown')
    const { data: newAssignment, error: assignError } = await supabaseAdmin
      .from('partner_user_patient_assignments')
      .insert({
        partner_user_id: to_user_id,
        patient_id,
        organization_id: assignmentOrganizationId,
        assignment_type: 'primary',
        status: 'active',
        assigned_date: now,
        notes: notes || `Assigned by ${actorName}`
      })
      .select()
      .single()

    if (assignError || !newAssignment) {
      console.error('Error creating new assignment:', assignError)
      return NextResponse.json(
        { success: false, error: 'Failed to create new assignment' },
        { status: 500 }
      )
    }

    // Ensure patient has organization affiliation
    // Check if affiliation already exists
    const { data: existingAffiliation } = await supabaseAdmin
      .from('patient_organization_affiliations')
      .select('id, status')
      .eq('patient_id', patient_id)
      .eq('organization_id', assignmentOrganizationId)
      .single()

    if (existingAffiliation) {
      // If exists but inactive, reactivate it
      if (existingAffiliation.status !== 'active') {
        await supabaseAdmin
          .from('patient_organization_affiliations')
          .update({
            status: 'active',
            updated_at: now,
            notes: `Reactivated via case manager assignment by ${actorName}`
          })
          .eq('id', existingAffiliation.id)
      }
    } else {
      // Create new affiliation
      const { error: affiliationError } = await supabaseAdmin
        .from('patient_organization_affiliations')
        .insert({
          patient_id,
          organization_id: assignmentOrganizationId,
          start_date: now.split('T')[0], // Just the date part
          affiliation_type: 'case_management',
          status: 'active',
          consent_on_file: false, // Will need to be updated when ROI is uploaded
          notes: `Created via case manager assignment by ${actorName}`
        })

      if (affiliationError) {
        console.error('Error creating organization affiliation:', affiliationError)
        // Don't fail the assignment if affiliation creation fails, but log it
      }
    }

    // Create activity log entry
    const activityDescription = currentAssignment
      ? `Transferred from ${(currentAssignment.partner_users as any)?.full_name || 'Previous Case Manager'} to ${toUser.full_name}`
      : `Assigned to ${toUser.full_name}`

    const { error: activityError } = await supabaseAdmin
      .from('patient_activity_log')
      .insert({
        patient_id,
        organization_id: assignmentOrganizationId,
        activity_type: currentAssignment ? 'case_manager_transferred' : 'case_manager_assigned',
        title: currentAssignment ? 'Case manager transferred' : 'Case manager assigned',
        description: activityDescription,
        metadata: {
          from_user_id: currentAssignment?.partner_user_id || null,
          to_user_id,
          notes: notes || null,
          assigned_by_admin: userIsAdmin ? session.user.email : null
        },
        actor_type: userIsAdmin ? 'admin' : 'partner_user',
        actor_id: partnerUser?.id || null,
        actor_name: actorName,
        visible_to_partner: true,
        visible_to_patient: false
      })

    if (activityError) {
      console.error('Error creating activity log:', activityError)
      // Don't fail the transfer if activity logging fails
    }

    return NextResponse.json({
      success: true,
      data: {
        assignment: newAssignment,
        patient: {
          id: patient_id,
          first_name: patient.first_name,
          last_name: patient.last_name
        },
        assigned_to: {
          id: to_user_id,
          full_name: toUser.full_name
        },
        transferred_from: currentAssignment ? {
          id: currentAssignment.partner_user_id,
          full_name: (currentAssignment.partner_users as any)?.full_name || 'Unknown'
        } : null
      },
      message: currentAssignment
        ? `Patient transferred to ${toUser.full_name}`
        : `Patient assigned to ${toUser.full_name}`
    })

  } catch (error: any) {
    console.error('❌ Error transferring patient:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to transfer patient', details: error.message },
      { status: 500 }
    )
  }
}
