/**
 * Organization Users API
 *
 * GET /api/organizations/[orgId]/users
 *
 * Query params:
 * - role: Filter by role (case_manager maps to partner_case_manager)
 * - status: Filter by status (active, inactive)
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params
    const { searchParams } = new URL(request.url)

    const role = searchParams.get('role')
    const status = searchParams.get('status')

    console.log(`👥 Fetching users for organization ${orgId}:`, { role, status })

    // Build query
    let query = supabaseAdmin
      .from('partner_users')
      .select('id, full_name, email, role, is_active')
      .eq('organization_id', orgId)

    // Map role filter - 'case_manager' maps to 'partner_case_manager'
    if (role) {
      const mappedRole = role === 'case_manager' ? 'partner_case_manager' : role
      query = query.eq('role', mappedRole)
    }

    // Filter by status
    if (status === 'active') {
      query = query.eq('is_active', true)
    } else if (status === 'inactive') {
      query = query.eq('is_active', false)
    }

    // Order by name
    query = query.order('full_name', { ascending: true })

    const { data, error } = await query

    if (error) {
      console.error('❌ Error fetching organization users:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch users', details: error.message },
        { status: 500 }
      )
    }

    // Transform to expected format (split full_name into first_name/last_name)
    const transformedData = (data || []).map(user => {
      const nameParts = (user.full_name || '').trim().split(' ')
      const firstName = nameParts[0] || ''
      const lastName = nameParts.slice(1).join(' ') || ''

      return {
        id: user.id,
        first_name: firstName,
        last_name: lastName,
        email: user.email,
        role: user.role,
        is_active: user.is_active
      }
    })

    console.log(`✅ Found ${transformedData.length} users for organization ${orgId}`)

    return NextResponse.json({
      success: true,
      data: transformedData
    })

  } catch (error: any) {
    console.error('❌ Organization users fetch error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch users', details: error.message },
      { status: 500 }
    )
  }
}
