// src/app/api/patient-booking/merged-availability/route.ts

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

interface AvailableSlot {
    date: string
    time: string
    providerId: string
    providerName: string
    duration: number
    isAvailable: boolean
    provider: {
        id: string
        first_name: string
        last_name: string
        title: string
        role: string
    }
}

export async function POST(request: NextRequest) {
    try {
        const { payerId, startDate, endDate, appointmentDuration = 60 } = await request.json()

        console.log(`Getting merged availability for payer ${payerId || 'test-payer'}`)

        const supabase = createRouteHandlerClient({ cookies })

        // Get all available providers (since we don't have provider-payer relationships set up yet)
        const { data: providers, error: providersError } = await supabase
            .from('providers')
            .select('id, first_name, last_name, title, role, availability, auth_user_id')
            .eq('availability', true)

        if (providersError) {
            console.error('Error getting providers:', providersError)
            return NextResponse.json({ 
                error: 'Failed to get providers', 
                details: providersError.message,
                success: false 
            }, { status: 500 })
        }

        if (!providers || providers.length === 0) {
            return NextResponse.json({
                success: true,
                data: {
                    totalSlots: 0,
                    availableSlots: [],
                    message: 'No providers found. Please create a provider with availability = true first.'
                }
            })
        }

        // Get availability for all providers
        const allSlots: AvailableSlot[] = []
        
        for (const provider of providers) {
            try {
                const providerSlots = await getProviderAvailability(
                    provider.id,
                    startDate,
                    endDate,
                    appointmentDuration,
                    supabase
                )
                
                providerSlots.forEach(slot => {
                    allSlots.push({
                        ...slot,
                        provider: {
                            id: provider.id,
                            first_name: provider.first_name,
                            last_name: provider.last_name,
                            title: provider.title || '',
                            role: provider.role || ''
                        }
                    })
                })
            } catch (error) {
                console.error(`Error getting availability for provider ${provider.id}:`, error)
                // Continue with other providers
            }
        }

        // Sort by date and time
        allSlots.sort((a, b) => {
            const dateTimeA = new Date(`${a.date} ${a.time}`).getTime()
            const dateTimeB = new Date(`${b.date} ${b.time}`).getTime()
            return dateTimeA - dateTimeB
        })

        // Group slots by date for easier frontend consumption
        const slotsByDate = allSlots.reduce((acc, slot) => {
            if (!acc[slot.date]) {
                acc[slot.date] = []
            }
            acc[slot.date].push(slot)
            return acc
        }, {} as Record<string, AvailableSlot[]>)

        const response = {
            success: true,
            data: {
                totalSlots: allSlots.length,
                dateRange: { startDate, endDate },
                slotsByDate,
                availableSlots: allSlots.slice(0, 50), // Limit for performance
                providers: providers.map(p => ({
                    id: p.id,
                    name: `${p.first_name} ${p.last_name}`,
                    title: p.title,
                    role: p.role
                })),
                message: `Found ${allSlots.length} available appointment slots from ${providers.length} providers`
            }
        }

        return NextResponse.json(response)

    } catch (error: any) {
        console.error('Error getting merged availability:', error)
        return NextResponse.json(
            { 
                error: 'Failed to get availability', 
                details: error.message,
                success: false 
            },
            { status: 500 }
        )
    }
}

