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