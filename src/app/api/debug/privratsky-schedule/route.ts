import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    // Find Dr. Privratsky
    const { data: provider, error: providerError } = await supabaseAdmin
      .from('providers')
      .select('id, first_name, last_name, role, email')
      .ilike('last_name', '%privratsky%')
      .single()

    if (providerError || !provider) {
      return NextResponse.json({
        success: false,
        error: 'Dr. Privratsky not found'
      }, { status: 404 })
    }

    console.log(`📅 Fetching schedule for ${provider.first_name} ${provider.last_name}...`)

    // Get their availability from provider_availability (source of truth)
    const { data: availability, error: availError } = await supabaseAdmin
      .from('provider_availability')
      .select('*')
      .eq('provider_id', provider.id)
      .order('day_of_week')

    // Get their cached availability slots
    const { data: cachedSlots, error: cacheError } = await supabaseAdmin
      .from('provider_availability_cache')
      .select('*')
      .eq('provider_id', provider.id)
      .gte('date', new Date().toISOString().split('T')[0])
      .order('date')
      .limit(30)

    // Get their upcoming appointments
    const { data: appointments, error: apptError } = await supabaseAdmin
      .from('appointments')
      .select('id, start_time, end_time, status, patient_id')
      .eq('provider_id', provider.id)
      .gte('start_time', new Date().toISOString())
      .order('start_time')
      .limit(20)

    // Format availability by day of week
    const scheduleByDay = [
      'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
    ].map((dayName, dayNum) => {
      const dayAvailability = availability?.filter(a => a.day_of_week === dayNum) || []

      return {
        day: dayName,
        day_of_week: dayNum,
        slots: dayAvailability.map(slot => ({
          start_time: slot.start_time,
          end_time: slot.end_time,
          is_available: slot.is_available,
          service_instance_id: slot.service_instance_id,
          recurrence_rule: slot.recurrence_rule
        }))
      }
    })

    // Group cached slots by date
    const upcomingDates = cachedSlots?.reduce((acc, slot) => {
      const date = slot.date
      if (!acc[date]) {
        acc[date] = []
      }
      acc[date].push({
        start_time: slot.start_time,
        end_time: slot.end_time,
        is_available: slot.is_available
      })
      return acc
    }, {} as Record<string, any[]>)

    return NextResponse.json({
      success: true,
      data: {
        provider: {
          id: provider.id,
          name: `${provider.first_name} ${provider.last_name}`,
          role: provider.role,
          email: provider.email
        },
        weekly_schedule: scheduleByDay,
        upcoming_availability: {
          dates_with_slots: Object.keys(upcomingDates || {}).length,
          next_7_days: Object.entries(upcomingDates || {})
            .slice(0, 7)
            .map(([date, slots]) => ({
              date,
              slot_count: slots.length,
              available_slots: slots.filter(s => s.is_available).length,
              slots: slots.slice(0, 5) // Show first 5 slots
            }))
        },
        upcoming_appointments: {
          total: appointments?.length || 0,
          appointments: appointments?.map(apt => ({
            start_time: apt.start_time,
            status: apt.status
          }))
        }
      }
    })

  } catch (error: any) {
    console.error('Error fetching schedule:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
