// src/app/api/availability/test/route.ts

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
}

interface WeeklySchedule {
    [dayOfWeek: number]: {
        is_available: boolean
        time_blocks: Array<{
            start_time: string
            end_time: string
        }>
    }
}

interface ScheduleException {
    id: string
    exception_date: string
    end_date?: string
    exception_type: 'unavailable' | 'custom_hours' | 'partial_block' | 'vacation' | 'recurring_change'
    start_time?: string
    end_time?: string
    note?: string
}

export async function POST(request: NextRequest) {
    try {
        const supabase = createRouteHandlerClient({ cookies })
        const { providerId, startDate, endDate, appointmentDuration = 60 } = await request.json()

        if (!providerId) {
            return NextResponse.json(
                { error: 'Provider ID is required' },
                { status: 400 }
            )
        }

        console.log(`Testing availability integration for provider ${providerId}`)

        // 1. Get provider information
        const { data: provider, error: providerError } = await supabase
            .from('providers')
            .select('id, first_name, last_name, availability, telehealth_enabled, accepts_new_patients')
            .eq('id', providerId)
            .single()

        if (providerError || !provider) {
            return NextResponse.json(
                { error: 'Provider not found', details: providerError },
                { status: 404 }
            )
        }

        // 2. Get provider's weekly schedule
        const { data: weeklyAvailability, error: scheduleError } = await supabase
            .from('provider_availability')
            .select('day_of_week, start_time, end_time, is_recurring')
            .eq('provider_id', providerId)
            .order('day_of_week')
            .order('start_time')

        if (scheduleError) {
            return NextResponse.json(
                { error: 'Failed to load provider schedule', details: scheduleError },
                { status: 500 }
            )
        }

        // 3. Get exceptions for the date range
        const { data: exceptions, error: exceptionsError } = await supabase
            .from('availability_exceptions')
            .select('*')
            .eq('provider_id', providerId)
            .gte('exception_date', new Date(startDate).toISOString().split('T')[0])
            .lte('exception_date', new Date(endDate).toISOString().split('T')[0])

        if (exceptionsError) {
            console.warn('Failed to load exceptions:', exceptionsError)
        }

        // 4. Get existing appointments to exclude booked slots
        const { data: appointments, error: appointmentsError } = await supabase
            .from('appointments')
            .select('appointment_date, appointment_time, duration_minutes')
            .eq('provider_id', providerId)
            .gte('appointment_date', new Date(startDate).toISOString().split('T')[0])
            .lte('appointment_date', new Date(endDate).toISOString().split('T')[0])

        if (appointmentsError) {
            console.warn('Failed to load appointments:', appointmentsError)
        }

        // 5. Process weekly schedule into usable format
        const weeklySchedule: WeeklySchedule = {}
        
        for (let day = 0; day < 7; day++) {
            const dayBlocks = (weeklyAvailability || []).filter(block => block.day_of_week === day)
            weeklySchedule[day] = {
                is_available: dayBlocks.length > 0,
                time_blocks: dayBlocks.map(block => ({
                    start_time: block.start_time,
                    end_time: block.end_time
                }))
            }
        }

        // 6. Generate available slots
        const availableSlots: AvailableSlot[] = []
        const currentDate = new Date(startDate)
        const endDateObj = new Date(endDate)

        while (currentDate <= endDateObj) {
            const dateStr = currentDate.toISOString().split('T')[0]
            const dayOfWeek = currentDate.getDay()

            // Check for exceptions on this date
            const exception = (exceptions || []).find(e => e.exception_date === dateStr)

            if (exception) {
                if (exception.exception_type === 'unavailable' || exception.exception_type === 'vacation') {
                    // Skip this day entirely
                    currentDate.setDate(currentDate.getDate() + 1)
                    continue
                } else if (exception.exception_type === 'custom_hours' && exception.start_time && exception.end_time) {
                    // Use custom hours for this day
                    const slots = generateTimeSlots(
                        dateStr,
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
                            isAvailable: true
                        })
                    })
                } else if (exception.exception_type === 'partial_block') {
                    // Use regular schedule but exclude the blocked time
                    const daySchedule = weeklySchedule[dayOfWeek]
                    if (daySchedule && daySchedule.is_available) {
                        daySchedule.time_blocks.forEach(block => {
                            const slots = generateTimeSlots(
                                dateStr,
                                block.start_time,
                                block.end_time,
                                appointmentDuration,
                                15
                            )
                            
                            // Filter out the blocked time
                            const unblockedSlots = slots.filter(slot => {
                                if (!exception.start_time || !exception.end_time) return true
                                return slot < exception.start_time || slot >= exception.end_time
                            })
                            
                            const availableDaySlots = filterBookedSlots(unblockedSlots, appointments || [], dateStr)
                            
                            availableDaySlots.forEach(slot => {
                                availableSlots.push({
                                    date: dateStr,
                                    time: slot,
                                    providerId: provider.id,
                                    providerName: `${provider.first_name} ${provider.last_name}`,
                                    duration: appointmentDuration,
                                    isAvailable: true
                                })
                            })
                        })
                    }
                }
            } else {
                // Use regular weekly schedule
                const daySchedule = weeklySchedule[dayOfWeek]
                
                if (daySchedule && daySchedule.is_available) {
                    daySchedule.time_blocks.forEach(block => {
                        const slots = generateTimeSlots(
                            dateStr,
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
                                isAvailable: true
                            })
                        })
                    })
                }
            }

            currentDate.setDate(currentDate.getDate() + 1)
        }

        // 7. Return comprehensive test results
        const response = {
            success: true,
            providerId,
            providerName: `${provider.first_name} ${provider.last_name}`,
            testResults: {
                slotsCount: availableSlots.length,
                dateRange: {
                    start: startDate,
                    end: endDate
                },
                weeklySchedule,
                exceptionsCount: (exceptions || []).length,
                appointmentsCount: (appointments || []).length,
                sampleSlots: availableSlots.slice(0, 10), // First 10 slots as sample
                integrationStatus: {
                    scheduleLoaded: !scheduleError,
                    exceptionsLoaded: !exceptionsError,
                    appointmentsLoaded: !appointmentsError,
                    slotsGenerated: availableSlots.length > 0
                }
            },
            message: `Successfully generated ${availableSlots.length} available slots for ${provider.first_name} ${provider.last_name}`
        }

        console.log('Availability test completed:', response.testResults)

        return NextResponse.json(response)

    } catch (error) {
        console.error('Availability test error:', error)
        return NextResponse.json(
            { 
                error: 'Internal server error', 
                details: error instanceof Error ? error.message : 'Unknown error',
                success: false
            },
            { status: 500 }
        )
    }
}

// Helper function to generate time slots
function generateTimeSlots(
    date: string,
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