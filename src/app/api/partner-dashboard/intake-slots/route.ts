/**
 * Partner Dashboard API - Weekly Intake Slots
 * Returns total intake slots available (no provider breakdown for privacy)
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    // Calculate current week's Monday
    const now = new Date()
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1) // Adjust for Sunday
    const monday = new Date(now)
    monday.setDate(diff)
    const weekStart = monday.toISOString().split('T')[0]

    // Calculate week end (Sunday)
    const weekEndDate = new Date(monday)
    weekEndDate.setDate(weekEndDate.getDate() + 6)
    const weekEnd = weekEndDate.toISOString().split('T')[0]

    // Fetch total capacity for this week (no provider details)
    const { data: capacityData, error } = await supabaseAdmin
      .from('weekly_intake_capacity')
      .select('slot_count')
      .eq('week_start', weekStart)

    if (error) {
      console.error('❌ Error fetching intake slots:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch intake slots', details: error },
        { status: 500 }
      )
    }

    // Calculate total
    const totalSlots = capacityData?.reduce((sum, item) => sum + item.slot_count, 0) || 0
    const hasData = capacityData && capacityData.length > 0

    // Generate time-of-day greeting
    const hour = now.getHours()
    let greeting: string
    if (hour < 12) {
      greeting = 'Good morning'
    } else if (hour < 17) {
      greeting = 'Good afternoon'
    } else {
      greeting = 'Good evening'
    }

    return NextResponse.json({
      success: true,
      data: {
        week_start: weekStart,
        week_end: weekEnd,
        total_slots: totalSlots,
        has_data: hasData,
        greeting: greeting,
        message: hasData
          ? `${greeting}! Moonlit has ${totalSlots} intake slots available this week.`
          : null
      }
    })

  } catch (error: any) {
    console.error('❌ Error in partner intake-slots API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
