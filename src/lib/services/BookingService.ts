// src/lib/services/BookingService.ts
import { supabase as supabaseClient } from '@/lib/supabase'
import { InsuranceInfo, PatientInfo, ROIContact } from '@/types/database'
import { payerService, PayerWithStatus } from './PayerService'
import { AppointmentProviders, providerService, ProviderWithAvailability } from './ProviderService'

export interface BookingDetails {
  payer: PayerWithStatus
  appointmentProviders: AppointmentProviders
  selectedProvider: ProviderWithAvailability
  patientInfo: PatientInfo
  insuranceInfo: InsuranceInfo
  roiContacts: ROIContact[]
  timeSlot: {
    start_time: string
    end_time: string
    provider_id: string
  }
}

export interface CreatedAppointment {
  id: string
  confirmation_code: string
  appointment_details: BookingDetails
}

export class BookingService {
  private supabase = supabaseClient

  /**
   * Get available providers for a specific payer using Moonlit's business logic
   */
  async getAvailableProvidersForPayer(payer: PayerWithStatus): Promise<ProviderWithAvailability[]> {
    try {
      console.log(`Getting providers for payer: ${payer.name}`)
      console.log(`Requires attending: ${payer.requires_attending}`)
      
      const providers = await providerService.getAvailableProviders(payer)
      
      if (payer.requires_attending) {
        console.log(`Found ${providers.length} residents available for supervised care`)
      } else {
        console.log(`Found ${providers.length} credentialed providers for independent care`)
      }
      
      return providers
    } catch (error) {
      console.error('BookingService.getAvailableProvidersForPayer error:', error)
      return []
    }
  }

