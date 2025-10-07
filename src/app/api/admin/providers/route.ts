// Admin API endpoint for fetching ALL providers (not just bookable ones)
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isAdminEmail } from '@/lib/admin-auth'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

async function verifyAdminAccess() {
  try {
    const cookieStore = await cookies()
    const supabase = createServerComponentClient({ cookies: () => cookieStore })
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user || !isAdminEmail(user.email || '')) {
      return { authorized: false, user: null }
    }

    return { authorized: true, user }
  } catch (error) {
    console.error('Admin verification error:', error)
    return { authorized: false, user: null }
  }
}

export async function GET(request: NextRequest) {
  try {
    const { authorized } = await verifyAdminAccess()
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    console.log('🔍 Admin fetching ALL providers...')

    // Fetch ALL providers (no filters) for admin use
    const { data: providers, error } = await supabaseAdmin
      .from('providers')
      .select('id, first_name, last_name, email, is_active, is_bookable, role, title')
      .order('last_name')

    if (error) {
      console.error('❌ Error fetching providers:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch providers', details: error },
        { status: 500 }
      )
    }

    console.log(`✅ Found ${providers?.length || 0} providers`)

    return NextResponse.json({
      success: true,
      data: providers || [],
      total: providers?.length || 0
    })

  } catch (error: any) {
    console.error('❌ Error in admin providers API:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch providers',
        details: error.message
      },
      { status: 500 }
    )
  }
}
