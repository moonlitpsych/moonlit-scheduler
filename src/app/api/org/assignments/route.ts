// Organization Assignments API - Admin can manage, users toggle notifications
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET - List case manager assignments for organization
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Get partner user ID from headers
    const partnerUserId = request.headers.get('x-partner-user-id')
    
    if (!partnerUserId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Partner user authentication required' 
        },
        { status: 401 }
      )
    }

    // Get partner user's organization
    const { data: partnerUser, error: userError } = await supabaseAdmin
      .from('partner_users')
      .select('organization_id, role, first_name, last_name, id')
      .eq('id', partnerUserId)
      .eq('status', 'active')
      .single()

    if (userError || !partnerUser?.organization_id) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Partner user or organization not found' 
        },
        { status: 404 }
      )
    }

    // Parse query parameters
    const page = parseInt(searchParams.get('page') || '1')
    const perPage = Math.min(parseInt(searchParams.get('per_page') || '50'), 100)
    const offset = (page - 1) * perPage
    const caseManagerId = searchParams.get('case_manager_id') // Filter by specific case manager
    const patientId = searchParams.get('patient_id') // Filter by specific patient
    const status = searchParams.get('status') || 'active' // active, inactive, all

    console.log('📋 Fetching case manager assignments:', { 
      organizationId: partnerUser.organization_id,
      page, 
      perPage,
      caseManagerId,
      patientId,
      status,
      requestedBy: partnerUser.role
    })

    // Build assignments query
    let query = supabaseAdmin
      .from('case_manager_assignments')
      .select(`
        id,
        patient_id,
        case_manager_id,
        status,
        start_date,
        end_date,
        notification_preferences,
        notes,
        created_at,
        updated_at,
        created_by,
        patients!inner(
          id,
          first_name,
          last_name,
          email,
          primary_provider_id,
          patient_affiliations!inner(
            organization_id,
            status
          ),
          providers(
            id,
            first_name,
            last_name,
            title
          )
        ),
        case_managers:partner_users!case_manager_id(
          id,
          first_name,
          last_name,
          email,
          role,
          status
        )
      `, { count: 'exact' })
      .eq('patients.patient_affiliations.organization_id', partnerUser.organization_id)
      .eq('patients.patient_affiliations.status', 'active')

    // Apply filters
    if (status !== 'all') {
      query = query.eq('status', status)
    }

    if (caseManagerId) {
      query = query.eq('case_manager_id', caseManagerId)
    } else if (partnerUser.role === 'partner_case_manager') {
      // Case managers can only see their own assignments
      query = query.eq('case_manager_id', partnerUser.id)
    }

    if (patientId) {
      query = query.eq('patient_id', patientId)
    }

    // Apply pagination and ordering
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + perPage - 1)

    const { data: assignments, error, count } = await query

    if (error) {
      console.error('❌ Error fetching assignments:', error)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to fetch case manager assignments',
          details: error.message
        },
        { status: 500 }
      )
    }

    // Process assignments for display
    const processedAssignments = (assignments || []).map(assignment => ({
      id: assignment.id,
      patient: {
        id: assignment.patients.id,
        name: `${assignment.patients.first_name} ${assignment.patients.last_name}`,
        first_name: assignment.patients.first_name,
        last_name: assignment.patients.last_name,
        email: assignment.patients.email,
        primary_provider: assignment.patients.providers ? {
          id: assignment.patients.providers.id,
          name: `Dr. ${assignment.patients.providers.first_name} ${assignment.patients.providers.last_name}`,
          title: assignment.patients.providers.title
        } : null
      },
      case_manager: {
        id: assignment.case_managers.id,
        name: `${assignment.case_managers.first_name} ${assignment.case_managers.last_name}`,
        first_name: assignment.case_managers.first_name,
        last_name: assignment.case_managers.last_name,
        email: assignment.case_managers.email,
        role: assignment.case_managers.role,
        status: assignment.case_managers.status
      },
      assignment_details: {
        status: assignment.status,
        start_date: assignment.start_date,
        end_date: assignment.end_date,
        is_active: assignment.status === 'active' && (!assignment.end_date || new Date(assignment.end_date) > new Date()),
        days_assigned: assignment.start_date ? 
          Math.floor((new Date().getTime() - new Date(assignment.start_date).getTime()) / (1000 * 60 * 60 * 24)) : 
          null
      },
      notifications: {
        preferences: assignment.notification_preferences || {
          appointment_reminders: true,
          appointment_changes: true,
          missed_appointments: true,
          insurance_issues: true
        },
        can_modify: assignment.case_manager_id === partnerUser.id || canManageAllAssignments(partnerUser.role)
      },
      notes: assignment.notes,
      created_at: assignment.created_at,
      updated_at: assignment.updated_at,
      can_update: canUpdateAssignment(partnerUser.role, assignment.case_manager_id, partnerUser.id),
      can_end: canEndAssignment(partnerUser.role)
    }))

    const totalPages = Math.ceil((count || 0) / perPage)

    // Get available case managers for dropdown
    const availableCaseManagers = await getAvailableCaseManagers(partnerUser.organization_id)

    // Log access for audit
    await supabaseAdmin
      .from('scheduler_audit_logs')
      .insert({
        action: 'case_manager_assignments_viewed',
        resource_type: 'case_manager_assignments',
        resource_id: partnerUser.organization_id,
        details: {
          accessed_by: {
            partner_user_id: partnerUserId,
            name: `${partnerUser.first_name} ${partnerUser.last_name}`,
            role: partnerUser.role
          },
          filters: { caseManagerId, patientId, status },
          page,
          per_page: perPage,
          total_results: count,
          view_scope: partnerUser.role === 'partner_case_manager' ? 'own_assignments' : 'all_assignments'
        }
      })

    console.log('✅ Assignments fetched:', {
      total: count,
      returned: processedAssignments.length,
      organization_id: partnerUser.organization_id,
      role: partnerUser.role
    })

    return NextResponse.json({
      success: true,
      data: {
        assignments: processedAssignments,
        pagination: {
          page,
          per_page: perPage,
          total: count || 0,
          total_pages: totalPages,
          has_next: page < totalPages,
          has_prev: page > 1
        },
        filters: {
          applied: { caseManagerId, patientId, status },
          available_case_managers: availableCaseManagers,
          available_statuses: ['active', 'inactive', 'all']
        },
        permissions: {
          can_create_assignments: canManageAllAssignments(partnerUser.role),
          can_manage_all_assignments: canManageAllAssignments(partnerUser.role),
          can_modify_own_notifications: true
        }
      }
    })

  } catch (error: any) {
    console.error('❌ Assignments fetch error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch case manager assignments',
        details: error.message
      },
      { status: 500 }
    )
  }
}

