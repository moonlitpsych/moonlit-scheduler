import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

// Interface for availability slot
interface AvailableSlot {
    date: string
    time: string
    provider: {
        id: string
        name: string
        title: string
        role: string
        telehealth_enabled: boolean
    }
}

export async function POST(request: NextRequest) {
    try {
        const { providerId, startDate, endDate, appointmentDuration = 60 } = await request.json()

        if (!providerId) {
            return NextResponse.json(
                { error: 'Provider ID is required', success: false },
                { status: 400 }
            )
        }

        console.log(`Getting availability for provider ${providerId}`)

        const supabase = createRouteHandlerClient({ cookies })

        // Get provider information first
        const { data: provider, error: providerError } = await supabase
            .from('providers')
            .select('*')
            .eq('id', providerId)
            .single()

        if (providerError) {
            console.error('Provider error:', providerError)
            return NextResponse.json(
                { error: 'Provider not found', details: providerError.message, success: false },
                { status: 404 }
            )
        }

        if (!provider) {
            return NextResponse.json(
                { error: 'Provider not found', success: false },
                { status: 404 }
            )
        }

        // Get provider's weekly schedule
        const { data: weeklySchedule, error: scheduleError } = await supabase
            .from('provider_availability')
            .select('*')
            .eq('provider_id', providerId)
            .order('day_of_week')
            .order('start_time')

        if (scheduleError) {
            console.error('Schedule error:', scheduleError)
            return NextResponse.json(
                { error: 'Failed to load schedule', details: scheduleError.message, success: false },
                { status: 500 }
            )
        }

        // Get exceptions for the date range
        const { data: exceptions, error: exceptionsError } = await supabase
            .from('availability_exceptions')
            .select('*')
            .eq('provider_id', providerId)
            .gte('exception_date', startDate.split('T')[0])
            .lte('exception_date', endDate.split('T')[0])

        // Get existing appointments (for now, assume none to keep it simple)
        // We can add this later once basic availability is working

        // Generate available slots
        const availableSlots: AvailableSlot[] = []
        const start = new Date(startDate)
        const end = new Date(endDate)
        
        // Process each day in the range
        for (let currentDate = new Date(start); currentDate <= end; currentDate.setDate(currentDate.getDate() + 1)) {
            const dayOfWeek = currentDate.getDay() // 0 = Sunday, 1 = Monday, etc.
            const dateString = currentDate.toISOString().split('T')[0]
            
            // Check if provider has availability on this day
            const daySchedule = weeklySchedule?.filter(block => block.day_of_week === dayOfWeek) || []
            
            // Check for exceptions on this date
            const dayExceptions = exceptions?.filter(ex => ex.exception_date === dateString) || []
            const hasUnavailableException = dayExceptions.some(ex => ex.exception_type === 'unavailable')
            
            if (daySchedule.length > 0 && !hasUnavailableException) {
                // Generate time slots for each availability block
                for (const block of daySchedule) {
                    const startTime = new Date(`${dateString}T${block.start_time}`)
                    const endTime = new Date(`${dateString}T${block.end_time}`)
                    
                    // Generate slots every hour (or appointmentDuration minutes)
                    for (let slotTime = new Date(startTime); slotTime < endTime; slotTime.setMinutes(slotTime.getMinutes() + appointmentDuration)) {
                        // Check if this slot conflicts with partial day exceptions
                        const slotTimeString = slotTime.toTimeString().slice(0, 5) + ':00'
                        const hasConflict = dayExceptions.some(ex => {
                            if (ex.exception_type === 'partial_block' && ex.start_time && ex.end_time) {
                                return slotTimeString >= ex.start_time && slotTimeString < ex.end_time
                            }
                            return false
                        })
                        
                        if (!hasConflict) {
                            availableSlots.push({
                                date: dateString,
                                time: slotTime.toTimeString().slice(0, 5), // HH:MM format
                                provider: {
                                    id: provider.id,
                                    name: `${provider.first_name} ${provider.last_name}`,
                                    title: provider.title || '',
                                    role: provider.role || '',
                                    telehealth_enabled: provider.telehealth_enabled || true
                                }
                            })
                        }
                    }
                }
            }
        }

        const response = {
            success: true,
            data: {
                providerId,
                totalSlots: availableSlots.length,
                dateRange: { startDate, endDate },
                availableSlots,
                provider: availableSlots.length > 0 ? availableSlots[0].provider : {
                    id: provider.id,
                    name: `${provider.first_name} ${provider.last_name}`,
                    title: provider.title || '',
                    role: provider.role || '',
                    telehealth_enabled: provider.telehealth_enabled || true
                },
                message: `Found ${availableSlots.length} available appointment slots for ${provider.first_name} ${provider.last_name}`
            }
        }

        return NextResponse.json(response)

    } catch (error: any) {
        console.error('Error getting provider availability:', error)
        return NextResponse.json(
            { 
                error: 'Failed to get provider availability', 
                details: error.message,
                stack: error.stack,
                success: false 
            },
            { status: 500 }
        )
    }
}