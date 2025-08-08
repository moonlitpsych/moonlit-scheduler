import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { providerAvailabilityService } from './providerAvailabilityService'

export interface AvailableSlot {
  date: string
  time: string
  providerId: string
  providerName: string
  duration: number
  isAvailable: boolean
}

class AvailabilityIntegrationService {
  private supabase = createClientComponentClient()

  /**
   * Get available slots for patient booking
   * This is the KEY METHOD that connects provider schedules to patient booking
   */
  async getAvailableSlotsForBooking(
    providerId: string,
    startDate: Date,
    endDate: Date,
    appointmentDuration: number = 60
  ): Promise<AvailableSlot[]> {
    const availableSlots: AvailableSlot[] = []

    // Get provider info
    const { data: provider } = await this.supabase
      .from('providers')
      .select('id, first_name, last_name')
      .eq('id', providerId)
      .single()

    if (!provider) return []

    // Get provider's weekly schedule
    const weeklySchedule = await providerAvailabilityService.getWeeklySchedule(providerId)
    
    // Get exceptions for the date range
    const exceptions = await providerAvailabilityService.getExceptions(
      providerId,
      startDate,
      endDate
    )

    // Get existing appointments to exclude booked slots
    const { data: appointments } = await this.supabase
      .from('appointments')
      .select('appointment_date, appointment_time, duration_minutes')
      .eq('provider_id', providerId)
      .gte('appointment_date', startDate.toISOString().split('T')[0])
      .lte('appointment_date', endDate.toISOString().split('T')[0])

    // Get booking settings
    const bookingSettings = await providerAvailabilityService.getBookingSettings(providerId)

    // Generate slots for each day in the range
    const currentDate = new Date(startDate)
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0]
      const dayOfWeek = currentDate.getDay()

      // Check if there's an exception for this date
      const exception = exceptions.find(e => e.exception_date === dateStr)

      if (exception) {
        if (exception.exception_type === 'unavailable') {
          // Provider is unavailable this day, skip
          currentDate.setDate(currentDate.getDate() + 1)
          continue
        } else if (exception.exception_type === 'custom_hours' && exception.start_time && exception.end_time) {
          // Use custom hours for this day
          const slots = this.generateTimeSlots(
            dateStr,
            exception.start_time,
            exception.end_time,
            appointmentDuration,
            bookingSettings.booking_buffer_minutes
          )
          
          // Filter out booked appointments
          const availableDaySlots = this.filterBookedSlots(
            slots,
            appointments || [],
            dateStr
          )

          availableDaySlots.forEach(slot => {
            availableSlots.push({
              date: dateStr,
              time: slot,
              providerId: provider.id,
              providerName: `Dr. ${provider.first_name} ${provider.last_name}`,
              duration: appointmentDuration,
              isAvailable: true
            })
          })
        }
      } else {
        // Use regular weekly schedule
        const daySchedule = weeklySchedule[dayOfWeek]
        
        if (daySchedule && daySchedule.is_available) {
          // Generate slots for each time block
          daySchedule.time_blocks.forEach(block => {
            const slots = this.generateTimeSlots(
              dateStr,
              block.start_time,
              block.end_time,
              appointmentDuration,
              bookingSettings.booking_buffer_minutes
            )

            // Filter out booked appointments
            const availableDaySlots = this.filterBookedSlots(
              slots,
              appointments || [],
              dateStr
            )

            availableDaySlots.forEach(slot => {
              availableSlots.push({
                date: dateStr,
                time: slot,
                providerId: provider.id,
                providerName: `Dr. ${provider.first_name} ${provider.last_name}`,
                duration: appointmentDuration,
                isAvailable: true
              })
            })
          })
        }
      }

      currentDate.setDate(currentDate.getDate() + 1)
    }

    // Apply max daily appointments limit
    const slotsByDate = this.groupSlotsByDate(availableSlots)
    const limitedSlots: AvailableSlot[] = []

    for (const [date, slots] of Object.entries(slotsByDate)) {
      const appointmentsOnDate = appointments?.filter(a => a.appointment_date === date).length || 0
      const remainingSlots = bookingSettings.max_daily_appointments - appointmentsOnDate
      
      if (remainingSlots > 0) {
        limitedSlots.push(...slots.slice(0, remainingSlots))
      }
    }

    return limitedSlots
  }

  /**
   * Get available providers for a specific payer and date
   */
  async getAvailableProviders(
    payerId: string,
    date: Date,
    appointmentDuration: number = 60
  ): Promise<Array<{ provider: any; slots: AvailableSlot[] }>> {
    // Get all providers credentialed with this payer
    const { data: providers } = await this.supabase
      .from('providers')
      .select('*')
      .eq('availability', true)

    if (!providers) return []

    const results = []
    
    for (const provider of providers) {
      const slots = await this.getAvailableSlotsForBooking(
        provider.id,
        date,
        date,
        appointmentDuration
      )

      if (slots.length > 0) {
        results.push({ provider, slots })
      }
    }

    return results
  }

  /**
   * Create an appointment and update availability
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
  }) {
    try {
      // Create the appointment
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

      // Update provider's daily appointment count (if you have a cache table)
      // This could trigger a real-time update to the booking widget

      return { appointment, error: null }
    } catch (error: any) {
      console.error('Error creating appointment:', error)
      return { appointment: null, error: error.message }
    }
  }

  // Helper Methods

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

  private groupSlotsByDate(slots: AvailableSlot[]): Record<string, AvailableSlot[]> {
    return slots.reduce((acc, slot) => {
      if (!acc[slot.date]) {
        acc[slot.date] = []
      }
      acc[slot.date].push(slot)
      return acc
    }, {} as Record<string, AvailableSlot[]>)
  }
}

export const availabilityIntegrationService = new AvailabilityIntegrationService()