/**
 * Partner Authentication - Magic Link
 * Send magic link for passwordless login
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'

interface MagicLinkRequest {
  email: string
  organization_slug?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: MagicLinkRequest = await request.json()
    const { email, organization_slug } = body

    if (!email) {
      return NextResponse.json(
        {
          success: false,
          error: 'Email is required'
        },
        { status: 400 }
      )
    }

    const normalizedEmail = email.toLowerCase().trim()

    console.log('🔐 Magic link request:', { email: normalizedEmail, organization_slug })

    // 1. Check if partner user exists and is active
    let query = supabaseAdmin
      .from('partner_users')
      .select(`
        id,
        email,
        full_name,
        role,
        is_active,
        organization_id,
        organization:organizations(
          id,
          name,
          slug,
          status
        )
      `)
      .eq('email', normalizedEmail)
      .eq('is_active', true)

    // If organization_slug provided, filter by it
    if (organization_slug) {
      query = query.eq('organization.slug', organization_slug)
    }

    const { data: partnerUsers, error: userError } = await query

    if (userError) {
      console.error('❌ Error checking partner user:', userError)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to verify user'
        },
        { status: 500 }
      )
    }

    if (!partnerUsers || partnerUsers.length === 0) {
      // Don't reveal if user doesn't exist (security best practice)
      console.log('⚠️  No active partner user found for:', normalizedEmail)
      return NextResponse.json({
        success: true,
        message: 'If this email is associated with an active partner account, you will receive a magic link shortly.'
      })
    }

    const partnerUser = partnerUsers[0]

    // 2. Check organization status
    if (partnerUser.organization?.status !== 'active') {
      console.error('❌ Organization is not active:', partnerUser.organization?.status)
      return NextResponse.json({
        success: true,
        message: 'If this email is associated with an active partner account, you will receive a magic link shortly.'
      })
    }

    // 3. Check if auth_user_id exists
    if (!partnerUser.auth_user_id) {
      // User was invited but hasn't set up their account yet
      console.log('⚠️  Partner user exists but no auth account:', normalizedEmail)
      return NextResponse.json({
        success: false,
        error: 'Please accept your invitation first to set up your account.',
        needs_invitation: true
      }, { status: 403 })
    }

    // 4. Send magic link via Supabase Auth
    const redirectTo = organization_slug
      ? `${process.env.NEXT_PUBLIC_APP_URL}/partner-dashboard?org=${organization_slug}`
      : `${process.env.NEXT_PUBLIC_APP_URL}/partner-dashboard`

    const { data: magicLinkData, error: magicLinkError } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo: redirectTo,
        shouldCreateUser: false // Don't auto-create users
      }
    })

    if (magicLinkError) {
      console.error('❌ Failed to send magic link:', magicLinkError)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to send magic link. Please try again.'
        },
        { status: 500 }
      )
    }

    // 5. Log magic link request for audit
    await supabaseAdmin
      .from('scheduler_audit_logs')
      .insert({
        user_identifier: partnerUser.id,
        action: 'partner_magic_link_requested',
        resource_type: 'partner_user',
        resource_id: partnerUser.id,
        details: {
          organization_id: partnerUser.organization_id,
          organization_name: partnerUser.organization?.name,
          role: partnerUser.role,
          login_method: 'magic_link'
        }
      })

    console.log('✅ Magic link sent successfully:', {
      user_id: partnerUser.id,
      email: normalizedEmail,
      organization: partnerUser.organization?.name
    })

    return NextResponse.json({
      success: true,
      message: 'Check your email for a magic link to sign in. The link will expire in 60 minutes.',
      data: {
        email: normalizedEmail,
        organization: partnerUser.organization?.name
      }
    })

  } catch (error: any) {
    console.error('❌ Magic link request error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process login request',
        details: error.message
      },
      { status: 500 }
    )
  }
}

// GET endpoint to check if email is valid partner user (for UX)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email parameter required' },
        { status: 400 }
      )
    }

    const normalizedEmail = email.toLowerCase().trim()

    const { data: partnerUser } = await supabaseAdmin
      .from('partner_users')
      .select('id, full_name, organization:organizations(name, slug)')
      .eq('email', normalizedEmail)
      .eq('is_active', true)
      .single()

    if (!partnerUser) {
      return NextResponse.json({
        success: true,
        exists: false
      })
    }

    return NextResponse.json({
      success: true,
      exists: true,
      data: {
        name: partnerUser.full_name,
        organization: partnerUser.organization
      }
    })

  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
