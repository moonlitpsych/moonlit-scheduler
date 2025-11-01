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
  { params }: { params: { patientId: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies })

    // 1. Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 2. Verify partner user
    const { data: partnerUser } = await supabaseAdmin
      .from('partner_users')
      .select('id, email, organization_id, role')
      .eq('auth_user_id', user.id)
      .single()

    if (!partnerUser) {
      return NextResponse.json(
        { success: false, error: 'Partner user not found' },
        { status: 403 }
      )
    }

    // 3. Parse query parameters
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || undefined
    const limit = parseInt(searchParams.get('limit') || '10')

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
      .eq('patient_id', params.patientId)
      .order('start_time', { ascending: false })
      .limit(limit)

    // Apply status filter if provided
    if (status) {
      query = query.eq('status', status)
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
