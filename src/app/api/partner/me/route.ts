// Partner User Information API - Who am I, which organization
import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user from Supabase session
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    if (sessionError || !session) {
      return NextResponse.json(
        {
          success: false,
          error: 'Partner user authentication required',
          code: 'AUTH_REQUIRED'
        },
        { status: 401 }
      )
    }

    // Check for impersonation (admin viewing as partner)
    const { searchParams } = new URL(request.url)
    const partnerUserId = searchParams.get('partner_user_id')

    if (partnerUserId) {
      console.log('👤 Admin impersonating partner user:', partnerUserId)
    } else {
      console.log('👤 Fetching partner user info for auth user:', session.user.id)
    }

    // Get partner user with organization details
    let partnerUserQuery = supabaseAdmin
      .from('partner_users')
      .select(`
        id,
        auth_user_id,
        organization_id,
        full_name,
        email,
        phone,
        role,
        is_active,
        wants_org_broadcasts,
        created_at,
        updated_at,
        organization:organizations!partner_users_organization_id_fkey(
          id,
          name,
          created_at
        )
      `)
      .eq('is_active', true)

    if (partnerUserId) {
      // Admin is impersonating - use provided partner_user_id
      partnerUserQuery = partnerUserQuery.eq('id', partnerUserId)
    } else {
      // Regular partner user - lookup by auth_user_id
      partnerUserQuery = partnerUserQuery.eq('auth_user_id', session.user.id)
    }

    const { data: partnerUser, error } = await partnerUserQuery.single()

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

    // Update last accessed timestamp
    await supabaseAdmin
      .from('partner_users')
      .update({ 
        updated_at: new Date().toISOString() 
      })
      .eq('id', partnerUser.id)

    // Get user's permissions based on role
    const permissions = getPermissionsForRole(partnerUser.role)

    // Get organization statistics
    let orgStats = null
    if (partnerUser.organization_id) {
      try {
        // Get patient count affiliated with this organization
        const { count: patientCount } = await supabaseAdmin
          .from('patient_organization_affiliations')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', partnerUser.organization_id)
          .eq('status', 'active')

        // Get appointment count for this organization (last 30 days)
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        // First get patient IDs for this organization
        const { data: orgAffiliations } = await supabaseAdmin
          .from('patient_organization_affiliations')
          .select('patient_id')
          .eq('organization_id', partnerUser.organization_id)
          .eq('status', 'active')

        const patientIds = orgAffiliations?.map(a => a.patient_id) || []

        let appointmentCount = 0
        if (patientIds.length > 0) {
          const { count } = await supabaseAdmin
            .from('appointments')
            .select('*', { count: 'exact', head: true })
            .gte('start_time', thirtyDaysAgo.toISOString())
            .in('patient_id', patientIds)

          appointmentCount = count || 0
        }

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

    // Parse full_name into first_name and last_name
    const nameParts = partnerUser.full_name?.split(' ') || ['', '']
    const first_name = nameParts[0] || ''
    const last_name = nameParts.slice(1).join(' ') || ''

    console.log('✅ Partner user authenticated:', {
      id: partnerUser.id,
      email: partnerUser.email,
      role: partnerUser.role,
      organization: partnerUser.organization?.name
    })

    const response = NextResponse.json({
      success: true,
      data: {
        id: partnerUser.id,
        auth_user_id: partnerUser.auth_user_id,
        organization_id: partnerUser.organization_id,
        first_name,
        last_name,
        full_name: partnerUser.full_name,
        email: partnerUser.email,
        phone: partnerUser.phone,
        role: partnerUser.role,
        status: partnerUser.is_active ? 'active' : 'inactive',
        timezone: 'America/Denver', // Default timezone
        created_at: partnerUser.created_at,
        updated_at: partnerUser.updated_at,
        organization: partnerUser.organization,
        permissions,
        organization_stats: orgStats
      }
    })

    // Cache partner user data for 5 minutes (changes infrequently)
    // Allow stale data for up to 1 hour while revalidating
    response.headers.set('Cache-Control', 'private, s-maxage=300, stale-while-revalidate=3600')

    return response

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