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
        const { payer_id, date } = body

        if (!payer_id || !date) {
            return NextResponse.json(
                { success: false, error: 'payer_id and date are required' },
                { status: 400 }
            )
        }

        console.log('🔍 Fetching merged availability for:', { payer_id, date })

        // Step 1: Get providers who accept this payer
        const { data: networks, error: networksError } = await supabase
            .from('provider_payer_networks')
            .select(`
                provider_id,
                providers!inner(
                    id,
                    first_name,
                    last_name,
                    is_active
                )
            `)
            .eq('payer_id', payer_id)
            .eq('status', 'active')
            .eq('providers.is_active', true)

        if (networksError) {
            console.error('❌ Error fetching provider networks:', networksError)
            return NextResponse.json(
                { success: false, error: 'Failed to fetch provider networks' },
                { status: 500 }
            )
        }

        const acceptingProviders = networks?.map(n => n.provider_id) || []
        console.log('👥 Providers accepting this payer:', acceptingProviders.length)

        if (acceptingProviders.length === 0) {
            return NextResponse.json({
                success: true,
                data: {
                    availableSlots: [],
                    providersCount: 0,
                    message: 'No providers currently accept this insurance'
                }
            })
        }

        // Step 2: Convert date to day of week (0 = Sunday, 1 = Monday, etc.)
        const targetDate = new Date(date)
        const dayOfWeek = targetDate.getDay()
        console.log('📅 Target date day of week:', dayOfWeek)

        // Step 3: Get availability for these providers on this day of week
        const { data: availability, error: availabilityError } = await supabase
            .from('provider_availability')
            .select('*')
            .in('provider_id', acceptingProviders)
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

        // Step 4: Generate time slots from availability
        const timeSlots: TimeSlot[] = []
        
        availability?.forEach(avail => {
            const slots = generateTimeSlotsFromAvailability(avail, date)
            timeSlots.push(...slots)
        })

        console.log('⏰ Total time slots generated:', timeSlots.length)

        return NextResponse.json({
            success: true,
            data: {
                availableSlots: timeSlots,
                providersCount: acceptingProviders.length,
                availabilityRecords: availability?.length || 0,
                date,
                dayOfWeek
            }
        })

    } catch (error) {
        console.error('💥 Error in merged availability API:', error)
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