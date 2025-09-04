// src/lib/services/coVisitService.ts
// NEW: Service for computing overlapping availability for co-visit requirements

import { supabaseAdmin } from '@/lib/supabase'

export interface AvailabilitySlot {
    start_time: string
    end_time: string
    provider_id: string
    provider_name?: string
}

export interface CoVisitSlot {
    start_time: string
    end_time: string
    resident_provider_id: string
    attending_provider_id: string
    resident_name: string
    attending_name: string
    duration_minutes: number
}

/**
 * Service for computing overlapping availability when supervision requires co-visits
 */
class CoVisitService {

    /**
     * Compute overlapping availability between resident and attending for co-visit requirements
     */
    async getCoVisitAvailability(
        residentProviderId: string,
        attendingProviderId: string,
        date: string,
        appointmentDuration: number = 60
    ): Promise<CoVisitSlot[]> {
        console.log('🔄 Computing co-visit availability:', {
            residentProviderId,
            attendingProviderId,
            date,
            appointmentDuration
        })

        try {
            // Get availability for both providers on the same date
            const [residentSlots, attendingSlots] = await Promise.all([
                this.getProviderAvailabilitySlots(residentProviderId, date, appointmentDuration),
                this.getProviderAvailabilitySlots(attendingProviderId, date, appointmentDuration)
            ])

            console.log('📊 Provider availability:', {
                resident: residentSlots.length,
                attending: attendingSlots.length
            })

            if (residentSlots.length === 0 || attendingSlots.length === 0) {
                console.log('⚠️ One or both providers have no availability')
                return []
            }

            // Compute overlapping slots
            const overlapSlots = this.computeOverlappingSlots(
                residentSlots,
                attendingSlots,
                appointmentDuration
            )

            console.log(`✅ Found ${overlapSlots.length} overlapping co-visit slots`)
            return overlapSlots

        } catch (error) {
            console.error('❌ Error computing co-visit availability:', error)
            throw error
        }
    }

    /**
     * Get availability slots for a single provider
     */
    private async getProviderAvailabilitySlots(
        providerId: string,
        date: string,
        appointmentDuration: number
    ): Promise<AvailabilitySlot[]> {
        // Get day of week for the target date
        const targetDate = new Date(date)
        const dayOfWeek = targetDate.getDay()

        // Get provider's recurring availability for this day of week
        const { data: availability, error } = await supabaseAdmin
            .from('provider_availability')
            .select(`
                start_time,
                end_time,
                provider_id,
                providers!inner (
                    first_name,
                    last_name
                )
            `)
            .eq('provider_id', providerId)
            .eq('day_of_week', dayOfWeek)
            .eq('is_recurring', true)

        if (error) {
            console.error(`❌ Error fetching availability for provider ${providerId}:`, error)
            return []
        }

        if (!availability || availability.length === 0) {
            return []
        }

        // Generate time slots from availability blocks
        const slots: AvailabilitySlot[] = []
        
        for (const avail of availability) {
            const providerName = `${avail.providers?.first_name} ${avail.providers?.last_name}`
            const blockSlots = this.generateTimeSlotsFromBlock(
                avail.start_time,
                avail.end_time,
                date,
                providerId,
                providerName,
                appointmentDuration
            )
            slots.push(...blockSlots)
        }

        // Check for exceptions that might block these slots
        const filteredSlots = await this.applyAvailabilityExceptions(slots, providerId, date)

        return filteredSlots
    }

    /**
     * Generate individual time slots from an availability block
     */
    private generateTimeSlotsFromBlock(
        startTime: string,
        endTime: string,
        date: string,
        providerId: string,
        providerName: string,
        appointmentDuration: number
    ): AvailabilitySlot[] {
        const slots: AvailabilitySlot[] = []
        
        try {
            const [startHour, startMin] = startTime.split(':').map(Number)
            const [endHour, endMin] = endTime.split(':').map(Number)
            
            const currentTime = new Date(date)
            currentTime.setHours(startHour, startMin, 0, 0)
            
            const endDateTime = new Date(date)
            endDateTime.setHours(endHour, endMin, 0, 0)
            
            while (currentTime < endDateTime) {
                const slotEndTime = new Date(currentTime.getTime() + appointmentDuration * 60 * 1000)
                
                if (slotEndTime <= endDateTime) {
                    slots.push({
                        start_time: currentTime.toISOString(),
                        end_time: slotEndTime.toISOString(),
                        provider_id: providerId,
                        provider_name: providerName
                    })
                }
                
                currentTime.setMinutes(currentTime.getMinutes() + appointmentDuration)
            }
        } catch (error) {
            console.error('❌ Error generating time slots:', error)
        }
        
        return slots
    }