// POST - Create new case manager assignment (admin only)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { patient_id, case_manager_id, start_date, notification_preferences, notes } = body
    
    // Get partner user ID from headers
    const partnerUserId = request.headers.get('x-partner-user-id')
    
    if (!partnerUserId || !patient_id || !case_manager_id) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Partner user authentication, patient ID, and case manager ID required' 
        },
        { status: 400 }
      )
    }

    // Get partner user's organization
    const { data: partnerUser, error: userError } = await supabaseAdmin
      .from('partner_users')
      .select('organization_id, role, first_name, last_name, email')
      .eq('id', partnerUserId)
      .eq('status', 'active')
      .single()

    if (userError || !partnerUser?.organization_id) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Partner user or organization not found' 
        },
        { status: 404 }
      )
    }

    // Check permissions
    if (!canManageAllAssignments(partnerUser.role)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Insufficient permissions to create assignments' 
        },
        { status: 403 }
      )
    }

    // Verify patient is affiliated with organization
    const { data: patientAffiliation } = await supabaseAdmin
      .from('patient_organization_affiliations')
      .select('id, status')
      .eq('patient_id', patient_id)
      .eq('organization_id', partnerUser.organization_id)
      .eq('status', 'active')
      .single()

    if (!patientAffiliation) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Patient not affiliated with your organization' 
        },
        { status: 404 }
      )
    }

    // Verify case manager belongs to organization
    const { data: caseManager } = await supabaseAdmin
      .from('partner_users')
      .select('id, first_name, last_name, email, status')
      .eq('id', case_manager_id)
      .eq('organization_id', partnerUser.organization_id)
      .eq('status', 'active')
      .single()

    if (!caseManager) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Case manager not found in your organization' 
        },
        { status: 404 }
      )
    }

    // Check for existing active assignment
    const { data: existingAssignment } = await supabaseAdmin
      .from('case_manager_assignments')
      .select('id, status')
      .eq('patient_id', patient_id)
      .eq('case_manager_id', case_manager_id)
      .eq('status', 'active')
      .single()

    if (existingAssignment) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Active assignment already exists between this patient and case manager' 
        },
        { status: 409 }
      )
    }

    // Create new assignment
    const assignmentData = {
      patient_id,
      case_manager_id,
      status: 'active',
      start_date: start_date || new Date().toISOString().split('T')[0],
      notification_preferences: notification_preferences || {
        appointment_reminders: true,
        appointment_changes: true,
        missed_appointments: true,
        insurance_issues: true
      },
      notes: notes || null,
      created_by: partnerUserId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { data: newAssignment, error: createError } = await supabaseAdmin
      .from('case_manager_assignments')
      .insert(assignmentData)
      .select(`
        *,
        patients(id, first_name, last_name, email),
        case_managers:partner_users!case_manager_id(id, first_name, last_name, email)
      `)
      .single()

    if (createError) {
      console.error('❌ Assignment creation failed:', createError)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to create case manager assignment',
          details: createError.message
        },
        { status: 500 }
      )
    }

    // Create audit log
    await supabaseAdmin
      .from('scheduler_audit_logs')
      .insert({
        action: 'case_manager_assignment_created',
        resource_type: 'case_manager_assignment',
        resource_id: newAssignment.id,
        details: {
          created_by: {
            partner_user_id: partnerUserId,
            name: `${partnerUser.first_name} ${partnerUser.last_name}`,
            email: partnerUser.email,
            role: partnerUser.role
          },
          patient: {
            id: patient_id,
            name: `${newAssignment.patients.first_name} ${newAssignment.patients.last_name}`
          },
          case_manager: {
            id: case_manager_id,
            name: `${newAssignment.case_managers.first_name} ${newAssignment.case_managers.last_name}`
          },
          start_date: assignmentData.start_date,
          notification_preferences: assignmentData.notification_preferences
        }
      })

    console.log('✅ Case manager assignment created:', {
      assignment_id: newAssignment.id,
      patient_id,
      case_manager_id,
      created_by: partnerUser.email
    })

    return NextResponse.json({
      success: true,
      data: {
        assignment: newAssignment
      },
      message: 'Case manager assignment created successfully'
    })

  } catch (error: any) {
    console.error('❌ Assignment creation error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to create case manager assignment',
        details: error.message
      },
      { status: 500 }
    )
  }
}

