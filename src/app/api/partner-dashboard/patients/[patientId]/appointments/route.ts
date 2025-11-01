/**
 * GET /api/partner-dashboard/patients/[patientId]/appointments
 * Fetch appointments for a patient
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ patientId: string }> }
) {
  try {
    // Await params (Next.js 15 requirement)
    const { patientId } = await params

    const supabase = createRouteHandlerClient({ cookies })

    // 1. Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 2. Parse query parameters (including impersonation)
    const { searchParams } = new URL(request.url)
    const partnerUserId = searchParams.get('partner_user_id') // For admin impersonation
    const statusFilter = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '10')

    // 3. Get partner user record (with impersonation support)
    let partnerUserQuery = supabaseAdmin
      .from('partner_users')
      .select('id, email, organization_id, role')
      .eq('is_active', true)

    if (partnerUserId) {
      // Admin is impersonating - use provided partner_user_id
      partnerUserQuery = partnerUserQuery.eq('id', partnerUserId)
    } else {
      // Regular partner user - lookup by auth_user_id
      partnerUserQuery = partnerUserQuery.eq('auth_user_id', user.id)
    }

    const { data: partnerUser, error: userError } = await partnerUserQuery.single()

    if (userError || !partnerUser) {
      return NextResponse.json(
        { success: false, error: 'Partner user not found' },
        { status: 403 }
      )
    }

    // 4. Fetch appointments
    let query = supabaseAdmin
      .from('appointments')
      .select(`
        id,
        start_time,
        end_time,
        status,
        providers:provider_id (
          id,
          first_name,
          last_name
        )
      `)
      .eq('patient_id', patientId)
      .order('start_time', { ascending: false })
      .limit(limit)

    // Apply status filter - support both 'completed' and 'confirmed' for past appointments
    if (statusFilter === 'completed') {
      query = query.in('status', ['completed', 'confirmed'])
    } else if (statusFilter) {
      query = query.eq('status', statusFilter)
    }

    const { data: appointments, error: appointmentsError } = await query

    if (appointmentsError) {
      console.error('Error fetching appointments:', appointmentsError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch appointments' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: appointments || []
    })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
