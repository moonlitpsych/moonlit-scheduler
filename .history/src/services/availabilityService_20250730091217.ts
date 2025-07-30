// src/services/availabilityService.ts
import { supabase } from '@/lib/supabase'
import { TimeSlot } from '@/types/database'
import { format, addDays, startOfDay } from 'date-fns'

export class AvailabilityService {
    /**
     * Get cached availability for providers on a specific date
     */
    static async getCachedAvailability(
        providerIds: string[],
        date: Date,
        serviceInstanceId?: string
    ): Promise<TimeSlot[]> {
        try {
            const dateString = format(date, 'yyyy-MM-dd')

            let query = supabase
                .from('provider_availability_cache')
                .select('provider_id, available_slots')
                .in('provider_id', providerIds)
                .eq('date', dateString)

            if (serviceInstanceId) {
                query = query.eq('service_instance_id', serviceInstanceId)
            }

            const { data, error } = await query

            if (error) throw error

            // Flatten and format the cached slots
            const allSlots: TimeSlot[] = []
            data?.forEach(cache => {
                const slots = cache.available_slots as any[]
                slots?.forEach(slot => {
                    allSlots.push({
                        start_time: slot.start_time,
                        end_time: slot.end_time,
                        provider_id: cache.provider_id,
                        available: slot.available
                    })
                })
            })

            return allSlots.filter(slot => slot.available)
        } catch (error) {
            console.error('Error fetching cached availability:', error)
            return []
        }
    }

    /**
     * Get merged availability across multiple providers for a date range
     */
    static async getMergedAvailability(
        providerIds: string[],
        startDate: Date,
        endDate: Date = addDays(startDate, 30)
    ): Promise<Map<string, TimeSlot[]>> {
        try {
            const availabilityMap = new Map<string, TimeSlot[]>()

            // Get availability for each day in the range
            let currentDate = startOfDay(startDate)
            while (currentDate <= endDate) {
                const dateKey = format(currentDate, 'yyyy-MM-dd')
                const daySlots = await this.getCachedAvailability(providerIds, currentDate)
                availabilityMap.set(dateKey, daySlots)
                currentDate = addDays(currentDate, 1)
            }

            return availabilityMap
        } catch (error) {
            console.error('Error fetching merged availability:', error)
            return new Map()
        }
    }

    /**
     * Check if a specific time slot is still available
     */
    static async isSlotAvailable(
        providerId: string,
        startTime: string,
        endTime: string
    ): Promise<boolean> {
        try {
            // Check for conflicting appointments
            const { data, error } = await supabase
                .from('appointments')
                .select('id')
                .eq('provider_id', providerId)
                .neq('status', 'cancelled')
                .or(`start_time.lt.${endTime},end_time.gt.${startTime}`)

            if (error) throw error
            return !data || data.length === 0
        } catch (error) {
            console.error('Error checking slot availability:', error)
            return false
        }
    }
}