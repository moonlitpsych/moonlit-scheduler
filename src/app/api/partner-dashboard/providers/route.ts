/**
 * Partner Dashboard API - Get All Providers
 * Returns all active providers for admin assignment purposes
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
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

    // Get partner user (only admins and case managers can access this)
    const { data: partnerUser, error: userError } = await supabaseAdmin
      .from('partner_users')
      .select('id, organization_id, role')
      .eq('auth_user_id', session.user.id)
      .eq('is_active', true)
      .single()

    if (userError || !partnerUser) {
      return NextResponse.json(
        { success: false, error: 'Partner user not found' },
        { status: 404 }
      )
    }

    // Only admins and case managers can view provider list
    if (!['partner_admin', 'partner_case_manager'].includes(partnerUser.role)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Fetch all active providers (no bookability restrictions for admin use)
    const { data: providers, error: providersError } = await supabaseAdmin
      .from('providers')
      .select(`
        id,
        first_name,
        last_name,
        title,
        is_active
      `)
      .eq('is_active', true)
      .order('last_name')

    if (providersError) {
      console.error('Error fetching providers:', providersError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch providers' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: providers || []
    })

  } catch (error: any) {
    console.error('❌ Error fetching providers:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch providers', details: error.message },
      { status: 500 }
    )
  }
}
