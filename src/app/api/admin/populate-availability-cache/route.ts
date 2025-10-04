import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { start_date, end_date, provider_id, service_instance_id } = await request.json()

    if (!start_date) {
      return NextResponse.json(
        { error: 'start_date is required' },
        { status: 400 }
      )
    }

    const endDate = end_date || start_date
    console.log(`🔄 Populating availability cache from ${start_date} to ${endDate}...`)

    // Get all bookable providers (or specific provider if requested)
    let providersQuery = supabase
      .from('providers')
      .select('id, first_name, last_name')
      .eq('is_bookable', true)
      .not('intakeq_practitioner_id', 'is', null)

    if (provider_id) {
      providersQuery = providersQuery.eq('id', provider_id)
    }

    const { data: providers, error: providersError } = await providersQuery

    if (providersError) {
      console.error('❌ Error fetching providers:', providersError)
      return NextResponse.json({ error: providersError.message }, { status: 500 })
    }

    console.log(`👥 Found ${providers?.length || 0} bookable providers`)

    const cacheRecords = []
    const startDate = new Date(start_date)
    const endDateObj = new Date(endDate)

    // Loop through each date in the range
    for (let currentDate = new Date(startDate); currentDate <= endDateObj; currentDate.setDate(currentDate.getDate() + 1)) {
      const dateStr = currentDate.toISOString().split('T')[0]
      const dayOfWeek = currentDate.getDay()

      console.log(`📅 Processing ${dateStr} (day of week: ${dayOfWeek})`)

      // For each provider, get their recurring availability for this day of week
      for (const provider of providers || []) {
        const { data: availability, error: availError } = await supabase
          .from('provider_availability')
          .select('*')
          .eq('provider_id', provider.id)
          .eq('day_of_week', dayOfWeek)
          .eq('is_recurring', true)

        if (availError) {
          console.error(`❌ Error fetching availability for ${provider.first_name} ${provider.last_name}:`, availError)
          continue
        }

        if (!availability || availability.length === 0) {
          console.log(`⚠️ No recurring availability for ${provider.first_name} ${provider.last_name} on day ${dayOfWeek}`)
          continue
        }

        // Generate time slots from availability
        const availableSlots = []

        for (const avail of availability) {
          const slots = generateTimeSlots(avail.start_time, avail.end_time, 60, dateStr) // 60-minute slots
          availableSlots.push(...slots)
        }

        if (availableSlots.length > 0) {
          cacheRecords.push({
            provider_id: provider.id,
            service_instance_id: service_instance_id || null,
            date: dateStr,
            available_slots: availableSlots
          })

          console.log(`✅ ${provider.first_name} ${provider.last_name}: ${availableSlots.length} slots on ${dateStr}`)
        }
      }
    }

    console.log(`📊 Total cache records to insert: ${cacheRecords.length}`)

    // Insert cache records
    const { data: insertedRecords, error: insertError } = await supabase
      .from('provider_availability_cache')
      .upsert(cacheRecords, {
        onConflict: 'provider_id,service_instance_id,date',
        ignoreDuplicates: false
      })
      .select()

    if (insertError) {
      console.error('❌ Error inserting cache records:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    console.log(`✅ Successfully populated cache with ${cacheRecords.length} records`)

    return NextResponse.json({
      success: true,
      message: `Populated availability cache for ${providers?.length} providers from ${start_date} to ${endDate}`,
      recordsInserted: cacheRecords.length,
      dateRange: { start_date, end_date },
      providers: providers?.map(p => `${p.first_name} ${p.last_name}`)
    })

  } catch (error: any) {
    console.error('❌ Cache population failed:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// Helper function to generate time slots in the correct format for the database trigger
// Uses ISO 8601 format with timezone to match what expand_available_slots() expects
function generateTimeSlots(startTime: string, endTime: string, durationMinutes: number, date: string): any[] {
  const slots = []

  const [startHour, startMin] = startTime.split(':').map(Number)
  const [endHour, endMin] = endTime.split(':').map(Number)

  let currentHour = startHour
  let currentMin = startMin

  while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
    // Store ONLY the time portion - the function will concatenate with the date
    const startTimeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}:00`

    // Calculate end time
    let endMinutes = currentMin + durationMinutes
    let endHours = currentHour
    if (endMinutes >= 60) {
      endHours += Math.floor(endMinutes / 60)
      endMinutes = endMinutes % 60
    }
    const endTimeStr = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}:00`

    // Only add if the end time doesn't exceed the availability window
    if (endHours < endHour || (endHours === endHour && endMinutes <= endMin)) {
      slots.push({
        start: startTimeStr,  // Key must be 'start' not 'start_time'
        end: endTimeStr,      // Key must be 'end' not 'end_time'
        available: true,
        appointment_type: 'telehealth',
        duration_minutes: durationMinutes
      })
    }

    // Add duration to move to next slot
    currentMin += durationMinutes
    if (currentMin >= 60) {
      currentHour += Math.floor(currentMin / 60)
      currentMin = currentMin % 60
    }
  }

  return slots
}