  /**
   * Create appointment with proper provider assignment based on payer requirements
   */
  async createAppointment(bookingDetails: BookingDetails): Promise<CreatedAppointment | null> {
    try {
      const { payer, appointmentProviders, selectedProvider, patientInfo, insuranceInfo, roiContacts, timeSlot } = bookingDetails

      // Prepare appointment data based on supervision requirements
      const appointmentData = {
        // Provider assignment based on requires_attending logic
        provider_id: appointmentProviders.billingProvider?.id || selectedProvider.id,
        rendering_provider_id: appointmentProviders.isSupervised ? selectedProvider.id : null,
        
        // Appointment details
        appointment_date: timeSlot.start_time.split('T')[0],
        start_time: timeSlot.start_time,
        end_time: timeSlot.end_time,
        appointment_type: 'initial_consultation', // or whatever default you use
        status: 'scheduled',
        
        // Patient information
        patient_first_name: patientInfo.first_name,
        patient_last_name: patientInfo.last_name,
        patient_email: patientInfo.email,
        patient_phone: patientInfo.phone,
        patient_date_of_birth: patientInfo.date_of_birth,
        patient_preferred_name: patientInfo.preferred_name,
        
        // Insurance information
        payer_id: payer.id === 'cash' ? null : payer.id,
        insurance_info: payer.id === 'cash' ? null : {
          payer_name: payer.name,
          member_id: insuranceInfo.member_id,
          group_number: insuranceInfo.group_number,
          effective_date: insuranceInfo.effective_date
        },
        
        // ROI contacts
        roi_contacts: roiContacts.length > 0 ? roiContacts : null,
        
        // Billing metadata for Athena
        requires_supervision: appointmentProviders.isSupervised,
        billing_provider_npi: appointmentProviders.billingProvider?.npi || selectedProvider.npi,
        rendering_provider_npi: selectedProvider.npi,
        
        // Athena integration fields (for future)
        athena_appointment_id: null,
        athena_sync_status: 'pending',
        
        // Creation metadata
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      console.log('Creating appointment with data:', {
        supervision: appointmentProviders.isSupervised,
        billing_provider: appointmentProviders.billingProvider?.first_name + ' ' + appointmentProviders.billingProvider?.last_name,
        rendering_provider: selectedProvider.first_name + ' ' + selectedProvider.last_name,
        payer: payer.name
      })

      // Insert appointment into Supabase
      const { data: appointment, error } = await this.supabase
        .from('appointments')
        .insert(appointmentData)
        .select()
        .single()

      if (error) {
        console.error('Error creating appointment:', error)
        return null
      }

      // Generate confirmation code
      const confirmationCode = this.generateConfirmationCode()

      // Update appointment with confirmation code
      const { error: updateError } = await this.supabase
        .from('appointments')
        .update({ confirmation_code: confirmationCode })
        .eq('id', appointment.id)

      if (updateError) {
        console.error('Error updating confirmation code:', updateError)
      }

      return {
        id: appointment.id,
        confirmation_code: confirmationCode,
        appointment_details: bookingDetails
      }

    } catch (error) {
      console.error('BookingService.createAppointment error:', error)
      return null
    }
  }

  /**
   * Create booking lead for non-accepted payers
   */
  async createBookingLead(
    payer: PayerWithStatus,
    patientInfo: PatientInfo,
    reason?: string
  ): Promise<boolean> {
    try {
      const leadData = {
        email: patientInfo.email,
        phone: patientInfo.phone,
        preferred_name: patientInfo.preferred_name || `${patientInfo.first_name} ${patientInfo.last_name}`,
        requested_payer_name: payer.name,
        requested_payer_id: payer.id,
        reason: reason || `Requested appointment with ${payer.name}`,
        status: 'new',
        created_at: new Date().toISOString()
      }

      const { error } = await this.supabase
        .from('booking_leads')
        .insert(leadData)

      if (error) {
        console.error('Error creating booking lead:', error)
        return false
      }

      console.log(`Created booking lead for ${patientInfo.email} requesting ${payer.name}`)
      return true

    } catch (error) {
      console.error('BookingService.createBookingLead error:', error)
      return false
    }
  }

  /**
   * Validate payer acceptance status
   */
  async validatePayerAcceptance(payerId: string): Promise<PayerWithStatus | null> {
    try {
      return await payerService.getPayerById(payerId)
    } catch (error) {
      console.error('BookingService.validatePayerAcceptance error:', error)
      return null
    }
  }

  /**
   * Get appointment summary for confirmation
   */
  async getAppointmentSummary(appointmentId: string) {
    try {
      const { data: appointment, error } = await this.supabase
        .from('appointments')
        .select(`
          *,
          providers!appointments_provider_id_fkey(*),
          rendering_provider:providers!appointments_rendering_provider_id_fkey(*)
        `)
        .eq('id', appointmentId)
        .single()

      if (error) {
        console.error('Error getting appointment summary:', error)
        return null
      }

      return appointment
    } catch (error) {
      console.error('BookingService.getAppointmentSummary error:', error)
      return null
    }
  }

  /**
   * Generate unique confirmation code
   */
  private generateConfirmationCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let result = ''
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  /**
   * Send confirmation email (placeholder for email service integration)
   */
  async sendConfirmationEmail(appointment: CreatedAppointment): Promise<boolean> {
    try {
      // TODO: Integrate with SendGrid/Resend for actual email sending
      console.log('Would send confirmation email for appointment:', appointment.confirmation_code)
      return true
    } catch (error) {
      console.error('BookingService.sendConfirmationEmail error:', error)
      return false
    }
  }

  /**
   * Log booking analytics event
   */
  async logBookingEvent(
    event: 'payer_selected' | 'provider_selected' | 'appointment_created' | 'lead_created',
    metadata: Record<string, any>
  ): Promise<void> {
    try {
      // TODO: Integrate with analytics service
      console.log(`Booking event: ${event}`, metadata)
    } catch (error) {
      console.error('BookingService.logBookingEvent error:', error)
    }
  }
}

// Export singleton instance
export const bookingService = new BookingService()