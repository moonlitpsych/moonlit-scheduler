// src/app/api/finance/appointments/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/finance/appointments
 *
 * Fetch appointments grid data with filters and pagination
 *
 * Query params:
 * - from: Start date (YYYY-MM-DD)
 * - to: End date (YYYY-MM-DD)
 * - provider_id: Filter by provider UUID
 * - payer_id: Filter by payer UUID
 * - status: Filter by appointment status
 * - limit: Page size (default 100)
 * - offset: Pagination offset (default 0)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const providerId = searchParams.get('provider_id')
    const payerId = searchParams.get('payer_id')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build query
    let query = supabaseAdmin
      .from('v_appointments_grid')
      .select('*', { count: 'exact' })

    // Apply filters
    if (from) {
      query = query.gte('appt_date', from)
    }
    if (to) {
      query = query.lte('appt_date', to)
    }
    if (providerId) {
      query = query.eq('provider_id', providerId)
    }
    if (payerId) {
      query = query.eq('payer_id', payerId)
    }
    if (status) {
      query = query.eq('appointment_status', status)
    }

    // Apply pagination and ordering
    query = query
      .order('appt_date', { ascending: false })
      .order('start_time', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('Query error:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        total: count || 0,
        limit,
        offset,
        has_more: (count || 0) > offset + limit
      }
    })

  } catch (error: any) {
    console.error('Appointments grid error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/finance/appointments/recompute
 *
 * Recompute provider earnings for a date range
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { from, to } = body

    if (!from || !to) {
      return NextResponse.json(
        { success: false, error: 'Missing from or to dates' },
        { status: 400 }
      )
    }

    // Call stored procedure
    const { data, error } = await supabaseAdmin
      .rpc('sp_recompute_provider_earnings_range', {
        p_from: from,
        p_to: to
      })

    if (error) {
      console.error('Recompute error:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Recomputed earnings for ${data?.[0]?.processed || 0} appointments`,
      results: data?.[0] || { processed: 0, succeeded: 0, failed: 0 }
    })

  } catch (error: any) {
    console.error('Recompute error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
