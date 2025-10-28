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
import { emailService } from '@/lib/services/emailService'
import { googleMeetService } from '@/lib/services/googleMeetService'
import { sendIntakeQuestionnaire } from '@/lib/services/intakeqQuestionnaire'

/**
 * Normalization helpers for identity matching
 */
const norm = (s?: string | null) => (s ?? '').trim().toLowerCase()
const normDob = (d?: string | null) => {
    if (!d) return null
    try {
        return new Date(d).toISOString().slice(0, 10)
    } catch {
        return null
    }
}

// Intake-only booking request interface (no client serviceInstanceId)
// Supports BOTH new patient creation and existing patient booking
interface IntakeBookingRequest {
    // Either patientId (existing) OR patient (new patient) - not both
    patientId?: string
    patient?: {
        firstName: string
        lastName: string
        email: string
        phone?: string
        dateOfBirth?: string
    }
    providerId: string
    payerId: string // Required for server-side service instance resolution
    start: string // ISO timestamp
    locationType: 'telehealth' | 'in_person'
    notes?: string
    // Insurance enrichment fields for IntakeQ
    memberId?: string
    groupNumber?: string
    // Partner referral tracking (V3.0)
    referralCode?: string // Partner user email or code
    referredByOrganizationId?: string // Organization ID (for Eddie referrals)
    referredByPartnerUserId?: string // Partner user ID (for Eddie referrals)
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

/**
 * Ensures a patient exists, either by validating existing ID or creating new patient.
 * V2.0: Implements STRONG MATCHING (email + firstName + lastName + DOB) to prevent
 * incorrectly merging different patients who share the same email (case manager scenario).
 * V3.0: Accepts referral tracking fields for Eddie-model partner referrals
 */
async function ensurePatient(input: {
    patientId?: string
    patient?: {
        firstName: string
        lastName: string
        email: string
        phone?: string
        dateOfBirth?: string
    }
    // V3.0: Partner referral tracking
    referredByPartnerUserId?: string
    referredByOrganizationId?: string
}): Promise<{ patientId: string; created: boolean; matchType?: 'strong' | 'fallback' | 'none' }> {
    // Path 1: Existing patient ID provided
    if (input.patientId) {
        console.log(`[ENSURE_PATIENT] Validating existing patient: ${input.patientId}`)

        const { data: existingPatient, error } = await supabaseAdmin
            .from('patients')
            .select('id')
            .eq('id', input.patientId)
            .single()

        if (error || !existingPatient) {
            throw new Error(`Patient not found: ${input.patientId}`)
        }

        console.log(`[ENSURE_PATIENT] ✅ Reused existing patient: ${input.patientId}`)
        return { patientId: input.patientId, created: false, matchType: 'strong' }
    }

    // Path 2: New patient data provided - use STRONG MATCHING
    if (input.patient) {
        const { firstName, lastName, email, phone, dateOfBirth } = input.patient

        // Normalize all fields for matching
        const normalizedEmail = norm(email)
        const normalizedFirstName = norm(firstName)
        const normalizedLastName = norm(lastName)
        const normalizedDob = normDob(dateOfBirth)
        const normalizedPhone = phone ? norm(phone).replace(/\D/g, '') : null

        console.log(`[ENSURE_PATIENT] V2.0 Strong matching for:`, {
            email: normalizedEmail,
            firstName: normalizedFirstName,
            lastName: normalizedLastName,
            dob: normalizedDob,
            phone: normalizedPhone
        })

        // STRONG MATCH: email + firstName + lastName + DOB (all 4 must match)
        if (normalizedDob) {
            const { data: strongMatch } = await supabaseAdmin
                .from('patients')
                .select('id, first_name, last_name, date_of_birth')
                .eq('email', normalizedEmail)
                .ilike('first_name', normalizedFirstName)
                .ilike('last_name', normalizedLastName)
                .eq('date_of_birth', normalizedDob)
                .maybeSingle()

            if (strongMatch) {
                console.log(`[ENSURE_PATIENT] ✅ Strong match found (email+name+DOB): ${strongMatch.id}`)
                return { patientId: strongMatch.id, created: false, matchType: 'strong' }
            }
        }

        // FALLBACK MATCH: email + firstName + lastName + phone (when DOB missing)
        if (!normalizedDob && normalizedPhone) {
            const { data: fallbackMatch } = await supabaseAdmin
                .from('patients')
                .select('id, first_name, last_name, phone')
                .eq('email', normalizedEmail)
                .ilike('first_name', normalizedFirstName)
                .ilike('last_name', normalizedLastName)
                .maybeSingle()

            // Check if phone matches (remove all non-digits for comparison)
            if (fallbackMatch && fallbackMatch.phone) {
                const existingPhone = norm(fallbackMatch.phone).replace(/\D/g, '')
                if (existingPhone === normalizedPhone) {
                    console.log(`[ENSURE_PATIENT] ✅ Fallback match found (email+name+phone): ${fallbackMatch.id}`)
                    return { patientId: fallbackMatch.id, created: false, matchType: 'fallback' }
                }
            }
        }

        // NO MATCH: Create new patient (separate person, even if email matches existing)
        console.log(`[ENSURE_PATIENT] No strong match found - creating new patient (potential email collision)`)

        const { data: newPatient, error: createError} = await supabaseAdmin
            .from('patients')
            .insert({
                first_name: firstName,
                last_name: lastName,
                email: normalizedEmail,
                phone: phone || null,
                date_of_birth: normalizedDob,
                status: 'active',
                created_at: new Date().toISOString(),
                // V3.0: Partner referral tracking
                referred_by_partner_user_id: input.referredByPartnerUserId || null,
                referred_by_organization_id: input.referredByOrganizationId || null
            })
            .select('id')
            .single()

        if (createError || !newPatient) {
            console.error('[ENSURE_PATIENT] ❌ Failed to create patient:', createError)
            throw new Error(`Failed to create patient: ${createError?.message || 'Unknown error'}`)
        }

        console.log(`[ENSURE_PATIENT] ✅ Created new patient: ${newPatient.id}`)
        if (input.referredByPartnerUserId) {
            console.log(`[ENSURE_PATIENT] 📌 Tracked referral from partner user: ${input.referredByPartnerUserId}`)
        }
        return { patientId: newPatient.id, created: true, matchType: 'none' }
    }

    // Neither provided
    throw new Error('Must provide either patientId or patient data')
}

export async function POST(request: NextRequest): Promise<NextResponse<IntakeBookingResponse>> {
    try {
        const body = await request.json() as IntakeBookingRequest
        const {
            providerId,
            payerId,
            start,
            locationType,
            notes,
            memberId,
            groupNumber,
            referralCode,
            referredByOrganizationId,
            referredByPartnerUserId
        } = body

        // Log insurance enrichment fields received
        console.log('[BOOKING REQUEST] Insurance fields:', {
            hasMemberId: !!memberId,
            hasGroupNumber: !!groupNumber,
            memberIdLength: memberId?.length,
            groupNumberLength: groupNumber?.length
        })

        // V3.0: Resolve referralCode to partner_user_id if provided
        let resolvedPartnerUserId = referredByPartnerUserId
        let resolvedOrganizationId = referredByOrganizationId

        if (referralCode && !resolvedPartnerUserId) {
            console.log(`[V3.0 REFERRAL] Resolving referral code: ${referralCode}`)

            // Look up partner user by email or code
            const { data: partnerUser } = await supabaseAdmin
                .from('partner_users')
                .select('id, organization_id, full_name, role')
                .eq('email', referralCode.toLowerCase().trim())
                .eq('is_active', true)
                .single()

            if (partnerUser) {
                resolvedPartnerUserId = partnerUser.id
                resolvedOrganizationId = partnerUser.organization_id
                console.log(`[V3.0 REFERRAL] ✅ Resolved referral: ${partnerUser.full_name} (${partnerUser.role})`)
            } else {
                console.log(`[V3.0 REFERRAL] ⚠️ Referral code not found: ${referralCode}`)
            }
        }

        // Check idempotency key first (before any processing)
        const idempotencyKey = request.headers.get('Idempotency-Key')
        if (idempotencyKey) {
            console.log(`🔑 Idempotency key received: ${idempotencyKey.substring(0, 20)}...`)

            // Check if this request was already processed
            const { data: existing, error: idempErr } = await supabaseAdmin
                .from('idempotency_requests')
                .select('appointment_id, response_data')
                .eq('key', idempotencyKey)
                .single()

            if (existing && !idempErr) {
                console.log(`✅ Idempotent request detected, returning cached response for appointment: ${existing.appointment_id}`)
                return NextResponse.json(existing.response_data as IntakeBookingResponse, { status: 200 })
            }
        }

        // Validate required fields
        if ((!body.patientId && !body.patient) || !providerId || !payerId || !start || !locationType) {
            return NextResponse.json({
                success: false,
                error: 'Missing required fields: (patientId OR patient), providerId, payerId, start, locationType',
                code: 'INVALID_REQUEST'
            }, { status: 400 })
        }

        // Additional validation for patient data if provided
        if (body.patient && (!body.patient.firstName || !body.patient.lastName || !body.patient.email)) {
            return NextResponse.json({
                success: false,
                error: 'patient must include: firstName, lastName, email',
                code: 'INVALID_PATIENT_INPUT'
            }, { status: 422 })
        }

        // Step 0: Ensure patient exists (validate or create with strong matching)
        let patientId: string
        let patientMatchType: 'strong' | 'fallback' | 'none' = 'none'
        let patientCreated = false
        try {
            const result = await ensurePatient({
                patientId: body.patientId,
                patient: body.patient,
                // V3.0: Pass referral tracking
                referredByPartnerUserId: resolvedPartnerUserId,
                referredByOrganizationId: resolvedOrganizationId
            })
            patientId = result.patientId
            patientMatchType = result.matchType || 'none'
            patientCreated = result.created
        } catch (error: any) {
            console.error('❌ ensurePatient failed:', error)
            return NextResponse.json({
                success: false,
                error: error.message,
                code: 'PATIENT_RESOLUTION_FAILED'
            }, { status: error.message.includes('not found') ? 404 : 500 })
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

        // Step 2: Resolve IntakeQ mappings (but don't block DB insert on failure)
        // V2.0 Fix: Allow DB insert to succeed even if IntakeQ sync fails
        console.log('🔍 Attempting IntakeQ mappings (non-blocking)...')

        // IntakeQ sync - now non-blocking when enrichment is disabled
        const SKIP_INTAKEQ_SYNC = process.env.PRACTICEQ_ENRICH_ENABLED === 'false'

        let intakeqClientId: string = ''
        let practitionerExternalId: string = ''
        let serviceExternalId: string = ''
        let intakeqMappingError: any = null

        if (!SKIP_INTAKEQ_SYNC) {
            try {
                // Get/create IntakeQ client (V2.1: pass insurance fields for enrichment)
                intakeqClientId = await ensureClient(
                    patientId,
                    payerId,
                    patientMatchType,
                    body.memberId,      // Pass member ID for IntakeQ enrichment
                    body.groupNumber    // Pass group number for IntakeQ enrichment
                )

                // Get provider mapping
                practitionerExternalId = await getIntakeqPractitionerId(providerId)

                // Get service mapping
                serviceExternalId = await getIntakeqServiceId(serviceInstanceId)

                console.log('✅ IntakeQ mappings resolved:', { intakeqClientId, practitionerExternalId, serviceExternalId })

            } catch (error: any) {
                console.error('⚠️ IntakeQ mapping failed (will continue with DB insert):', error.message)
                intakeqMappingError = error
                // Don't return - continue to create DB appointment
            }
        } else {
            console.log('📌 IntakeQ sync skipped (PRACTICEQ_ENRICH_ENABLED=false)')
        }

        // Step 3: Conflict check - Check ALL appointments for this provider (any service type)
        // A provider can only be in one place at a time regardless of appointment type
        console.log('🔒 Checking for appointment conflicts...')

        // CRITICAL: Correct overlap detection
        // Two appointments overlap if: existing.start < new.end AND existing.end > new.start
        // This catches all overlaps including: adjacent, partial, contained, and surrounding
        const { data: conflicts, error: conflictError } = await supabaseAdmin
            .from('appointments')
            .select('id, start_time, end_time, service_instance_id, patient_id, created_at')
            .eq('provider_id', providerId)
            .eq('status', 'scheduled')
            .lt('start_time', endDate.toISOString())      // existing starts before new ends
            .gt('end_time', startDate.toISOString())      // existing ends after new starts

        if (conflictError) {
            console.error('❌ Error checking conflicts:', conflictError)
            throw new Error(`Conflict check failed: ${conflictError.message}`)
        }

        // Check if this is a duplicate request (same patient, same time, within last 30 seconds)
        if (conflicts && conflicts.length > 0) {
            const recentDuplicate = conflicts.find(c => {
                const createdAt = new Date(c.created_at)
                const ageSeconds = (Date.now() - createdAt.getTime()) / 1000
                return c.patient_id === patientId && ageSeconds < 30
            })

            if (recentDuplicate) {
                console.warn('⚠️ Duplicate booking request detected (same patient, time, within 30s), returning existing appointment')

                // Fetch the existing appointment with full details
                const { data: existingAppointment } = await supabaseAdmin
                    .from('appointments')
                    .select('id, pq_appointment_id')
                    .eq('id', recentDuplicate.id)
                    .single()

                // Return success with the existing appointment
                return NextResponse.json({
                    success: true,
                    data: {
                        appointmentId: existingAppointment?.id,
                        pqAppointmentId: existingAppointment?.pq_appointment_id,
                        isDuplicate: true
                    },
                    message: 'Appointment already exists'
                }, { status: 200 })
            }

            // Not a duplicate - actual conflict with different patient or older appointment
            console.error('❌ Appointment slot conflict detected:', conflicts[0])
            return NextResponse.json({
                success: false,
                error: 'The selected time slot is no longer available',
                code: 'SLOT_TAKEN'
            }, { status: 409 })
        }

        console.log('✅ Conflict check passed, proceeding with appointment creation')

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

        // Step 4: Insert appointment with status='scheduled' (baseline DB insert must succeed)
        console.log('💾 Creating appointment record...')

        // Debug trace: Pre-insert
        if (process.env.INTEGRATIONS_DEBUG_HTTP === 'true') {
            console.log('🔍 [DB Trace] Pre-insert:', {
                provider_id: providerId,
                service_instance_id: serviceInstanceId,
                payer_id: payerId,
                patient_id: patientId,
                start_time: startDate.toISOString(),
                intakeq_sync_attempted: !SKIP_INTAKEQ_SYNC,
                intakeq_mapping_error: intakeqMappingError?.message
            })
        }

        // Prepare appointment data matching v2 schema structure
        const appointmentInsert = {
            provider_id: providerId,
            service_instance_id: serviceInstanceId,
            payer_id: payerId,
            patient_id: patientId,  // Direct FK to patients table
            start_time: startDate.toISOString(),
            end_time: endDate.toISOString(),
            timezone: 'America/Denver',
            status: 'scheduled',  // Only 'scheduled' or 'confirmed' allowed by appointments_status_check
            appointment_type: locationType === 'telehealth' ? 'telehealth' : null,  // Only 'telehealth' or NULL allowed
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

        // Debug trace: Post-insert
        if (process.env.INTEGRATIONS_DEBUG_HTTP === 'true') {
            console.log('✅ [DB Trace] Post-insert: Appointment created with ID:', appointmentId)
        }

        console.log('[BOOKING] created:', {
            appointmentId,
            start_time: startDate.toISOString(),
            end_time: endDate.toISOString(),
            provider_id: providerId,
            service_instance_id: serviceInstanceId,
            payer_id: payerId
        })

        // Step 4.5: Auto-assign primary provider if not already set
        // This ensures every patient has a "home" provider based on their first booking
        console.log('👤 Checking if patient needs primary provider assignment...')
        const { data: patientData, error: patientCheckError } = await supabaseAdmin
            .from('patients')
            .select('primary_provider_id')
            .eq('id', patientId)
            .single()

        if (patientCheckError) {
            console.error('⚠️ Could not check patient primary_provider_id:', patientCheckError)
        } else if (!patientData.primary_provider_id) {
            console.log(`📌 Patient has no primary provider, assigning provider ${providerId}...`)
            const { error: updateError } = await supabaseAdmin
                .from('patients')
                .update({ primary_provider_id: providerId })
                .eq('id', patientId)

            if (updateError) {
                console.error('⚠️ Failed to assign primary provider:', updateError)
            } else {
                console.log(`✅ Assigned primary provider ${providerId} to patient ${patientId}`)
            }
        } else {
            console.log(`✅ Patient already has primary provider: ${patientData.primary_provider_id}`)
        }

        // Step 5: IntakeQ mappings already resolved earlier (before appointment creation)
        // Skip this section - mappings are in intakeqClientId, practitionerExternalId, serviceExternalId

        if (SKIP_INTAKEQ_SYNC) {
            // Mark as successfully scheduled without IntakeQ
            const { error: finalUpdateError } = await supabaseAdmin
                .from('appointments')
                .update({
                    status: 'scheduled',
                    notes: (notes || '') + '\n\n[IntakeQ sync skipped - API key issue]'
                })
                .eq('id', appointmentId)

            if (finalUpdateError) {
                console.error('❌ Error updating appointment:', finalUpdateError)
            }

            return NextResponse.json({
                success: true,
                data: {
                    appointmentId,
                    status: 'scheduled'
                },
                message: 'Appointment created successfully (IntakeQ sync skipped)',
                warning: 'IntakeQ sync is temporarily disabled. Appointment created in database only.'
            })
        }

        // Step 6: Sync client insurance to IntakeQ (SKIPPED - endpoint doesn't exist in IntakeQ API)
        // Insurance information is collected during intake questionnaire instead
        console.log('ℹ️ Skipping insurance sync to IntakeQ (handled via questionnaire)')

        // Step 7: Create IntakeQ appointment
        console.log('📅 Creating IntakeQ appointment...')
        let pqAppointmentId: string | null = null
        let pqSyncError: string | null = null

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
            // NEW BEHAVIOR: Persist error instead of deleting appointment
            const errorType = error.status ? `HTTP ${error.status}` : error.code || 'UNKNOWN'
            pqSyncError = `practiceq_create_failed: ${errorType} - ${error.message}`

            console.error(`BOOKING DEBUG – PQ create failed: ${errorType}:`, {
                message: error.message,
                status: error.status,
                code: error.code,
                appointmentId
            })

            // Mark appointment as error state
            const { error: updateError } = await supabaseAdmin
                .from('appointments')
                .update({
                    status: 'error',
                    notes: (notes || '') + `\n\n[PQ SYNC FAILED ${new Date().toISOString()}]\nError: ${pqSyncError}`
                })
                .eq('id', appointmentId)

            if (updateError) {
                console.error('BOOKING DEBUG – Failed to persist PQ error:', updateError)
            }

            return NextResponse.json({
                success: false,
                error: `Failed to create appointment in IntakeQ: ${error.message}`,
                code: 'EHR_WRITE_FAILED',
                details: {
                    errorType,
                    appointmentId
                }
            }, { status: 502 })
        }

        // Step 8: Update appointment with PQ ID and set status to 'scheduled'
        console.log('✅ Updating appointment with IntakeQ ID...')
        const { error: updateError } = await supabaseAdmin
            .from('appointments')
            .update({
                pq_appointment_id: pqAppointmentId,
                status: 'scheduled'
            })
            .eq('id', appointmentId)

        if (updateError) {
            console.error('❌ Error updating appointment with PQ ID:', updateError)
            throw new Error(`Failed to update appointment: ${updateError.message}`)
        }

        // Step 8.5: Send intake questionnaire to patient (NEW - Production Fix)
        console.log('📋 Sending intake questionnaire to patient...')
        try {
            // Get patient info for questionnaire
            const { data: patientInfo } = await supabaseAdmin
                .from('patients')
                .select('first_name, last_name, email')
                .eq('id', patientId)
                .single()

            if (patientInfo && intakeqClientId) {
                const questionnaireResult = await sendIntakeQuestionnaire({
                    intakeqClientId,
                    clientEmail: patientInfo.email,
                    clientName: `${patientInfo.first_name} ${patientInfo.last_name}`,
                    payerId,
                    appointmentId,
                    practitionerId: practitionerExternalId
                })

                if (questionnaireResult.success) {
                    console.log(`✅ ${questionnaireResult.questionnaireName} questionnaire sent successfully`)
                } else {
                    console.error(`⚠️ Questionnaire send failed: ${questionnaireResult.error}`)
                    // Non-blocking: continue with booking even if questionnaire fails
                    // The sendIntakeQuestionnaire function already sends failure notification email
                }
            } else {
                console.warn('⚠️ Cannot send questionnaire: missing patient info or IntakeQ client ID')
            }
        } catch (questionnaireError: any) {
            // Non-blocking error: log but don't fail the booking
            console.error('⚠️ Questionnaire sending error (non-blocking):', questionnaireError.message)
        }

        // Step 8.6: Generate Google Meet link for telehealth appointments
        // This runs in PARALLEL with IntakeQ's Google Meet integration (both create links)
        // Our link is stored in database and visible in all dashboards
        // IntakeQ's link is visible in IntakeQ UI only
        if (locationType === 'telehealth') {
            console.log('🔗 Generating Google Meet link for telehealth appointment...')
            try {
                // Get patient name for meeting title
                const { data: patientInfo } = await supabaseAdmin
                    .from('patients')
                    .select('first_name, last_name')
                    .eq('id', patientId)
                    .single()

                const patientName = patientInfo ? `${patientInfo.first_name} ${patientInfo.last_name}` : 'Patient'

                // Get provider name for meeting title
                const { data: providerInfo } = await supabaseAdmin
                    .from('providers')
                    .select('first_name, last_name')
                    .eq('id', providerId)
                    .single()

                const providerName = providerInfo ? `Dr. ${providerInfo.last_name}` : 'Provider'

                // Generate Google Meet link (organized by hello@trymoonlit.com, OPEN access)
                const meetingUrl = await googleMeetService.generateMeetingLink(
                    appointmentId,
                    patientName,
                    providerName,
                    startDate
                )

                if (meetingUrl) {
                    console.log(`✅ Google Meet link created: ${meetingUrl}`)

                    // Update appointment with meeting URL
                    const { error: meetingUrlError } = await supabaseAdmin
                        .from('appointments')
                        .update({
                            meeting_url: meetingUrl,
                            location_info: {
                                locationType: 'telehealth',
                                placeOfService: '02',
                                meetingUrl: meetingUrl
                            }
                        })
                        .eq('id', appointmentId)

                    if (meetingUrlError) {
                        console.error('⚠️ Failed to save meeting URL to database:', meetingUrlError)
                    } else {
                        console.log('✅ Meeting URL saved to database')
                    }
                } else {
                    console.warn('⚠️ Google Meet link generation returned null (check service configuration)')
                }

            } catch (meetError: any) {
                // Don't fail the booking if Google Meet link generation fails
                console.error('⚠️ Google Meet link generation failed (non-blocking):', meetError.message)
                console.error('   Appointment still created successfully, just without our meeting link')
            }
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

        // Send admin email notification
        try {
            // Get patient details for the email
            const { data: patientData } = await supabaseAdmin
                .from('patients')
                .select('first_name, last_name, email, phone')
                .eq('id', patientId)
                .single()

            if (patientData) {
                // Format date for subject line (e.g., "2025-10-15")
                const appointmentDate = startDate.toISOString().split('T')[0]

                // Get patient initials
                const firstInitial = patientData.first_name ? patientData.first_name.charAt(0).toUpperCase() : ''
                const lastInitial = patientData.last_name ? patientData.last_name.charAt(0).toUpperCase() : ''
                const patientInitials = `${firstInitial}${lastInitial}`

                // Format appointment time (e.g., "10:00 AM")
                const appointmentTime = startDate.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                    timeZone: 'America/Denver'
                })

                // Send notification email
                await emailService.sendEmail({
                    to: 'hello@trymoonlit.com',
                    subject: `New Scheduler appt for ${appointmentDate} for ${patientInitials}`,
                    body: `
🎯 New Appointment Booking Alert

APPOINTMENT DETAILS:
• Patient: ${patientData.first_name} ${patientData.last_name}
• Email: ${patientData.email}
• Phone: ${patientData.phone || 'Not provided'}
• Provider: ${providerData ? `${providerData.first_name} ${providerData.last_name}` : 'Provider'}
• Date: ${appointmentDate}
• Time: ${appointmentTime} (Mountain Time)
• Duration: ${durationMinutes} minutes
• Payer: ${payer.name}

SYSTEM DETAILS:
• Local Appointment ID: ${appointmentId}
• IntakeQ Appointment ID: ${pqAppointmentId || 'Not created'}
• Service Instance: ${serviceInstanceId}
• Location: ${locationType}

---
This booking was created through the Moonlit Scheduler widget.
                    `.trim()
                })

                console.log('✅ Admin notification email sent to hello@trymoonlit.com')
            } else {
                console.warn('⚠️ Could not fetch patient data for email notification')
            }
        } catch (emailError: any) {
            console.error('❌ Failed to send admin notification email:', emailError.message)
            // Don't fail the booking if email fails
        }

        // V3.0: Log referral activity if this was a partner referral
        if (resolvedPartnerUserId && resolvedOrganizationId && patientCreated) {
            try {
                // Get partner user details for activity log
                const { data: partnerUser } = await supabaseAdmin
                    .from('partner_users')
                    .select('full_name, role')
                    .eq('id', resolvedPartnerUserId)
                    .single()

                // Get patient details for activity log
                const { data: patientData } = await supabaseAdmin
                    .from('patients')
                    .select('first_name, last_name')
                    .eq('id', patientId)
                    .single()

                if (partnerUser && patientData) {
                    await supabaseAdmin
                        .from('patient_activity_log')
                        .insert({
                            patient_id: patientId,
                            organization_id: resolvedOrganizationId,
                            appointment_id: appointmentId,
                            activity_type: 'appointment_booked',
                            title: 'New patient referred and booked first appointment',
                            description: `${patientData.first_name} ${patientData.last_name} was referred by ${partnerUser.full_name} and booked their first appointment`,
                            metadata: {
                                referral_code: referralCode || null,
                                partner_user_role: partnerUser.role,
                                appointment_start: startDate.toISOString()
                            },
                            actor_type: 'partner_user',
                            actor_id: resolvedPartnerUserId,
                            actor_name: partnerUser.full_name,
                            visible_to_partner: true,
                            visible_to_patient: false
                        })

                    console.log(`[V3.0 REFERRAL] ✅ Logged referral activity for partner user: ${partnerUser.full_name}`)
                }
            } catch (activityError: any) {
                console.error('[V3.0 REFERRAL] ⚠️ Failed to log referral activity:', activityError.message)
                // Don't fail the booking if activity logging fails
            }
        }

        // Save idempotency record for future duplicate requests
        if (idempotencyKey) {
            await supabaseAdmin
                .from('idempotency_requests')
                .insert({
                    key: idempotencyKey,
                    appointment_id: appointmentId,
                    request_payload: body,
                    response_data: response
                })
                .then(({ error }) => {
                    if (error) {
                        console.warn(`⚠️ Failed to save idempotency record: ${error.message}`)
                    } else {
                        console.log(`✅ Idempotency record saved for key: ${idempotencyKey.substring(0, 20)}...`)
                    }
                })
        }

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