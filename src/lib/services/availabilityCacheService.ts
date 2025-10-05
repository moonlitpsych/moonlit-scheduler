// Auto-populate availability cache when users view calendar dates
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

interface CacheRecord {
  provider_id: string
  service_instance_id: string | null
  date: string
  available_slots: any[]
}

// Default to Telehealth Intake service instance
const DEFAULT_SERVICE_INSTANCE_ID = '12191f44-a09c-426f-8e22-0c5b8e57b3b7'

/**
 * Auto-populate cache for a specific date range if it doesn't exist
 * This ensures that when users view the calendar, the cache is always populated
 */
export async function ensureCacheExists(
  startDate: string,
  endDate: string,
  serviceInstanceId?: string
): Promise<{ success: boolean; recordsCreated: number; error?: string }> {
  try {
    console.log(`🔍 Checking cache for ${startDate} to ${endDate}...`)

    // Check if cache already exists for this date range
    const { data: existingCache, error: checkError } = await supabase
      .from('provider_availability_cache')
      .select('date, provider_id')
      .gte('date', startDate)
      .lte('date', endDate)

    if (checkError) {
      console.error('❌ Error checking cache:', checkError)
      return { success: false, recordsCreated: 0, error: checkError.message }
    }

    // Get all dates in the range
    const start = new Date(startDate)
    const end = new Date(endDate)
    const datesToPopulate = []

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0]

      // Check if this date has cache entries
      const hasCache = existingCache?.some(c => c.date === dateStr)

      if (!hasCache) {
        datesToPopulate.push(dateStr)
      }
    }

    if (datesToPopulate.length === 0) {
      console.log(`✅ Cache already exists for ${startDate} to ${endDate}`)
      return { success: true, recordsCreated: 0 }
    }

    console.log(`🔄 Auto-populating cache for ${datesToPopulate.length} dates:`, datesToPopulate)

    // Get all bookable providers
    const { data: providers, error: providersError } = await supabase
      .from('providers')
      .select('id, first_name, last_name')
      .eq('is_bookable', true)
      .not('intakeq_practitioner_id', 'is', null)

    if (providersError) {
      console.error('❌ Error fetching providers:', providersError)
      return { success: false, recordsCreated: 0, error: providersError.message }
    }

    if (!providers || providers.length === 0) {
      console.log('⚠️ No bookable providers found')
      return { success: true, recordsCreated: 0 }
    }

    const cacheRecords: CacheRecord[] = []

    // For each date that needs cache
    for (const dateStr of datesToPopulate) {
      const dateObj = new Date(dateStr + 'T00:00:00')
      const dayOfWeek = dateObj.getDay()

      // For each provider, get their recurring availability for this day of week
      for (const provider of providers) {
        const { data: availability, error: availError } = await supabase
          .from('provider_availability')
          .select('*')
          .eq('provider_id', provider.id)
          .eq('day_of_week', dayOfWeek)
          .eq('is_recurring', true)

        if (availError) {
          console.error(`❌ Error fetching availability for ${provider.first_name}:`, availError)
          continue
        }

        if (!availability || availability.length === 0) {
          continue // No availability for this day
        }

        // Generate time slots from availability
        const availableSlots = []

        for (const avail of availability) {
          const slots = generateTimeSlots(avail.start_time, avail.end_time, 60)
          availableSlots.push(...slots)
        }

        if (availableSlots.length > 0) {
          cacheRecords.push({
            provider_id: provider.id,
            service_instance_id: serviceInstanceId || DEFAULT_SERVICE_INSTANCE_ID,
            date: dateStr,
            available_slots: availableSlots
          })
        }
      }
    }

    if (cacheRecords.length === 0) {
      console.log('⚠️ No availability records to cache')
      return { success: true, recordsCreated: 0 }
    }

    // Insert cache records
    const { error: insertError } = await supabase
      .from('provider_availability_cache')
      .upsert(cacheRecords, {
        onConflict: 'provider_id,service_instance_id,date',
        ignoreDuplicates: false
      })

    if (insertError) {
      console.error('❌ Error inserting cache records:', insertError)
      return { success: false, recordsCreated: 0, error: insertError.message }
    }

    console.log(`✅ Auto-populated cache with ${cacheRecords.length} records for ${datesToPopulate.length} dates`)

    return { success: true, recordsCreated: cacheRecords.length }

  } catch (error: any) {
    console.error('❌ Cache auto-population failed:', error)
    return { success: false, recordsCreated: 0, error: error.message }
  }
}

/**
 * Generate time slots in the format expected by the database trigger
 */
function generateTimeSlots(startTime: string, endTime: string, durationMinutes: number): any[] {
  const slots = []

  const [startHour, startMin] = startTime.split(':').map(Number)
  const [endHour, endMin] = endTime.split(':').map(Number)

  let currentHour = startHour
  let currentMin = startMin

  while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
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
        start: startTimeStr,
        end: endTimeStr,
        available: true,
        appointment_type: 'telehealth',
        duration_minutes: durationMinutes
      })
    }

    // Move to next slot
    currentMin += durationMinutes
    if (currentMin >= 60) {
      currentHour += Math.floor(currentMin / 60)
      currentMin = currentMin % 60
    }
  }

  return slots
}
