// src/services/patientBookingAvailabilityService.ts

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

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
        accepts_new_patients: boolean
        telehealth_enabled: boolean
    }
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

interface PayerInfo {
    id: string
    name: string
    effective_date?: string
    requires_attending?: boolean
}

class PatientBookingAvailabilityService {
    private supabase = createClientComponentClient()

    /**
     * Get merged availability for all providers who accept a specific payer
     * This implements User Story #2: "Merged availability (all resident schedules pooled)"
     */
    async getMergedAvailabilityForPayer(
        payerId: string,
        startDate: Date,
        endDate: Date,
        appointmentDuration: number = 60
    ): Promise<AvailableSlot[]> {
        try {
            console.log(`Getting merged availability for payer ${payerId}`)

            // Get all providers who accept this payer
            const credentialedProviders = await this.getProvidersForPayer(payerId)
            console.log(`Found ${credentialedProviders.length} credentialed providers`)

            if (credentialedProviders.length === 0) {
                return []
            }

            // Get availability for all credentialed providers
            const allSlots: AvailableSlot[] = []
            
            for (const provider of credentialedProviders) {
                const providerSlots = await this.getAvailabilityForProvider(
                    provider.id,
                    startDate,
                    endDate,
                    appointmentDuration
                )
                allSlots.push(...providerSlots)
            }

            // Sort by date and time for optimal patient experience
            return allSlots.sort((a, b) => {
                const dateTimeA = new Date(`${a.date} ${a.time}`).getTime()
                const dateTimeB = new Date(`${b.date} ${b.time}`).getTime()
                return dateTimeA - dateTimeB
            })

        } catch (error) {
            console.error('Error getting merged availability:', error)
            return []
        }
    }

