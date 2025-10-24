// Partner User Authentication - Login
import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

interface LoginRequest {
  email: string
  password: string
  organization_slug?: string // Optional: pre-fill organization context
}

export async function POST(request: NextRequest) {
  try {
    const body: LoginRequest = await request.json()
    const { email, password, organization_slug } = body

    if (!email || !password) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Email and password are required' 
        },
        { status: 400 }
      )
    }

    console.log('🔐 Partner user login attempt:', { email, organization_slug })

    // 1. Authenticate with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (authError || !authData.user) {
      console.error('❌ Authentication failed:', authError?.message)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid email or password' 
        },
        { status: 401 }
      )
    }

    // 2. Get partner user record
    const { data: partnerUser, error: partnerUserError } = await supabaseAdmin
      .from('partner_users')
      .select(`
        *,
        organization:organizations(
          id,
          name,
          slug,
          type,
          status
        )
      `)
      .eq('auth_user_id', authData.user.id)
      .eq('is_active', true)
      .single()

    if (partnerUserError || !partnerUser) {
      console.error('❌ Partner user not found or inactive:', partnerUserError?.message)
      
      // Sign out the auth user since they're not a valid partner user
      await supabase.auth.signOut()
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Access denied. You are not authorized as a partner user.' 
        },
        { status: 403 }
      )
    }

    // 3. Check organization status
    if (partnerUser.organization?.status !== 'active') {
      console.error('❌ Organization is not active:', partnerUser.organization?.status)
      await supabase.auth.signOut()
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Your organization account is currently inactive. Please contact support.' 
        },
        { status: 403 }
      )
    }

    // 4. Update last login timestamp
    await supabaseAdmin
      .from('partner_users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', partnerUser.id)

    // 5. Log successful login for audit
    await supabaseAdmin
      .from('scheduler_audit_logs')
      .insert({
        user_identifier: partnerUser.id,
        action: 'partner_login',
        resource_type: 'partner_user',
        resource_id: partnerUser.id,
        details: {
          organization_id: partnerUser.organization_id,
          organization_name: partnerUser.organization?.name,
          role: partnerUser.role,
          login_method: 'email_password'
        }
      })

    console.log('✅ Partner user logged in successfully:', {
      user_id: partnerUser.id,
      email: partnerUser.email,
      organization: partnerUser.organization?.name,
      role: partnerUser.role
    })

    // 6. Return user info (exclude sensitive data)
    const responseData = {
      user: {
        id: partnerUser.id,
        email: partnerUser.email,
        full_name: partnerUser.full_name,
        role: partnerUser.role,
        permissions: partnerUser.permissions,
        organization: partnerUser.organization,
        timezone: partnerUser.timezone,
        notification_preferences: partnerUser.notification_preferences
      },
      session: authData.session
    }

    return NextResponse.json({
      success: true,
      data: responseData
    })

  } catch (error: any) {
    console.error('❌ Partner login error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Login failed',
        details: error.message
      },
      { status: 500 }
    )
  }
}

// GET endpoint to check current login status
export async function GET(request: NextRequest) {
  try {
    // Get current session from cookies
    const cookieStore = cookies()
    const supabaseServer = createServerComponentClient({ cookies: () => cookieStore })
    
    const { data: { session }, error: sessionError } = await supabaseServer.auth.getSession()

    if (sessionError || !session) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Not authenticated' 
        },
        { status: 401 }
      )
    }

    // Get partner user info
    const { data: partnerUser, error: partnerUserError } = await supabaseAdmin
      .from('partner_users')
      .select(`
        *,
        organization:organizations(
          id,
          name,
          slug,
          type,
          status
        )
      `)
      .eq('auth_user_id', session.user.id)
      .eq('is_active', true)
      .single()

    if (partnerUserError || !partnerUser) {
      return NextResponse.json(
        {
          success: false,
          error: 'Partner user not found'
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: partnerUser.id,
          email: partnerUser.email,
          full_name: partnerUser.full_name,
          role: partnerUser.role,
          permissions: partnerUser.permissions,
          organization: partnerUser.organization,
          timezone: partnerUser.timezone,
          notification_preferences: partnerUser.notification_preferences
        },
        session
      }
    })

  } catch (error: any) {
    console.error('❌ Session check error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Session check failed',
        details: error.message
      },
      { status: 500 }
    )
  }
}