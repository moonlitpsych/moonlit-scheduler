// INTAKE-ONLY BOOKING API: Ignores client serviceInstanceId, resolves server-side from payer
// service_instance_id: Server-resolved via getIntakeServiceInstanceForPayer(payerId)
// New behavior: Client passes payerId, server resolves single Intake service instance
// Fixed: Eliminated client control over service instance selection
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { resolveIntakeServiceInstance } from '@/lib/services/intakeResolver'
import { getIntakeqPractitionerId } from '@/lib/integrations/providerMap'
import { getIntakeqServiceId } from '@/lib/integrations/serviceInstanceMap'
import { ensureClient, syncClientInsurance, createAppointment } from '@/lib/intakeq/client'

// Intake-only booking request interface (no client serviceInstanceId)
interface IntakeBookingRequest {
    patientId: string
    providerId: string
    payerId: string // NEW: Required for server-side service instance resolution
    start: string // ISO timestamp
    locationType: 'telehealth' | 'in_person'
    notes?: string
}

interface IntakeBookingResponse {
    success: boolean
    data?: {
        appointmentId: string
        pqAppointmentId: string
        status: string
        start: string
        end: string
        duration: number
        provider: {
            id: string
            name: string
        }
        service: {
            instanceId: string
            externalId: string
            type: 'intake_telehealth'
        }
        meta: {
            serviceInstanceId: string
            durationMinutes: number
            payerId: string
        }
    }
    error?: string
    code?: string
}