    /**
     * Get availability for a specific provider
     * This implements User Story #22: Individual provider calendar view
     */
    async getAvailabilityForProvider(
        providerId: string,
        startDate: Date,
        endDate: Date,
        appointmentDuration: number = 60
    ): Promise<AvailableSlot[]> {
        try {
            console.log(`Getting availability for provider ${providerId}`)

            // Get provider information
            const { data: provider, error: providerError } = await this.supabase
                .from('providers')
                .select('*')
                .eq('id', providerId)
                .single()

            if (providerError || !provider) {
                console.error('Provider not found:', providerError)
                return []
            }

            // Get provider's weekly schedule
            const weeklySchedule = await this.getProviderWeeklySchedule(providerId)
            
            // Get exceptions for the date range
            const exceptions = await this.getProviderExceptions(providerId, startDate, endDate)
            
            // Get existing appointments to exclude booked slots
            const existingAppointments = await this.getProviderAppointments(providerId, startDate, endDate)

            // Generate available slots
            const availableSlots: AvailableSlot[] = []
            const currentDate = new Date(startDate)

            while (currentDate <= endDate) {
                const dateStr = currentDate.toISOString().split('T')[0]
                const dayOfWeek = currentDate.getDay()

                // Check for exceptions on this date
                const exception = exceptions.find(e => 
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
                        const slots = this.generateTimeSlots(
                            dateStr,
                            exception.start_time,
                            exception.end_time,
                            appointmentDuration,
                            15 // buffer minutes
                        )
                        
                        const availableDaySlots = this.filterBookedSlots(slots, existingAppointments, dateStr)
                        
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
                                    role: provider.role || '',
                                    accepts_new_patients: provider.accepts_new_patients || true,
                                    telehealth_enabled: provider.telehealth_enabled || true
                                }
                            })
                        })
                    } else if (exception.exception_type === 'partial_block') {
                        // Use regular schedule but exclude blocked time
                        const daySchedule = weeklySchedule[dayOfWeek]
                        if (daySchedule?.is_available) {
                            daySchedule.time_blocks.forEach(block => {
                                const slots = this.generateTimeSlots(
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
                                
                                const availableDaySlots = this.filterBookedSlots(unblockedSlots, existingAppointments, dateStr)
                                
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
                                            role: provider.role || '',
                                            accepts_new_patients: provider.accepts_new_patients || true,
                                            telehealth_enabled: provider.telehealth_enabled || true
                                        }
                                    })
                                })
                            })
                        }
                    }
                } else {
                    // Use regular weekly schedule
                    const daySchedule = weeklySchedule[dayOfWeek]
                    
                    if (daySchedule?.is_available) {
                        daySchedule.time_blocks.forEach(block => {
                            const slots = this.generateTimeSlots(
                                dateStr,
                                block.start_time,
                                block.end_time,
                                appointmentDuration,
                                15
                            )
                            
                            const availableDaySlots = this.filterBookedSlots(slots, existingAppointments, dateStr)
                            
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
                                        role: provider.role || '',
                                        accepts_new_patients: provider.accepts_new_patients || true,
                                        telehealth_enabled: provider.telehealth_enabled || true
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

    /**
     * Get all providers who accept a specific payer
     * This implements insurance acceptance filtering from User Story #1
     */
    private async getProvidersForPayer(payerId: string): Promise<any[]> {
        try {
            // First, get the payer information
            const { data: payer, error: payerError } = await this.supabase
                .from('payers')
                .select('*')
                .eq('id', payerId)
                .single()

            if (payerError || !payer) {
                console.error('Payer not found:', payerError)
                return []
            }

            // Check if we have a provider-payer relationship table
            const { data: relationships, error: relationshipError } = await this.supabase
                .from('provider_payer_relationships')
                .select(`
                    provider_id,
                    status,
                    providers (*)
                `)
                .eq('payer_id', payerId)
                .eq('status', 'active')

            if (relationshipError) {
                console.log('No provider_payer_relationships table, falling back to all providers')
                
                // Fallback: Get all providers who are available and accepting new patients
                const { data: allProviders, error: allProvidersError } = await this.supabase
                    .from('providers')
                    .select('*')
                    .eq('availability', true)

                if (allProvidersError) {
                    console.error('Error getting providers:', allProvidersError)
                    return []
                }

                return allProviders || []
            }

            // Return providers from relationships
            return relationships?.map(rel => rel.providers).filter(Boolean) || []

        } catch (error) {
            console.error('Error getting providers for payer:', error)
            return []
        }
    }

    /**
     * Get a provider's weekly schedule
     */
    private async getProviderWeeklySchedule(providerId: string): Promise<WeeklySchedule> {
        try {
            const { data: availability, error } = await this.supabase
                .from('provider_availability')
                .select('*')
                .eq('provider_id', providerId)
                .order('day_of_week')
                .order('start_time')

            if (error) {
                console.error('Error loading provider schedule:', error)
                return {}
            }

            const weeklySchedule: WeeklySchedule = {}
            
            // Initialize all days as unavailable
            for (let day = 0; day < 7; day++) {
                weeklySchedule[day] = {
                    is_available: false,
                    time_blocks: []
                }
            }

            // Add availability blocks
            availability?.forEach(block => {
                if (!weeklySchedule[block.day_of_week]) {
                    weeklySchedule[block.day_of_week] = {
                        is_available: false,
                        time_blocks: []
                    }
                }
                
                weeklySchedule[block.day_of_week].is_available = true
                weeklySchedule[block.day_of_week].time_blocks.push({
                    start_time: block.start_time,
                    end_time: block.end_time
                })
            })

            return weeklySchedule

        } catch (error) {
            console.error('Error getting weekly schedule:', error)
            return {}
        }
    }

    /**
     * Get provider exceptions for a date range
     */
    private async getProviderExceptions(
        providerId: string,
        startDate: Date,
        endDate: Date
    ): Promise<ScheduleException[]> {
        try {
            const { data: exceptions, error } = await this.supabase
                .from('availability_exceptions')
                .select('*')
                .eq('provider_id', providerId)
                .gte('exception_date', startDate.toISOString().split('T')[0])
                .lte('exception_date', endDate.toISOString().split('T')[0])

            if (error) {
                console.error('Error loading exceptions:', error)
                return []
            }

            return exceptions || []

        } catch (error) {
            console.error('Error getting provider exceptions:', error)
            return []
        }
    }

    /**
     * Get existing appointments for a provider in a date range
     */
    private async getProviderAppointments(
        providerId: string,
        startDate: Date,
        endDate: Date
    ): Promise<any[]> {
        try {
            const { data: appointments, error } = await this.supabase
                .from('appointments')
                .select('appointment_date, appointment_time, duration_minutes')
                .eq('provider_id', providerId)
                .gte('appointment_date', startDate.toISOString().split('T')[0])
                .lte('appointment_date', endDate.toISOString().split('T')[0])

            if (error) {
                console.error('Error loading appointments:', error)
                return []
            }

            return appointments || []

        } catch (error) {
            console.error('Error getting provider appointments:', error)
            return []
        }
    }

    /**
     * Generate time slots for a day
     */
    private generateTimeSlots(
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

    /**
     * Filter out already booked time slots
     */
    private filterBookedSlots(
        slots: string[],
        appointments: any[],
        date: string
    ): string[] {
        const bookedTimes = appointments
            .filter(a => a.appointment_date === date)
            .map(a => a.appointment_time)

        return slots.filter(slot => !bookedTimes.includes(slot))
    }

    /**
     * Create a new appointment and block the time slot
     */
    async createAppointment(appointmentData: {
        provider_id: string
        patient_name: string
        patient_email: string
        patient_phone?: string
        appointment_date: string
        appointment_time: string
        duration_minutes: number
        appointment_type: string
        insurance_info?: any
        case_manager_info?: any
        booking_scenario?: string
    }) {
        try {
            const { data: appointment, error } = await this.supabase
                .from('appointments')
                .insert({
                    ...appointmentData,
                    status: 'scheduled',
                    created_at: new Date().toISOString()
                })
                .select()
                .single()

            if (error) throw error

            console.log('Appointment created successfully:', appointment)
            return { appointment, error: null }

        } catch (error: any) {
            console.error('Error creating appointment:', error)
            return { appointment: null, error: error.message }
        }
    }
}

export const patientBookingAvailabilityService = new PatientBookingAvailabilityService()