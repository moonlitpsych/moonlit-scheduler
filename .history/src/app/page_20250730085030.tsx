// src/app/page.tsx
import BookingFlow from '@/components/booking/BookingFlow'

export default function HomePage() {
  return <BookingFlow />
}

// src/app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Book with Moonlit Psychiatry',
  description: 'Schedule your appointment with Moonlit Psychiatry - HIPAA-compliant online booking',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}

// src/services/payerService.ts
import { supabase } from '@/lib/supabase'
import { Payer } from '@/types/database'

export class PayerService {
  /**
   * Search for payers by name with fuzzy matching
   */
  static async searchPayers(query: string): Promise<Payer[]> {
    try {
      const { data, error } = await supabase
        .from('payers')
        .select('*')
        .ilike('name', `%${query}%`)
        .order('name')
        .limit(10)

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error searching payers:', error)
      return []
    }
  }

  /**
   * Check payer acceptance status based on effective dates
   */
  static checkAcceptanceStatus(payer: Payer): {
    status: 'not-accepted' | 'future' | 'active'
    effectiveDate?: Date
    daysUntilActive?: number
  } {
    const now = new Date()
    const effectiveDate = payer.effective_date ? new Date(payer.effective_date) : null
    const projectedDate = payer.projected_effective_date ? new Date(payer.projected_effective_date) : null

    // Not accepted if no dates at all
    if (!effectiveDate && !projectedDate) {
      return { status: 'not-accepted' }
    }

    // Active if effective date is in the past
    if (effectiveDate && effectiveDate <= now) {
      return { status: 'active', effectiveDate }
    }

    // Future if effective date is more than 30 days away
    if (effectiveDate) {
      const daysUntilActive = Math.ceil((effectiveDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      return {
        status: daysUntilActive > 30 ? 'not-accepted' : 'future',
        effectiveDate,
        daysUntilActive
      }
    }

    // Use projected date if no effective date
    if (projectedDate) {
      const daysUntilActive = Math.ceil((projectedDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      return {
        status: daysUntilActive > 30 ? 'not-accepted' : 'future',
        effectiveDate: projectedDate,
        daysUntilActive
      }
    }

    return { status: 'not-accepted' }
  }

  /**
   * Get payers that require attending physician supervision
   */
  static async getPayersRequiringAttending(): Promise<Payer[]> {
    try {
      const { data, error } = await supabase
        .from('payers')
        .select('*')
        .eq('requires_attending', true)

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching payers requiring attending:', error)
      return []
    }
  }
}

// src/services/providerService.ts
import { supabase } from '@/lib/supabase'
import { Provider } from '@/types/database'

export class ProviderService {
  /**
   * Get available providers based on booking criteria
   */
  static async getAvailableProviders(criteria: {
    acceptsNewPatients?: boolean
    telehealthEnabled?: boolean
    languageSpoken?: string
    payerId?: string
  }): Promise<Provider[]> {
    try {
      let query = supabase
        .from('providers')
        .select(`
          id, first_name, last_name, title, profile_image_url,
          languages_spoken, telehealth_enabled, accepts_new_patients,
          booking_buffer_minutes, max_daily_appointments
        `)

      if (criteria.acceptsNewPatients !== undefined) {
        query = query.eq('accepts_new_patients', criteria.acceptsNewPatients)
      }

      if (criteria.telehealthEnabled !== undefined) {
        query = query.eq('telehealth_enabled', criteria.telehealthEnabled)
      }

      if (criteria.languageSpoken) {
        query = query.contains('languages_spoken', [criteria.languageSpoken])
      }

      // TODO: Add payer-provider relationship filtering based on criteria.payerId

      const { data, error } = await query

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching available providers:', error)
      return []
    }
  }

  /**
   * Get provider by ID with full details
   */
  static async getProviderById(id: string): Promise<Provider | null> {
    try {
      const { data, error } = await supabase
        .from('providers')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error fetching provider:', error)
      return null
    }
  }
}

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

// src/services/bookingService.ts
import { supabase } from '@/lib/supabase'
import { PatientInfo, InsuranceInfo, ROIContact, TimeSlot } from '@/types/database'

export class BookingService {
  /**
   * Create a new appointment booking
   */
  static async createAppointment(appointmentData: {
    providerId: string
    renderingProviderId?: string
    serviceInstanceId: string
    payerId?: string
    timeSlot: TimeSlot
    patientInfo: PatientInfo
    insuranceInfo?: InsuranceInfo
    roiContacts?: ROIContact[]
  }): Promise<{ appointmentId: string } | null> {
    try {
      const appointment = {
        provider_id: appointmentData.providerId,
        rendering_provider_id: appointmentData.renderingProviderId,
        service_instance_id: appointmentData.serviceInstanceId,
        payer_id: appointmentData.payerId,
        start_time: appointmentData.timeSlot.start_time,
        end_time: appointmentData.timeSlot.end_time,
        timezone: 'America/Denver', // Default to Denver timezone
        patient_info: appointmentData.patientInfo,
        insurance_info: appointmentData.insuranceInfo,
        roi_contacts: appointmentData.roiContacts,
        appointment_type: 'telehealth',
        status: 'scheduled',
        booking_source: 'widget'
      }

      const { data, error } = await supabase
        .from('appointments')
        .insert([appointment])
        .select('id')
        .single()

      if (error) throw error

      // TODO: Trigger email notifications
      // TODO: Sync with Athena Health

      return { appointmentId: data.id }
    } catch (error) {
      console.error('Error creating appointment:', error)
      return null
    }
  }

  /**
   * Create a booking lead for unaccepted insurance
   */
  static async createBookingLead(leadData: {
    email: string
    phone?: string
    preferredName?: string
    requestedPayerId?: string
    insuranceEffectiveDate?: Date
    reason?: string
  }): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('booking_leads')
        .insert([{
          email: leadData.email,
          phone: leadData.phone,
          preferred_name: leadData.preferredName,
          requested_payer_id: leadData.requestedPayerId,
          insurance_effective_date: leadData.insuranceEffectiveDate?.toISOString().split('T')[0],
          reason: leadData.reason,
          status: 'pending'
        }])

      if (error) throw error

      // TODO: Trigger staff notification email

      return true
    } catch (error) {
      console.error('Error creating booking lead:', error)
      return false
    }
  }
}