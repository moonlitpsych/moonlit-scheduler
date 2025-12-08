/**
 * Admin API - Weekly Intake Capacity
 * Returns intake slot counts with per-provider breakdown
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Get week_start from query params, default to current week's Monday
    let weekStart = searchParams.get('week_start')

    if (!weekStart) {
      // Calculate current week's Monday
      const now = new Date()
      const day = now.getDay()
      const diff = now.getDate() - day + (day === 0 ? -6 : 1) // Adjust for Sunday
      const monday = new Date(now)
      monday.setDate(diff)
      weekStart = monday.toISOString().split('T')[0]
    }

    // Calculate week end (Sunday)
    const weekStartDate = new Date(weekStart)
    const weekEndDate = new Date(weekStartDate)
    weekEndDate.setDate(weekEndDate.getDate() + 6)
    const weekEnd = weekEndDate.toISOString().split('T')[0]

    // Fetch capacity data with provider details
    const { data: capacityData, error } = await supabaseAdmin
      .from('weekly_intake_capacity')
      .select(`
        id,
        slot_count,
        provider_id,
        providers (
          id,
          first_name,
          last_name
        )
      `)
      .eq('week_start', weekStart)
      .order('slot_count', { ascending: false })

    if (error) {
      console.error('❌ Error fetching intake capacity:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch intake capacity', details: error },
        { status: 500 }
      )
    }

    // Calculate total and build breakdown
    const totalSlots = capacityData?.reduce((sum, item) => sum + item.slot_count, 0) || 0

    const providers = capacityData?.map(item => ({
      provider_id: item.provider_id,
      provider_name: `${(item.providers as any)?.first_name || ''} ${(item.providers as any)?.last_name || ''}`.trim(),
      slot_count: item.slot_count
    })) || []

    return NextResponse.json({
      success: true,
      data: {
        week_start: weekStart,
        week_end: weekEnd,
        total_slots: totalSlots,
        providers: providers,
        has_data: capacityData && capacityData.length > 0
      }
    })

  } catch (error: any) {
    console.error('❌ Error in intake-slots API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
