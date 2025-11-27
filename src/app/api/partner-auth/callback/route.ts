/**
 * Partner Authentication - Magic Link Callback
 * Handles Supabase auth callback after magic link click
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')
    const error = requestUrl.searchParams.get('error')
    const error_description = requestUrl.searchParams.get('error_description')

    console.log('🔐 Partner auth callback:', { code: !!code, error })

    // Handle auth errors
    if (error) {
      console.error('❌ Auth callback error:', error, error_description)
      return NextResponse.redirect(
        `${requestUrl.origin}/partner-auth/login?error=${encodeURIComponent(error_description || error)}`
      )
    }

    if (!code) {
      return NextResponse.redirect(
        `${requestUrl.origin}/partner-auth/login?error=No authentication code received`
      )
    }

    // Exchange code for session
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    const { data: { session }, error: sessionError } = await supabase.auth.exchangeCodeForSession(code)

    if (sessionError || !session) {
      console.error('❌ Failed to exchange code for session:', sessionError)
      return NextResponse.redirect(
        `${requestUrl.origin}/partner-auth/login?error=Failed to verify login link`
      )
    }

    // Get partner user record
    const { data: partnerUser, error: partnerUserError } = await supabaseAdmin
      .from('partner_users')
      .select(`
        id,
        email,
        full_name,
        role,
        is_active,
        organization_id,
        organization:organizations!partner_users_organization_id_fkey(
          id,
          name,
          slug,
          status
        )
      `)
      .eq('auth_user_id', session.user.id)
      .eq('is_active', true)
      .single()

    if (partnerUserError || !partnerUser) {
      console.error('❌ Partner user not found or inactive')
      await supabase.auth.signOut()

      return NextResponse.redirect(
        `${requestUrl.origin}/partner-auth/login?error=Access denied. Partner account not found or inactive.`
      )
    }

    // Check organization status
    if (partnerUser.organization?.status !== 'active') {
      console.error('❌ Organization is not active')
      await supabase.auth.signOut()

      return NextResponse.redirect(
        `${requestUrl.origin}/partner-auth/login?error=Your organization account is currently inactive.`
      )
    }

    // Update last login timestamp
    await supabaseAdmin
      .from('partner_users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', partnerUser.id)

    // Log successful login for audit
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
          login_method: 'magic_link'
        }
      })

    console.log('✅ Partner user logged in via magic link:', {
      user_id: partnerUser.id,
      email: partnerUser.email,
      organization: partnerUser.organization?.name,
      role: partnerUser.role
    })

    // Redirect to partner dashboard
    const dashboardUrl = `${requestUrl.origin}/partner-dashboard`

    return NextResponse.redirect(dashboardUrl)

  } catch (error: any) {
    console.error('❌ Auth callback error:', error)

    const requestUrl = new URL(request.url)
    return NextResponse.redirect(
      `${requestUrl.origin}/partner-auth/login?error=Authentication failed. Please try again.`
    )
  }
}
