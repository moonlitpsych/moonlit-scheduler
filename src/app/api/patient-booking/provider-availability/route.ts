import { supabase } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

interface TimeSlot {
    id: string
    provider_id: string
    start_time: string
    end_time: string
    is_available: boolean
    appointment_type: string
    service_instance_id: string
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { provider_id, date } = body

        if (!provider_id || !date) {
            return NextResponse.json(
                { success: false, error: 'provider_id and date are required' },
                { status: 400 }
            )
        }

        console.log('🔍 Fetching provider availability for:', { provider_id, date })

        // Step 1: Verify provider exists and is active
        const { data: provider, error: providerError } = await supabase
            .from('providers')
            .select('id, first_name, last_name, is_active')
            .eq('id', provider_id)
            .eq('is_active', true)
            .single()

        if (providerError || !provider) {
            console.error('❌ Provider not found or inactive:', providerError)
            return NextResponse.json(
                { success: false, error: 'Provider not found or inactive' },
                { status: 404 }
            )
        }

        // Step 2: Convert date to day of week (0 = Sunday, 1 = Monday, etc.)
        const targetDate = new Date(date)
        const dayOfWeek = targetDate.getDay()
        console.log('📅 Target date day of week:', dayOfWeek)

        // Step 3: Get availability for this provider on this day of week
        const { data: availability, error: availabilityError } = await supabase
            .from('provider_availability')
            .select('*')
            .eq('provider_id', provider_id)
            .eq('day_of_week', dayOfWeek)
            .eq('is_recurring', true)

        if (availabilityError) {
            console.error('❌ Error fetching availability:', availabilityError)
            return NextResponse.json(
                { success: false, error: 'Failed to fetch availability' },
                { status: 500 }
            )
        }

        console.log('📊 Availability records found:', availability?.length || 0)

        // Step 4: Get availability exceptions for the specific date
        const { data: exceptions, error: exceptionsError } = await supabase
            .from('availability_exceptions')
            .select('*')
            .eq('provider_id', provider_id)
            .eq('exception_date', date)

        if (exceptionsError) {
            console.error('❌ Error fetching exceptions:', exceptionsError)
            return NextResponse.json(
                { success: false, error: 'Failed to fetch availability exceptions' },
                { status: 500 }
            )
        }

        console.log('🚫 Exceptions found for date:', exceptions?.length || 0)

        // Step 5: Generate time slots from availability, respecting exceptions
        const timeSlots: TimeSlot[] = []

        availability?.forEach(avail => {
            // Check if this provider has any exceptions for this date
            const providerException = exceptions?.find(e => e.provider_id === avail.provider_id)

            if (providerException) {
                // Handle different exception types
                if (providerException.exception_type === 'unavailable' ||
                    providerException.exception_type === 'vacation') {
                    // Skip this provider entirely for this date
                    console.log(`🚫 Provider ${avail.provider_id} unavailable on ${date}`)
                    return
                } else if (providerException.exception_type === 'custom_hours' &&
                          providerException.start_time && providerException.end_time) {
                    // Use custom hours instead of regular availability
                    const customAvail = {
                        ...avail,
                        start_time: providerException.start_time,
                        end_time: providerException.end_time
                    }
                    const slots = generateTimeSlotsFromAvailability(customAvail, date)
                    timeSlots.push(...slots)
                    return
                } else if (providerException.exception_type === 'partial_block') {
                    // Generate regular slots but filter out blocked time
                    const slots = generateTimeSlotsFromAvailability(avail, date)
                    const filteredSlots = slots.filter(slot => {
                        if (!providerException.start_time || !providerException.end_time) return true
                        const slotTime = new Date(slot.start_time).toTimeString().slice(0, 8)
                        return slotTime < providerException.start_time || slotTime >= providerException.end_time
                    })
                    timeSlots.push(...filteredSlots)
                    return
                }
            }

            // No exceptions or unhandled exception type - use regular availability
            const slots = generateTimeSlotsFromAvailability(avail, date)
            timeSlots.push(...slots)
        })

        console.log('⏰ Total time slots generated:', timeSlots.length)

        return NextResponse.json({
            success: true,
            data: {
                availableSlots: timeSlots,
                provider: {
                    id: provider.id,
                    name: `${provider.first_name} ${provider.last_name}`
                },
                availabilityRecords: availability?.length || 0,
                exceptionsCount: exceptions?.length || 0,
                date,
                dayOfWeek
            }
        })

    } catch (error) {
        console.error('💥 Error in provider availability API:', error)
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        )
    }
}

function generateTimeSlotsFromAvailability(availability: any, date: string): TimeSlot[] {
    const slots: TimeSlot[] = []
    
    try {
        const startTime = availability.start_time // e.g., "09:00:00"
        const endTime = availability.end_time     // e.g., "17:00:00"
        
        // Parse start and end times
        const [startHour, startMin] = startTime.split(':').map(Number)
        const [endHour, endMin] = endTime.split(':').map(Number)
        
        // Create date objects for this specific date
        const baseDate = new Date(date)
        const startDateTime = new Date(baseDate)
        startDateTime.setHours(startHour, startMin, 0, 0)
        
        const endDateTime = new Date(baseDate)
        endDateTime.setHours(endHour, endMin, 0, 0)
        
        // Generate 60-minute slots (you can adjust this)
        const slotDurationMinutes = 60
        let currentSlot = new Date(startDateTime)
        
        while (currentSlot < endDateTime) {
            const slotEnd = new Date(currentSlot.getTime() + (slotDurationMinutes * 60 * 1000))
            
            // Don't create slots that would extend past the availability end time
            if (slotEnd <= endDateTime) {
                const slot: TimeSlot = {
                    id: `${availability.provider_id}-${currentSlot.toISOString()}`,
                    provider_id: availability.provider_id,
                    start_time: currentSlot.toISOString(),
                    end_time: slotEnd.toISOString(),
                    is_available: true,
                    appointment_type: 'telehealth', // Default to telehealth
                    service_instance_id: 'default-service' // You might want to make this dynamic
                }
                
                slots.push(slot)
            }
            
            // Move to next slot
            currentSlot = new Date(currentSlot.getTime() + (slotDurationMinutes * 60 * 1000))
        }
        
    } catch (error) {
        console.error('❌ Error generating slots for availability:', availability.id, error)
    }
    
    return slots
}