/**
 * Partner Dashboard API - Patient Transfer
 * Transfer patient ownership between case managers
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'

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
      .select('id, organization_id, role, is_active, full_name')
      .eq('auth_user_id', session.user.id)
      .eq('is_active', true)
      .single()

    if (userError || !partnerUser) {
      return NextResponse.json(
        { success: false, error: 'Partner user not found' },
        { status: 404 }
      )
    }

    // Only admin and case_manager can transfer patients
    if (!['partner_admin', 'partner_case_manager'].includes(partnerUser.role)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Get request body
    const body = await request.json()
    const { patient_id, from_user_id, to_user_id, notes } = body

    if (!patient_id || !to_user_id) {
      return NextResponse.json(
        { success: false, error: 'patient_id and to_user_id are required' },
        { status: 400 }
      )
    }

    // Validate that to_user belongs to same organization
    const { data: toUser, error: toUserError } = await supabaseAdmin
      .from('partner_users')
      .select('id, full_name, role, is_active, organization_id')
      .eq('id', to_user_id)
      .eq('organization_id', partnerUser.organization_id)
      .eq('is_active', true)
      .single()

    if (toUserError || !toUser) {
      return NextResponse.json(
        { success: false, error: 'Target user not found or not in same organization' },
        { status: 404 }
      )
    }

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
      .eq('organization_id', partnerUser.organization_id)
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
    const { data: newAssignment, error: assignError } = await supabaseAdmin
      .from('partner_user_patient_assignments')
      .insert({
        partner_user_id: to_user_id,
        patient_id,
        organization_id: partnerUser.organization_id,
        assignment_type: 'primary',
        status: 'active',
        assigned_date: now,
        assigned_by: partnerUser.id
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

    // Create activity log entry
    const activityDescription = currentAssignment
      ? `Transferred from ${(currentAssignment.partner_users as any)?.full_name || 'Previous Case Manager'} to ${toUser.full_name}`
      : `Assigned to ${toUser.full_name}`

    const { error: activityError } = await supabaseAdmin
      .from('patient_activity_log')
      .insert({
        patient_id,
        organization_id: partnerUser.organization_id,
        activity_type: currentAssignment ? 'case_manager_transferred' : 'case_manager_assigned',
        title: currentAssignment ? 'Case manager transferred' : 'Case manager assigned',
        description: activityDescription,
        metadata: {
          from_user_id: currentAssignment?.partner_user_id || null,
          to_user_id,
          notes: notes || null
        },
        actor_type: 'partner_user',
        actor_id: partnerUser.id,
        actor_name: partnerUser.full_name || 'Partner User',
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