// PUT - Update assignment (notification preferences, end date, etc.)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { assignment_id, notification_preferences, notes, end_date, status } = body
    
    // Get partner user ID from headers
    const partnerUserId = request.headers.get('x-partner-user-id')
    
    if (!partnerUserId || !assignment_id) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Partner user authentication and assignment ID required' 
        },
        { status: 400 }
      )
    }

    // Get partner user's organization
    const { data: partnerUser, error: userError } = await supabaseAdmin
      .from('partner_users')
      .select('organization_id, role, first_name, last_name, email, id')
      .eq('id', partnerUserId)
      .eq('status', 'active')
      .single()

    if (userError || !partnerUser?.organization_id) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Partner user or organization not found' 
        },
        { status: 404 }
      )
    }

    // Get existing assignment and verify access
    const { data: currentAssignment, error: assignmentError } = await supabaseAdmin
      .from('case_manager_assignments')
      .select(`
        *,
        patients!inner(
          id,
          first_name,
          last_name,
          patient_affiliations!inner(
            organization_id,
            status
          )
        ),
        case_managers:partner_users!case_manager_id(
          id,
          first_name,
          last_name,
          email
        )
      `)
      .eq('id', assignment_id)
      .eq('patients.patient_affiliations.organization_id', partnerUser.organization_id)
      .single()

    if (assignmentError || !currentAssignment) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Assignment not found or access denied' 
        },
        { status: 404 }
      )
    }

    // Check permissions for different types of updates
    const canModifyNotifications = currentAssignment.case_manager_id === partnerUser.id || canManageAllAssignments(partnerUser.role)
    const canModifyAssignment = canUpdateAssignment(partnerUser.role, currentAssignment.case_manager_id, partnerUser.id)
    
    if (!canModifyNotifications && !canModifyAssignment) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Insufficient permissions to update this assignment' 
        },
        { status: 403 }
      )
    }

    // Build update object based on permissions
    const updates: any = { updated_at: new Date().toISOString() }
    const changeLog: any = {}

    // Anyone can modify their own notification preferences
    if (notification_preferences !== undefined && canModifyNotifications) {
      updates.notification_preferences = notification_preferences
      changeLog.notification_preferences = {
        from: currentAssignment.notification_preferences,
        to: notification_preferences
      }
    }

    // Only admins can modify assignment details
    if (canModifyAssignment) {
      if (notes !== undefined) {
        updates.notes = notes
        changeLog.notes = {
          from: currentAssignment.notes,
          to: notes
        }
      }

      if (end_date !== undefined) {
        updates.end_date = end_date
        changeLog.end_date = {
          from: currentAssignment.end_date,
          to: end_date
        }
        
        // If setting end_date, automatically set status to inactive
        if (end_date) {
          updates.status = 'inactive'
          changeLog.status = {
            from: currentAssignment.status,
            to: 'inactive'
          }
        }
      }

      if (status !== undefined) {
        updates.status = status
        changeLog.status = {
          from: currentAssignment.status,
          to: status
        }
      }
    }

    if (Object.keys(updates).length === 1) { // Only updated_at
      return NextResponse.json(
        { 
          success: false, 
          error: 'No valid updates provided or insufficient permissions' 
        },
        { status: 400 }
      )
    }

    // Update assignment
    const { data: updatedAssignment, error: updateError } = await supabaseAdmin
      .from('case_manager_assignments')
      .update(updates)
      .eq('id', assignment_id)
      .select(`
        *,
        patients(id, first_name, last_name, email),
        case_managers:partner_users!case_manager_id(id, first_name, last_name, email)
      `)
      .single()

    if (updateError) {
      console.error('❌ Assignment update failed:', updateError)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to update case manager assignment',
          details: updateError.message
        },
        { status: 500 }
      )
    }

    // Create audit log
    await supabaseAdmin
      .from('scheduler_audit_logs')
      .insert({
        action: 'case_manager_assignment_updated',
        resource_type: 'case_manager_assignment',
        resource_id: assignment_id,
        details: {
          updated_by: {
            partner_user_id: partnerUserId,
            name: `${partnerUser.first_name} ${partnerUser.last_name}`,
            email: partnerUser.email,
            role: partnerUser.role
          },
          patient: {
            id: currentAssignment.patients.id,
            name: `${currentAssignment.patients.first_name} ${currentAssignment.patients.last_name}`
          },
          case_manager: {
            id: currentAssignment.case_manager_id,
            name: `${currentAssignment.case_managers.first_name} ${currentAssignment.case_managers.last_name}`
          },
          changes: changeLog,
          fields_updated: Object.keys(changeLog),
          update_type: canModifyAssignment ? 'admin_update' : 'notification_preferences_update'
        }
      })

    console.log('✅ Assignment updated:', {
      assignment_id,
      updated_fields: Object.keys(changeLog),
      updated_by: partnerUser.email,
      update_type: canModifyAssignment ? 'admin_update' : 'notification_preferences_update'
    })

    return NextResponse.json({
      success: true,
      data: {
        assignment: updatedAssignment,
        changes_made: changeLog
      },
      message: 'Case manager assignment updated successfully'
    })

  } catch (error: any) {
    console.error('❌ Assignment update error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to update case manager assignment',
        details: error.message
      },
      { status: 500 }
    )
  }
}

// Helper functions
function canManageAllAssignments(role: string): boolean {
  return role === 'partner_admin'
}

function canUpdateAssignment(role: string, assignmentCaseManagerId: string, currentUserId: string): boolean {
  return role === 'partner_admin' || (role === 'partner_case_manager' && assignmentCaseManagerId === currentUserId)
}

function canEndAssignment(role: string): boolean {
  return role === 'partner_admin'
}

async function getAvailableCaseManagers(organizationId: string) {
  try {
    const { data: caseManagers } = await supabaseAdmin
      .from('partner_users')
      .select('id, first_name, last_name, email, role')
      .eq('organization_id', organizationId)
      .in('role', ['partner_case_manager', 'partner_admin'])
      .eq('status', 'active')
      .order('first_name')
      .limit(50)

    return (caseManagers || []).map(cm => ({
      id: cm.id,
      name: `${cm.first_name} ${cm.last_name}`,
      email: cm.email,
      role: cm.role
    }))
  } catch (error) {
    console.warn('Could not fetch available case managers:', error)
    return []
  }
}