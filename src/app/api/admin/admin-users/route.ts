// Admin Users Management API
// Manages admin user accounts in the database

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'
import { isAdminEmailSync } from '@/lib/admin-auth'

// Use service role to bypass RLS
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!
const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey)

interface AdminUser {
  id: string
  email: string
  full_name: string | null
  added_by_email: string | null
  added_at: string
  last_login_at: string | null
  is_active: boolean
  notes: string | null
}

/**
 * GET /api/admin/admin-users
 * Fetch all admin users from database
 * Returns both DB admins and hardcoded admins
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin access
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user email from Supabase auth
    const token = authHeader.replace('Bearer ', '')
    const supabase = createClient<Database>(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      )
    }

    // Check if user is admin (synchronous check for hardcoded list)
    if (!isAdminEmailSync(user.email || '')) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Fetch all admin users from database
    const { data: adminUsers, error: dbError } = await supabaseAdmin
      .from('admin_users')
      .select('*')
      .order('added_at', { ascending: false })

    if (dbError) {
      console.error('Error fetching admin users:', dbError)
      return NextResponse.json(
        { error: 'Failed to fetch admin users' },
        { status: 500 }
      )
    }

    // Get auth.users data for last login times
    const { data: authUsers, error: authUsersError } = await supabaseAdmin.auth.admin.listUsers()

    if (authUsersError) {
      console.warn('Could not fetch auth users for login times:', authUsersError)
    }

    // Merge auth data with admin_users data
    const enrichedAdmins = (adminUsers || []).map((admin: any) => {
      const authUser = authUsers?.users.find((u) => u.email === admin.email)
      return {
        ...admin,
        last_login_at: authUser?.last_sign_in_at || null,
        has_account: !!authUser,
      }
    })

    return NextResponse.json({
      admins: enrichedAdmins,
      total: enrichedAdmins.length,
    })
  } catch (error) {
    console.error('Unexpected error in GET /api/admin/admin-users:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/admin-users
 * Add a new admin user to the database
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin access
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user email from Supabase auth
    const token = authHeader.replace('Bearer ', '')
    const supabase = createClient<Database>(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      )
    }

    // Check if user is admin
    if (!isAdminEmailSync(user.email || '')) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { email, full_name, notes } = body

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Check if admin already exists
    const { data: existing, error: checkError } = await supabaseAdmin
      .from('admin_users')
      .select('id, email')
      .eq('email', email.toLowerCase())
      .maybeSingle()

    if (checkError) {
      console.error('Error checking existing admin:', checkError)
      return NextResponse.json(
        { error: 'Database error' },
        { status: 500 }
      )
    }

    if (existing) {
      return NextResponse.json(
        { error: 'Admin user with this email already exists' },
        { status: 409 }
      )
    }

    // Insert new admin user
    const { data: newAdmin, error: insertError } = await supabaseAdmin
      .from('admin_users')
      .insert({
        email: email.toLowerCase(),
        full_name: full_name || null,
        added_by_email: user.email,
        notes: notes || null,
        is_active: true,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error inserting admin user:', insertError)
      return NextResponse.json(
        { error: 'Failed to create admin user' },
        { status: 500 }
      )
    }

    // Log action to admin_action_logs
    await supabaseAdmin.from('admin_action_logs').insert({
      admin_email: user.email,
      action_type: 'admin_user_added',
      description: `Added new admin user: ${email}`,
      table_name: 'admin_users',
      record_id: newAdmin.id,
      changes: {
        email,
        full_name,
        notes,
      },
    })

    return NextResponse.json({
      success: true,
      admin: newAdmin,
      message: 'Admin user added successfully',
    })
  } catch (error) {
    console.error('Unexpected error in POST /api/admin/admin-users:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
