// Referral Network Logs API
// GET /api/admin/referral-network/logs - Get document generation audit logs

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isAdminEmail } from '@/lib/admin-auth'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import type { DocumentLogsResponse } from '@/types/referral-network'

async function verifyAdminAccess() {
  try {
    const supabase = createServerComponentClient({ cookies })
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

// GET - List document generation logs
export async function GET(request: NextRequest) {
  try {
    // Verify admin access
    const { authorized } = await verifyAdminAccess()
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('page_size') || '25')
    const userEmail = searchParams.get('user_email') || ''

    const offset = (page - 1) * pageSize

    // Build query
    let query = supabaseAdmin
      .from('referral_document_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (userEmail) {
      query = query.ilike('generated_by_email', `%${userEmail}%`)
    }

    // Apply pagination
    query = query.range(offset, offset + pageSize - 1)

    const { data: logs, error, count } = await query

    if (error) {
      console.error('Error fetching logs:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch logs' },
        { status: 500 }
      )
    }

    const response: DocumentLogsResponse = {
      logs: logs || [],
      total_count: count || 0,
      page,
      page_size: pageSize
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Logs API error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
