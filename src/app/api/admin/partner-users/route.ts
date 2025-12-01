// Admin API - Get all partner users for impersonation
import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'
import { isAdminEmail } from '@/lib/admin-auth'

export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    if (sessionError || !session) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Verify user is admin (must await - isAdminEmail is async!)
    if (!await isAdminEmail(session.user.email || '')) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    console.log('🔍 Admin fetching partner users for impersonation')

    // Fetch all partner users using admin client (bypasses RLS)
    // Must explicitly specify the FK relationship because there are two:
    // 1. partner_users.organization_id -> organizations.id (the one we want)
    // 2. organizations.default_case_manager_id -> partner_users.id
    const { data: partners, error } = await supabaseAdmin
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
        organization:organizations!partner_users_organization_id_fkey(
          id,
          name
        )
      `)
      .order('full_name', { ascending: true })

    if (error) {
      console.error('❌ Error fetching partner users:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch partner users', details: error.message },
        { status: 500 }
      )
    }

    console.log(`✅ Found ${partners?.length || 0} partner users`)

    return NextResponse.json({
      success: true,
      data: partners
    })

  } catch (error: any) {
    console.error('❌ Error in GET /api/admin/partner-users:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