    /**
     * Apply availability exceptions to filter out unavailable slots
     */
    private async applyAvailabilityExceptions(
        slots: AvailabilitySlot[],
        providerId: string,
        date: string
    ): Promise<AvailabilitySlot[]> {
        try {
            // Get exceptions for this provider and date
            const { data: exceptions, error } = await supabaseAdmin
                .from('provider_availability_exceptions')
                .select('*')
                .eq('provider_id', providerId)
                .eq('exception_date', date)

            if (error || !exceptions || exceptions.length === 0) {
                return slots // No exceptions, return all slots
            }

            // Filter out slots that conflict with exceptions
            return slots.filter(slot => {
                const slotStart = new Date(slot.start_time)
                const slotEnd = new Date(slot.end_time)

                return !exceptions.some(exception => {
                    if (exception.exception_type === 'unavailable') {
                        if (!exception.start_time && !exception.end_time) {
                            // Full day exception
                            return true
                        }
                        
                        if (exception.start_time && exception.end_time) {
                            // Time range exception
                            const exceptionStart = new Date(`${date}T${exception.start_time}`)
                            const exceptionEnd = new Date(`${date}T${exception.end_time}`)
                            
                            return slotStart < exceptionEnd && slotEnd > exceptionStart
                        }
                    }
                    return false
                })
            })
        } catch (error) {
            console.error('❌ Error applying availability exceptions:', error)
            return slots // Return original slots on error
        }
    }

    /**
     * Compute overlapping time slots between two providers
     */
    private computeOverlappingSlots(
        residentSlots: AvailabilitySlot[],
        attendingSlots: AvailabilitySlot[],
        appointmentDuration: number
    ): CoVisitSlot[] {
        const overlapSlots: CoVisitSlot[] = []

        for (const residentSlot of residentSlots) {
            for (const attendingSlot of attendingSlots) {
                const overlap = this.computeSlotOverlap(residentSlot, attendingSlot, appointmentDuration)
                if (overlap) {
                    overlapSlots.push(overlap)
                }
            }
        }

        // Sort by start time
        overlapSlots.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
        
        return overlapSlots
    }

    /**
     * Compute overlap between two individual slots
     */
    private computeSlotOverlap(
        residentSlot: AvailabilitySlot,
        attendingSlot: AvailabilitySlot,
        appointmentDuration: number
    ): CoVisitSlot | null {
        const residentStart = new Date(residentSlot.start_time)
        const residentEnd = new Date(residentSlot.end_time)
        const attendingStart = new Date(attendingSlot.start_time)
        const attendingEnd = new Date(attendingSlot.end_time)

        // Find overlap period
        const overlapStart = new Date(Math.max(residentStart.getTime(), attendingStart.getTime()))
        const overlapEnd = new Date(Math.min(residentEnd.getTime(), attendingEnd.getTime()))

        // Check if overlap is long enough for the appointment
        const overlapDurationMs = overlapEnd.getTime() - overlapStart.getTime()
        const requiredDurationMs = appointmentDuration * 60 * 1000

        if (overlapDurationMs >= requiredDurationMs) {
            // Create appointment-length slot starting at overlap start
            const appointmentEnd = new Date(overlapStart.getTime() + requiredDurationMs)

            return {
                start_time: overlapStart.toISOString(),
                end_time: appointmentEnd.toISOString(),
                resident_provider_id: residentSlot.provider_id,
                attending_provider_id: attendingSlot.provider_id,
                resident_name: residentSlot.provider_name || 'Resident',
                attending_name: attendingSlot.provider_name || 'Attending',
                duration_minutes: appointmentDuration
            }
        }

        return null
    }

    /**
     * Check if two time ranges overlap
     */
    private doTimesOverlap(
        start1: Date,
        end1: Date,
        start2: Date,
        end2: Date
    ): boolean {
        return start1 < end2 && end1 > start2
    }
}

export const coVisitService = new CoVisitService()