export async function POST(request: NextRequest): Promise<NextResponse<IntakeBookingResponse>> {
    try {
        const body = await request.json() as IntakeBookingRequest
        const { patientId, providerId, payerId, start, locationType, notes } = body

        // Validate required fields (no serviceInstanceId from client)
        if (!patientId || !providerId || !payerId || !start || !locationType) {
            return NextResponse.json({
                success: false,
                error: 'Missing required fields: patientId, providerId, payerId, start, locationType',
                code: 'INVALID_REQUEST'
            }, { status: 400 })
        }

        console.log(`🚀 Starting Intake-only booking process:`, {
            patientId,
            providerId,
            payerId,
            start,
            locationType,
            notes: notes ? `${notes.length} chars` : 'none'
        })

        // Parse and validate start time
        const startDate = new Date(start)
        if (isNaN(startDate.getTime())) {
            return NextResponse.json({
                success: false,
                error: 'Invalid start time format',
                code: 'INVALID_REQUEST'
            }, { status: 400 })
        }

        // Step 1: Resolve Intake service instance server-side (single DB call)
        let serviceInstanceId: string
        let durationMinutes: number
        try {
            const intakeInstance = await resolveIntakeServiceInstance(payerId)
            serviceInstanceId = intakeInstance.serviceInstanceId
            durationMinutes = intakeInstance.durationMinutes
            console.log(`✅ Server-resolved Intake service instance: ${serviceInstanceId} (${durationMinutes}min)`)
        } catch (error: any) {
            console.error('❌ Failed to resolve Intake service instance:', error)
            return NextResponse.json({
                success: false,
                error: error.message,
                code: error.code || 'NO_INTAKE_INSTANCE_FOR_PAYER',
                payerId: error.payerId || payerId
            }, { status: error.status || 422 })
        }

        // Compute end time
        const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000)
        console.log(`⏰ Appointment duration: ${durationMinutes} minutes (${startDate.toISOString()} → ${endDate.toISOString()})`)

        // Step 2: Conflict check (no explicit transaction needed)
        console.log('🔒 Checking for appointment conflicts...')
        const { data: conflicts, error: conflictError } = await supabaseAdmin
            .from('appointments')
            .select('id, start_time, end_time')
            .eq('provider_id', providerId)
            .eq('status', 'scheduled')
            .gte('end_time', startDate.toISOString())
            .lte('start_time', endDate.toISOString())

        if (conflictError) {
            console.error('❌ Error checking conflicts:', conflictError)
            throw new Error(`Conflict check failed: ${conflictError.message}`)
        }

        if (conflicts && conflicts.length > 0) {
            console.error('❌ Appointment slot conflict detected:', conflicts[0])
            return NextResponse.json({
                success: false,
                error: 'The selected time slot is no longer available',
                code: 'SLOT_TAKEN'
            }, { status: 409 })
        }

        // Step 3: Get payer info for insurance sync (no policy lookup needed)
        console.log('📋 Fetching payer details...')
        const { data: payer, error: payerError } = await supabaseAdmin
            .from('payers')
            .select('id, name, payer_type')
            .eq('id', payerId)
            .single()

        if (payerError || !payer) {
            console.error('❌ Failed to fetch payer:', payerError)
            return NextResponse.json({
                success: false,
                error: `Payer not found: ${payerId}`,
                code: 'INVALID_PAYER'
            }, { status: 404 })
        }

        console.log(`✅ Fetched payer: ${payer.name}`)

        // Step 4: Insert appointment with status='pending_sync' (aligned with v2 schema)
        console.log('💾 Creating appointment record...')

        // Prepare appointment data matching v2 schema structure
        const appointmentInsert = {
            provider_id: providerId,
            service_instance_id: serviceInstanceId,
            payer_id: payerId,
            patient_id: patientId,  // Direct FK to patients table
            start_time: startDate.toISOString(),
            end_time: endDate.toISOString(),
            timezone: 'America/Denver',
            status: 'pending_sync',
            appointment_type: 'intake',
            location_type: locationType,  // telehealth | in_person
            patient_info: {
                patient_id: patientId  // Also store in jsonb for compatibility
            },
            insurance_info: {
                payer_id: payerId,
                payer_name: payer.name
            },
            notes: notes || '',
            booking_source: 'patient_portal',
            is_test: false
        }

        // Log exact columns being inserted for verification
        console.log('[BOOKING] inserting columns:', Object.keys(appointmentInsert).join(', '))

        const { data: appointmentData, error: appointmentError } = await supabaseAdmin
            .from('appointments')
            .insert(appointmentInsert)
            .select('id')
            .single()

        if (appointmentError) {
            console.error('❌ Error creating appointment:', appointmentError)
            throw new Error(`Failed to create appointment: ${appointmentError.message}`)
        }

        const appointmentId = appointmentData.id
        console.log('[BOOKING] created:', {
            appointmentId,
            start_time: startDate.toISOString(),
            end_time: endDate.toISOString(),
            provider_id: providerId,
            service_instance_id: serviceInstanceId,
            payer_id: payerId
        })

        // Step 5: Resolve IntakeQ mappings
        console.log('🔍 Resolving IntakeQ mappings...')

        let intakeqClientId: string
        let practitionerExternalId: string
        let serviceExternalId: string

        try {
            // Get/create IntakeQ client
            intakeqClientId = await ensureClient(patientId)

            // Get provider mapping
            practitionerExternalId = await getIntakeqPractitionerId(providerId)

            // Get service mapping
            serviceExternalId = await getIntakeqServiceId(serviceInstanceId)

        } catch (error: any) {
            console.error('❌ Failed to resolve IntakeQ mappings:', error)
            return NextResponse.json({
                success: false,
                error: error.message,
                code: error.code || 'MAPPING_ERROR'
            }, { status: error.status || 422 })
        }

        // Step 6: Sync client insurance to IntakeQ (using real payer data)
        console.log('🔄 Syncing client insurance to IntakeQ...')
        try {
            await syncClientInsurance(intakeqClientId, {
                payer_id: payer.id,
                payer_name: payer.name,
                member_id: patientId,  // Using patient ID as member ID for now
                group_number: undefined,
                policy_holder_name: undefined,
                policy_holder_dob: undefined
            })
        } catch (error: any) {
            console.warn('⚠️ Failed to sync insurance (non-fatal):', error.message)
            // Continue with booking even if insurance sync fails
        }

        // Step 7: Create IntakeQ appointment
        console.log('📅 Creating IntakeQ appointment...')
        let pqAppointmentId: string
        try {
            const appointmentResult = await createAppointment({
                intakeqClientId,
                practitionerExternalId,
                serviceExternalId,
                start: startDate,
                end: endDate,
                locationType,
                notes: notes || `Booked via Moonlit Scheduler - Appointment ID: ${appointmentId}`
            })
            pqAppointmentId = appointmentResult.pqAppointmentId
            console.log('[PQ_SYNC] pqAppointmentId:', pqAppointmentId)

        } catch (error: any) {
            console.error('❌ IntakeQ appointment creation failed:', error)
            return NextResponse.json({
                success: false,
                error: `Failed to create appointment in IntakeQ: ${error.message}`,
                code: 'EHR_WRITE_FAILED'
            }, { status: 502 })
        }

        // Step 8: Update appointment with PQ ID and set status to 'scheduled'
        console.log('✅ Updating appointment with IntakeQ ID...')
        const { error: updateError } = await supabaseAdmin
            .from('appointments')
            .update({
                pq_appointment_id: pqAppointmentId,
                status: 'scheduled',
                synced_at: new Date().toISOString()
            })
            .eq('id', appointmentId)

        if (updateError) {
            console.error('❌ Error updating appointment with PQ ID:', updateError)
            throw new Error(`Failed to update appointment: ${updateError.message}`)
        }

        // Get provider name for response
        const { data: providerData } = await supabaseAdmin
            .from('providers')
            .select('first_name, last_name')
            .eq('id', providerId)
            .single()

        const response: IntakeBookingResponse = {
            success: true,
            data: {
                appointmentId,
                pqAppointmentId,
                status: 'scheduled',
                start: startDate.toISOString(),
                end: endDate.toISOString(),
                duration: durationMinutes,
                provider: {
                    id: providerId,
                    name: providerData ? `${providerData.first_name} ${providerData.last_name}` : 'Provider'
                },
                service: {
                    instanceId: serviceInstanceId,
                    externalId: serviceExternalId,
                    type: 'intake_telehealth'
                },
                meta: {
                    serviceInstanceId,
                    durationMinutes,
                    payerId
                }
            }
        }

        console.log(`🎉 Intake-only booking completed successfully: ${appointmentId} → ${pqAppointmentId} (service: ${serviceInstanceId})`)
        return NextResponse.json(response)

    } catch (error: any) {
        console.error('💥 Intake booking failed:', error)
        return NextResponse.json({
            success: false,
            error: `Intake booking failed: ${error.message}`,
            code: 'BOOKING_ERROR'
        }, { status: 500 })
    }
}