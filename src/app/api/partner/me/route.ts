// Partner User Information API - Who am I, which organization
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    // Get partner user ID from headers or auth token
    // For now, using a header-based approach (replace with actual auth)
    const partnerUserId = request.headers.get('x-partner-user-id')
    
    if (!partnerUserId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Partner user authentication required',
          code: 'AUTH_REQUIRED'
        },
        { status: 401 }
      )
    }

    console.log('👤 Fetching partner user info:', { partnerUserId })

    // Get partner user with organization details
    const { data: partnerUser, error } = await supabaseAdmin
      .from('partner_users')
      .select(`
        id,
        organization_id,
        first_name,
        last_name,
        email,
        role,
        status,
        timezone,
        notification_preferences,
        last_login_at,
        created_at,
        updated_at,
        organization:organizations(
          id,
          name,
          status,
          type,
          primary_contact_email,
          primary_contact_phone,
          created_at
        )
      `)
      .eq('id', partnerUserId)
      .eq('status', 'active')
      .single()

    if (error || !partnerUser) {
      console.error('❌ Partner user not found:', error)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Partner user not found or inactive',
          code: 'USER_NOT_FOUND'
        },
        { status: 404 }
      )
    }

    // Update last login timestamp
    await supabaseAdmin
      .from('partner_users')
      .update({ 
        last_login_at: new Date().toISOString() 
      })
      .eq('id', partnerUserId)

    // Get user's permissions based on role
    const permissions = getPermissionsForRole(partnerUser.role)

    // Get organization statistics
    let orgStats = null
    if (partnerUser.organization_id) {
      try {
        // Get patient count affiliated with this organization
        const { count: patientCount } = await supabaseAdmin
          .from('patient_affiliations')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', partnerUser.organization_id)
          .eq('status', 'active')

        // Get appointment count for this organization (last 30 days)
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        
        const { count: appointmentCount } = await supabaseAdmin
          .from('appointments')
          .select('*', { count: 'exact', head: true })
          .gte('start_time', thirtyDaysAgo.toISOString())
          .in('patient_id', 
            supabaseAdmin
              .from('patient_affiliations')
              .select('patient_id')
              .eq('organization_id', partnerUser.organization_id)
              .eq('status', 'active')
          )

        orgStats = {
          affiliated_patients: patientCount || 0,
          appointments_last_30_days: appointmentCount || 0
        }
      } catch (statsError) {
        console.warn('⚠️ Could not fetch org stats:', statsError)
        orgStats = {
          affiliated_patients: 0,
          appointments_last_30_days: 0
        }
      }
    }

    // Log successful authentication for audit
    await supabaseAdmin
      .from('scheduler_audit_logs')
      .insert({
        action: 'partner_user_authenticated',
        resource_type: 'partner_user',
        resource_id: partnerUser.id,
        details: {
          user_email: partnerUser.email,
          organization_id: partnerUser.organization_id,
          role: partnerUser.role,
          ip_address: request.headers.get('x-forwarded-for') || 'unknown'
        }
      })

    console.log('✅ Partner user authenticated:', {
      id: partnerUser.id,
      email: partnerUser.email,
      role: partnerUser.role,
      organization: partnerUser.organization?.name
    })

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: partnerUser.id,
          first_name: partnerUser.first_name,
          last_name: partnerUser.last_name,
          email: partnerUser.email,
          role: partnerUser.role,
          status: partnerUser.status,
          timezone: partnerUser.timezone || 'America/Denver',
          notification_preferences: partnerUser.notification_preferences || {},
          last_login_at: partnerUser.last_login_at,
          created_at: partnerUser.created_at
        },
        organization: partnerUser.organization,
        permissions,
        organization_stats: orgStats
      }
    })

  } catch (error: any) {
    console.error('❌ Partner user authentication error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to authenticate partner user',
        details: error.message
      },
      { status: 500 }
    )
  }
}

// Helper function to determine permissions based on role
function getPermissionsForRole(role: string) {
  const basePermissions = {
    view_appointments: true,
    view_patients: true,
    request_appointment_changes: true,
    view_calendar: true
  }

  switch (role) {
    case 'partner_admin':
      return {
        ...basePermissions,
        manage_users: true,
        manage_organization: true,
        view_all_patients: true,
        manage_affiliations: true,
        view_assignments: true,
        manage_assignments: true,
        export_data: true
      }
    
    case 'partner_case_manager':
      return {
        ...basePermissions,
        update_patient_info: true,
        manage_own_assignments: true,
        view_assigned_patients: true
      }
    
    case 'partner_user':
    default:
      return basePermissions
  }
}