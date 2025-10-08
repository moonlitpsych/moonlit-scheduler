// Server-only endpoint to retry PracticeQ appointment creation for failed bookings
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createAppointment } from '@/lib/intakeq/client'
import { getIntakeqPractitionerId } from '@/lib/integrations/providerMap'
import { getIntakeqServiceId } from '@/lib/integrations/serviceInstanceMap'
import { ensureClient } from '@/lib/intakeq/client'

interface RetryRequest {
    appointmentId: string
}

interface RetryResponse {
    success: boolean
    data?: {
        appointmentId: string
        pqAppointmentId: string
        status: string
    }
    error?: string
    code?: string
}

export async function POST(request: NextRequest): Promise<NextResponse<RetryResponse>> {
    try {
        const body = await request.json() as RetryRequest
        const { appointmentId } = body

        if (!appointmentId) {
            return NextResponse.json({
                success: false,
                error: 'Missing required field: appointmentId',
                code: 'INVALID_REQUEST'
            }, { status: 400 })
        }

        console.log(`🔄 BOOKING DEBUG – Retrying PQ sync for appointment: ${appointmentId}`)

        // Fetch appointment details
        const { data: appointment, error: fetchError } = await supabaseAdmin
            .from('appointments')
            .select(`
                id,
                patient_id,
                provider_id,
                service_instance_id,
                start_time,
                end_time,
                location_type,
                notes,
                pq_appointment_id,
                status
            `)
            .eq('id', appointmentId)
            .single()

        if (fetchError || !appointment) {
            return NextResponse.json({
                success: false,
                error: `Appointment not found: ${appointmentId}`,
                code: 'NOT_FOUND'
            }, { status: 404 })
        }

        // Check if already synced
        if (appointment.pq_appointment_id) {
            console.log(`✅ BOOKING DEBUG – Appointment already has PQ ID: ${appointment.pq_appointment_id}`)
            return NextResponse.json({
                success: true,
                data: {
                    appointmentId,
                    pqAppointmentId: appointment.pq_appointment_id,
                    status: appointment.status
                }
            })
        }

        // Resolve IntakeQ mappings
        console.log('🔍 Resolving IntakeQ mappings for retry...')

        const intakeqClientId = await ensureClient(appointment.patient_id)
        const practitionerExternalId = await getIntakeqPractitionerId(appointment.provider_id)
        const serviceExternalId = await getIntakeqServiceId(appointment.service_instance_id)

        console.log('✅ Mappings resolved:', { intakeqClientId, practitionerExternalId, serviceExternalId })

        // Retry IntakeQ appointment creation
        console.log('📅 BOOKING DEBUG – Retrying IntakeQ appointment creation...')
        const appointmentResult = await createAppointment({
            intakeqClientId,
            practitionerExternalId,
            serviceExternalId,
            start: new Date(appointment.start_time),
            end: new Date(appointment.end_time),
            locationType: appointment.location_type as 'telehealth' | 'in_person',
            notes: appointment.notes || `Retried sync - Appointment ID: ${appointmentId}`
        })

        const pqAppointmentId = appointmentResult.pqAppointmentId
        console.log(`✅ BOOKING DEBUG – PQ appointment created: ${pqAppointmentId}`)

        // Update appointment with PQ ID
        const { error: updateError } = await supabaseAdmin
            .from('appointments')
            .update({
                pq_appointment_id: pqAppointmentId,
                status: 'scheduled',
                notes: (appointment.notes || '') + `\n\n[PQ SYNC RETRY SUCCESS ${new Date().toISOString()}]`
            })
            .eq('id', appointmentId)

        if (updateError) {
            console.error('BOOKING DEBUG – Error updating appointment:', updateError)
            throw new Error(`Failed to update appointment: ${updateError.message}`)
        }

        return NextResponse.json({
            success: true,
            data: {
                appointmentId,
                pqAppointmentId,
                status: 'scheduled'
            }
        })

    } catch (error: any) {
        console.error('BOOKING DEBUG – Retry failed:', error)
        return NextResponse.json({
            success: false,
            error: `Retry failed: ${error.message}`,
            code: error.code || 'RETRY_ERROR'
        }, { status: 500 })
    }
}
