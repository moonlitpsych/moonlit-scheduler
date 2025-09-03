// Partner User Authentication - Accept Invitation
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

interface AcceptInvitationRequest {
  token: string
  password: string
  first_name?: string
  last_name?: string
  phone?: string
  timezone?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: AcceptInvitationRequest = await request.json()
    const { token, password, first_name, last_name, phone, timezone } = body

    if (!token || !password) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Token and password are required' 
        },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Password must be at least 8 characters long' 
        },
        { status: 400 }
      )
    }

    console.log('🎟️ Processing invitation acceptance:', { token: token.substring(0, 8) + '...' })

    // 1. Find partner user by invitation token
    const { data: partnerUser, error: userError } = await supabaseAdmin
      .from('partner_users')
      .select(`
        *,
        organization:organizations(*)
      `)
      .eq('invitation_token', token)
      .eq('status', 'pending_invitation')
      .single()

    if (userError || !partnerUser) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid or expired invitation token' 
        },
        { status: 404 }
      )
    }

    // 2. Check if invitation has expired
    const now = new Date()
    const expirationDate = new Date(partnerUser.invitation_expires!)
    
    if (now > expirationDate) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invitation has expired. Please request a new invitation.' 
        },
        { status: 410 }
      )
    }

    // 3. Check organization status
    if (partnerUser.organization?.status !== 'active') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Organization is not active' 
        },
        { status: 403 }
      )
    }

    // 4. Create Supabase auth user
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: partnerUser.email,
      password: password,
      email_confirm: true, // Auto-confirm email since invitation was sent to this email
      user_metadata: {
        first_name: first_name || partnerUser.first_name,
        last_name: last_name || partnerUser.last_name,
        role: 'partner_user',
        organization_id: partnerUser.organization_id
      }
    })

    if (authError || !authUser.user) {
      console.error('❌ Failed to create auth user:', authError)
      
      // Check if user already exists
      if (authError?.message?.includes('already registered')) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'An account with this email already exists. Please use the login page instead.' 
          },
          { status: 409 }
        )
      }
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to create user account' 
        },
        { status: 500 }
      )
    }

    // 5. Update partner user record
    const { error: updateError } = await supabaseAdmin
      .from('partner_users')
      .update({
        auth_user_id: authUser.user.id,
        status: 'active',
        email_verified: true,
        first_name: first_name || partnerUser.first_name,
        last_name: last_name || partnerUser.last_name,
        phone: phone || partnerUser.phone,
        timezone: timezone || partnerUser.timezone || 'America/Denver',
        invitation_token: null, // Clear invitation token
        invitation_expires: null,
        last_login_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', partnerUser.id)

    if (updateError) {
      console.error('❌ Failed to update partner user:', updateError)
      
      // Clean up auth user if partner user update fails
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to activate user account' 
        },
        { status: 500 }
      )
    }

    // 6. Log successful invitation acceptance for audit
    await supabaseAdmin
      .from('scheduler_audit_logs')
      .insert({
        user_identifier: partnerUser.id,
        action: 'partner_invitation_accepted',
        resource_type: 'partner_user',
        resource_id: partnerUser.id,
        details: {
          organization_id: partnerUser.organization_id,
          organization_name: partnerUser.organization?.name,
          role: partnerUser.role,
          auth_user_created: true
        }
      })

    console.log('✅ Invitation accepted successfully:', {
      user_id: partnerUser.id,
      email: partnerUser.email,
      organization: partnerUser.organization?.name,
      role: partnerUser.role
    })

    // 7. Return success (don't include session - user should log in)
    return NextResponse.json({
      success: true,
      message: 'Account created successfully! You can now log in.',
      data: {
        user_id: partnerUser.id,
        email: partnerUser.email,
        organization_name: partnerUser.organization?.name
      }
    })

  } catch (error: any) {
    console.error('❌ Invitation acceptance error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to accept invitation',
        details: error.message
      },
      { status: 500 }
    )
  }
}

// GET endpoint to validate invitation token
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Token is required' 
        },
        { status: 400 }
      )
    }

    // Find invitation by token
    const { data: partnerUser, error: userError } = await supabaseAdmin
      .from('partner_users')
      .select(`
        id,
        email,
        first_name,
        last_name,
        role,
        invitation_expires,
        organization:organizations(
          id,
          name,
          slug
        )
      `)
      .eq('invitation_token', token)
      .eq('status', 'pending_invitation')
      .single()

    if (userError || !partnerUser) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid invitation token' 
        },
        { status: 404 }
      )
    }

    // Check if invitation has expired
    const now = new Date()
    const expirationDate = new Date(partnerUser.invitation_expires!)
    
    if (now > expirationDate) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invitation has expired' 
        },
        { status: 410 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        email: partnerUser.email,
        first_name: partnerUser.first_name,
        last_name: partnerUser.last_name,
        role: partnerUser.role,
        organization: partnerUser.organization,
        expires_at: partnerUser.invitation_expires
      }
    })

  } catch (error: any) {
    console.error('❌ Token validation error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to validate token',
        details: error.message
      },
      { status: 500 }
    )
  }
}