// Helper function to get availability for a single provider
async function getProviderAvailability(
    providerId: string,
    startDate: string,
    endDate: string,
    appointmentDuration: number,
    supabase: any
): Promise<AvailableSlot[]> {
    try {
        // Get provider info
        const { data: provider, error: providerError } = await supabase
            .from('providers')
            .select('*')
            .eq('id', providerId)
            .single()

        if (providerError || !provider) {
            return []
        }

        // Get provider's weekly schedule
        const { data: weeklySchedule, error: scheduleError } = await supabase
            .from('provider_availability')
            .select('*')
            .eq('provider_id', providerId)
            .order('day_of_week')
            .order('start_time')

        if (scheduleError) {
            console.error('Error loading schedule:', scheduleError)
            return []
        }

        // Get exceptions for the date range
        const { data: exceptions, error: exceptionsError } = await supabase
            .from('availability_exceptions')
            .select('*')
            .eq('provider_id', providerId)
            .gte('exception_date', startDate.split('T')[0])
            .lte('exception_date', endDate.split('T')[0])

        if (exceptionsError) {
            console.error('Error loading exceptions:', exceptionsError)
        }

        // Get existing appointments
        const { data: appointments, error: appointmentsError } = await supabase
            .from('appointments')
            .select('appointment_date, appointment_time, duration_minutes')
            .eq('provider_id', providerId)
            .gte('appointment_date', startDate.split('T')[0])
            .lte('appointment_date', endDate.split('T')[0])

        if (appointmentsError) {
            console.error('Error loading appointments:', appointmentsError)
        }

        // Process weekly schedule into usable format
        const scheduleByDay: Record<number, Array<{start_time: string, end_time: string}>> = {}
        
        weeklySchedule?.forEach(block => {
            if (!scheduleByDay[block.day_of_week]) {
                scheduleByDay[block.day_of_week] = []
            }
            scheduleByDay[block.day_of_week].push({
                start_time: block.start_time,
                end_time: block.end_time
            })
        })

        // Generate available slots
        const availableSlots: AvailableSlot[] = []
        const currentDate = new Date(startDate)
        const endDateObj = new Date(endDate)

        while (currentDate <= endDateObj) {
            const dateStr = currentDate.toISOString().split('T')[0]
            const dayOfWeek = currentDate.getDay()

            // Check for exceptions on this date
            const exception = exceptions?.find(e => 
                e.exception_date === dateStr ||
                (e.end_date && dateStr >= e.exception_date && dateStr <= e.end_date)
            )

            if (exception) {
                if (exception.exception_type === 'unavailable' || exception.exception_type === 'vacation') {
                    // Skip this day entirely
                    currentDate.setDate(currentDate.getDate() + 1)
                    continue
                } else if (exception.exception_type === 'custom_hours' && exception.start_time && exception.end_time) {
                    // Use custom hours for this day
                    const slots = generateTimeSlots(
                        exception.start_time,
                        exception.end_time,
                        appointmentDuration,
                        15 // buffer minutes
                    )
                    
                    const availableDaySlots = filterBookedSlots(slots, appointments || [], dateStr)
                    
                    availableDaySlots.forEach(slot => {
                        availableSlots.push({
                            date: dateStr,
                            time: slot,
                            providerId: provider.id,
                            providerName: `${provider.first_name} ${provider.last_name}`,
                            duration: appointmentDuration,
                            isAvailable: true,
                            provider: {
                                id: provider.id,
                                first_name: provider.first_name,
                                last_name: provider.last_name,
                                title: provider.title || '',
                                role: provider.role || ''
                            }
                        })
                    })
                }
                // Handle partial_block type by continuing with regular schedule but filtering blocked time
            } else {
                // Use regular weekly schedule
                const daySchedule = scheduleByDay[dayOfWeek]
                
                if (daySchedule && daySchedule.length > 0) {
                    daySchedule.forEach(block => {
                        const slots = generateTimeSlots(
                            block.start_time,
                            block.end_time,
                            appointmentDuration,
                            15
                        )
                        
                        const availableDaySlots = filterBookedSlots(slots, appointments || [], dateStr)
                        
                        availableDaySlots.forEach(slot => {
                            availableSlots.push({
                                date: dateStr,
                                time: slot,
                                providerId: provider.id,
                                providerName: `${provider.first_name} ${provider.last_name}`,
                                duration: appointmentDuration,
                                isAvailable: true,
                                provider: {
                                    id: provider.id,
                                    first_name: provider.first_name,
                                    last_name: provider.last_name,
                                    title: provider.title || '',
                                    role: provider.role || ''
                                }
                            })
                        })
                    })
                }
            }

            currentDate.setDate(currentDate.getDate() + 1)
        }

        return availableSlots

    } catch (error) {
        console.error('Error getting provider availability:', error)
        return []
    }
}

// Helper function to generate time slots
function generateTimeSlots(
    startTime: string,
    endTime: string,
    duration: number,
    bufferMinutes: number
): string[] {
    const slots: string[] = []
    const [startHour, startMin] = startTime.split(':').map(Number)
    const [endHour, endMin] = endTime.split(':').map(Number)
    
    let currentHour = startHour
    let currentMin = startMin
    const totalDuration = duration + bufferMinutes
    
    while (
        currentHour < endHour ||
        (currentHour === endHour && currentMin < endMin)
    ) {
        slots.push(
            `${currentHour.toString().padStart(2, '0')}:${currentMin
                .toString()
                .padStart(2, '0')}`
        )
        
        currentMin += totalDuration
        if (currentMin >= 60) {
            currentHour += Math.floor(currentMin / 60)
            currentMin = currentMin % 60
        }
    }
    
    return slots
}

// Helper function to filter out booked slots
function filterBookedSlots(
    slots: string[],
    appointments: any[],
    date: string
): string[] {
    const bookedTimes = appointments
        .filter(a => a.appointment_date === date)
        .map(a => a.appointment_time)

    return slots.filter(slot => !bookedTimes.includes(slot))
}