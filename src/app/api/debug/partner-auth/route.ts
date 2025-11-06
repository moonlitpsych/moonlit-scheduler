/**
 * DEBUG ENDPOINT: Check partner authentication state
 * GET /api/debug/partner-auth
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    // 1. Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    const debugInfo: any = {
      timestamp: new Date().toISOString(),
      session: null,
      partnerUser: null,
      allPartnerUsers: [],
      diagnosis: []
    }

    if (sessionError) {
      debugInfo.sessionError = sessionError.message
      debugInfo.diagnosis.push('❌ Session error: ' + sessionError.message)
    }

    if (!session) {
      debugInfo.diagnosis.push('❌ No active session found')
      return NextResponse.json(debugInfo)
    }

    debugInfo.session = {
      userId: session.user.id,
      email: session.user.email,
      createdAt: session.user.created_at
    }
    debugInfo.diagnosis.push('✅ Session found for user: ' + session.user.email)

    // 2. Try to find partner user by auth_user_id
    const { data: partnerUser, error: userError } = await supabaseAdmin
      .from('partner_users')
      .select('id, email, organization_id, role, is_active, auth_user_id')
      .eq('auth_user_id', session.user.id)
      .eq('is_active', true)
      .single()

    if (userError) {
      debugInfo.partnerUserError = userError.message
      debugInfo.diagnosis.push('❌ Partner user lookup error: ' + userError.message)
    }

    if (partnerUser) {
      debugInfo.partnerUser = partnerUser
      debugInfo.diagnosis.push('✅ Found partner user: ' + partnerUser.email)
    } else {
      debugInfo.diagnosis.push('⚠️ No active partner_user found with auth_user_id = ' + session.user.id)
    }

    // 3. Get ALL partner users (for debugging)
    const { data: allUsers } = await supabaseAdmin
      .from('partner_users')
      .select('id, email, organization_id, role, is_active, auth_user_id')
      .order('created_at', { ascending: false })

    debugInfo.allPartnerUsers = allUsers || []
    debugInfo.diagnosis.push(`ℹ️ Total partner_users in database: ${allUsers?.length || 0}`)

    // 4. Find partner user by email (alternative lookup)
    if (!partnerUser && session.user.email) {
      const { data: userByEmail } = await supabaseAdmin
        .from('partner_users')
        .select('id, email, organization_id, role, is_active, auth_user_id')
        .eq('email', session.user.email)
        .single()

      if (userByEmail) {
        debugInfo.partnerUserByEmail = userByEmail
        if (!userByEmail.auth_user_id) {
          debugInfo.diagnosis.push('⚠️ Found partner_user by email but auth_user_id is NULL')
          debugInfo.diagnosis.push('🔧 FIX: Update partner_users SET auth_user_id = \'' + session.user.id + '\' WHERE email = \'' + session.user.email + '\'')
        } else if (userByEmail.auth_user_id !== session.user.id) {
          debugInfo.diagnosis.push('⚠️ Found partner_user by email but auth_user_id MISMATCH')
          debugInfo.diagnosis.push('   Partner user auth_user_id: ' + userByEmail.auth_user_id)
          debugInfo.diagnosis.push('   Session user id: ' + session.user.id)
        }
        if (!userByEmail.is_active) {
          debugInfo.diagnosis.push('⚠️ Partner user found but is_active = false')
          debugInfo.diagnosis.push('🔧 FIX: Update partner_users SET is_active = true WHERE email = \'' + session.user.email + '\'')
        }
      } else {
        debugInfo.diagnosis.push('❌ No partner_user found with email: ' + session.user.email)
      }
    }

    return NextResponse.json(debugInfo, { status: 200 })
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      diagnosis: ['❌ Unexpected error: ' + error.message]
    }, { status: 500 })
  }
}
