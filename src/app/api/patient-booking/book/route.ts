// INTAKE-ONLY BOOKING API: Ignores client serviceInstanceId, resolves server-side from payer
// service_instance_id: Server-resolved via getIntakeServiceInstanceForPayer(payerId)
// New behavior: Client passes payerId, server resolves single Intake service instance
// Fixed: Eliminated client control over service instance selection

// V3.3: Set explicit timeout for booking route (2 minutes)
// This prevents unknown Vercel timeout behavior and gives enough time for:
// - IntakeQ client creation (up to 50s with retries)
// - Appointment creation
// - Questionnaire sending
// - All database operations
export const maxDuration = 120 // 2 minutes

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { resolveIntakeServiceInstance } from '@/lib/services/intakeResolver'
import { getIntakeqPractitionerId } from '@/lib/integrations/providerMap'
import { getIntakeqServiceId } from '@/lib/integrations/serviceInstanceMap'
import { ensureClient, syncClientInsurance, createAppointment } from '@/lib/intakeq/client'
import { emailService } from '@/lib/services/emailService'
import { googleMeetService } from '@/lib/services/googleMeetService'
import { sendIntakeQuestionnaire } from '@/lib/services/intakeqQuestionnaire'
import { sanitizePatientForLogging } from '@/lib/validation/bookingSchema'

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
    planName?: string // V4.0: Plan name from 271 response or insurance card (for network resolution)
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
        const rawBody = await request.json()

        // V3.2: Validate input with zod schema
        // DISABLED: Validation schema is incompatible with IntakeBookingRequest interface
        // The schema expects startTime/endTime/serviceInstanceId but API uses start/payerId
        // TODO: Create proper validation schema that matches IntakeBookingRequest
        // const validation = validateBookingRequest(rawBody)
        // if (!validation.success) {
        //     console.error('❌ Invalid booking request:', validation.errors)
        //     return NextResponse.json({
        //         success: false,
        //         error: 'Invalid request data',
        //         validationErrors: validation.errors
        //     } as IntakeBookingResponse, { status: 400 })
        // }

        // Use raw body (validation disabled)
        const body = rawBody as IntakeBookingRequest
        const {
            providerId,
            payerId,
            start,
            locationType,
            notes,
            memberId,
            groupNumber,
            planName,
            referralCode,
            referredByOrganizationId,
            referredByPartnerUserId
        } = body

        // Log insurance enrichment fields received (with sanitized patient data)
        console.log('[BOOKING REQUEST] Insurance fields:', {
            hasMemberId: !!memberId,
            hasGroupNumber: !!groupNumber,
            memberIdLength: memberId?.length,
            groupNumberLength: groupNumber?.length,
            patient: body.patient ? sanitizePatientForLogging(body.patient) : undefined,
            hasPlanName: !!planName,
            planName: planName || 'not provided'
        })

        // V3.0: Resolve referralCode to partner_user_id if provided
        // DISABLED: This feature is not in use and was causing production crashes
        let resolvedPartnerUserId = referredByPartnerUserId
        let resolvedOrganizationId = referredByOrganizationId

        // Commenting out referralCode processing to prevent crashes
        // if (referralCode && !resolvedPartnerUserId) { ... }

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
                // V3.0: Pass referral tracking - DISABLED (not in use, was causing crashes)
                // referredByPartnerUserId: resolvedPartnerUserId,
                // referredByOrganizationId: resolvedOrganizationId
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

                // V3.2: Assertion - ensureClient should never return empty string
                if (!intakeqClientId || intakeqClientId.trim() === '') {
                    throw new Error('CRITICAL: ensureClient returned empty ID - this should never happen')
                }

                // Get provider mapping
                practitionerExternalId = await getIntakeqPractitionerId(providerId)

                // Get service mapping
                serviceExternalId = await getIntakeqServiceId(serviceInstanceId)

                console.log('✅ IntakeQ mappings resolved:', { intakeqClientId, practitionerExternalId, serviceExternalId })

            } catch (error: any) {
                // V3.1 Fix: Return error immediately instead of continuing with empty client ID
                console.error('❌ IntakeQ client mapping failed, stopping booking flow:', error.message)

                // Send notification email to admin
                try {
                    const { data: patientData } = await supabaseAdmin
                        .from('patients')
                        .select('first_name, last_name, email, phone')
                        .eq('id', patientId)
                        .single()

                    const { data: providerData } = await supabaseAdmin
                        .from('providers')
                        .select('first_name, last_name')
                        .eq('id', providerId)
                        .single()

                    if (patientData && providerData) {
                        const appointmentDate = startDate.toISOString().split('T')[0]
                        const appointmentTime = startDate.toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                            timeZone: 'America/Denver'
                        })

                        await emailService.sendEmail({
                            to: 'hello@trymoonlit.com',
                            subject: `🚨 BOOKING BLOCKED - IntakeQ Client Creation Failed - ${appointmentDate}`,
                            body: `
🚨 BOOKING BLOCKED - INTAKEQ CLIENT CREATION FAILED

PATIENT INFORMATION:
• Name: ${patientData.first_name} ${patientData.last_name}
• Email: ${patientData.email}
• Phone: ${patientData.phone || 'Not provided'}

ATTEMPTED APPOINTMENT:
• Provider: ${providerData.first_name} ${providerData.last_name}
• Date: ${appointmentDate}
• Time: ${appointmentTime} (Mountain Time)
• Duration: ${durationMinutes} minutes

ERROR DETAILS:
• Error: ${error.message}
• Patient ID: ${patientId}
• Provider ID: ${providerId}

WHAT HAPPENED:
The system could not create or verify the IntakeQ client record. This blocked the booking from proceeding to prevent creating an appointment without a valid client ID.

ACTION REQUIRED:
1. Check IntakeQ API status and authentication
2. Verify patient record exists in IntakeQ
3. Contact patient to reschedule if needed
4. Review IntakeQ integration logs for details

---
This is an automated alert from Moonlit Scheduler.
                            `.trim()
                        })

                        console.log('✅ Blocking notification email sent to hello@trymoonlit.com')
                    }
                } catch (emailError: any) {
                    console.error('❌ Failed to send blocking notification email:', emailError.message)
                }

                // Return error to user
                return NextResponse.json({
                    success: false,
                    error: 'We encountered an issue setting up your patient record in our scheduling system. Please try again in a few moments, or contact us directly for assistance.',
                    code: 'INTAKEQ_CLIENT_FAILED',
                    details: {
                        message: error.message,
                        patientId
                    }
                }, { status: 502 })
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
                payer_name: payer.name,
                // TEMPORARILY REMOVED: plan_name causes trigger failures when junction table is incomplete
                // plan_name: planName || null, // V4.0: Store plan name for network resolution
                member_id: memberId || null,
                group_number: groupNumber || null
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
            // V3.2: Add compensation - update appointment notes with failure
            await supabaseAdmin
                .from('appointments')
                .update({
                    notes: (notes || '') + `\n\n[COMPENSATION NOTE ${new Date().toISOString()}]\nFailed to check patient primary provider: ${patientCheckError.message}\nManual review needed.`
                })
                .eq('id', appointmentId)
                .then(({ error }) => {
                    if (error) console.error('Failed to update appointment notes:', error)
                })

            // V3.3: Send admin notification about database query failure
            await emailService.sendEmail({
                to: 'hello@trymoonlit.com',
                subject: `⚠️ Database Query Failed - Patient ${patientId}`,
                body: `
⚠️ DATABASE QUERY FAILURE - PATIENT PRIMARY PROVIDER CHECK

Appointment ID: ${appointmentId}
Patient ID: ${patientId}
Provider ID: ${providerId}

ISSUE:
Failed to check if patient has a primary provider assigned.
This indicates a potential database connectivity or permission issue.

ERROR DETAILS:
${patientCheckError.message}

ACTION REQUIRED:
1. Check database connectivity
2. Verify patient ${patientId} exists and is accessible
3. Manually check if patient needs primary_provider_id assignment
4. If needed, run: UPDATE patients SET primary_provider_id = '${providerId}' WHERE id = '${patientId}';

NOTE: The appointment was created successfully, this is just a data integrity check.
                `.trim()
            }).catch(err => console.error('Failed to send database query notification:', err))
        } else if (!patientData.primary_provider_id) {
            console.log(`📌 Patient has no primary provider, assigning provider ${providerId}...`)
            const { error: updateError } = await supabaseAdmin
                .from('patients')
                .update({ primary_provider_id: providerId })
                .eq('id', patientId)

            if (updateError) {
                console.error('⚠️ Failed to assign primary provider:', updateError)
                // V3.2: Add compensation - update appointment notes with failure
                await supabaseAdmin
                    .from('appointments')
                    .update({
                        notes: (notes || '') + `\n\n[COMPENSATION NOTE ${new Date().toISOString()}]\nFailed to assign primary provider: ${updateError.message}\nPatient needs primary_provider_id set to ${providerId}.`
                    })
                    .eq('id', appointmentId)
                    .then(({ error }) => {
                        if (error) console.error('Failed to update appointment notes:', error)
                    })

                // V3.3: Send admin notification about primary provider assignment failure
                await emailService.sendEmail({
                    to: 'hello@trymoonlit.com',
                    subject: `⚠️ Primary Provider Assignment Failed - Patient ${patientId}`,
                    body: `
⚠️ PRIMARY PROVIDER ASSIGNMENT FAILED

Appointment ID: ${appointmentId}
Patient ID: ${patientId}
Provider ID: ${providerId}

ISSUE:
Patient's first appointment was booked but we couldn't assign their primary provider.
This affects care continuity and provider assignment for future visits.

ERROR DETAILS:
${updateError.message}

ACTION REQUIRED:
UPDATE patients SET primary_provider_id = '${providerId}' WHERE id = '${patientId}';

IMPACT:
- Patient has no "home" provider assigned
- Future appointments may route to wrong provider
- Care coordination may be affected

NOTE: The appointment was created successfully, only the primary provider assignment failed.
                    `.trim()
                }).catch(err => console.error('Failed to send primary provider notification:', err))
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

        // V3.1 Fix: Validation guard - ensure we have a valid client ID before proceeding
        if (!intakeqClientId || intakeqClientId.trim() === '') {
            console.error('❌ Cannot create IntakeQ appointment: intakeqClientId is empty')
            console.error('DEBUG: This should have been caught earlier by ensureClient failure check')
            pqSyncError = 'practiceq_create_failed: Empty client ID'

            // Update appointment notes with defensive error
            await supabaseAdmin
                .from('appointments')
                .update({
                    notes: (notes || '') + `\n\n[PQ SYNC BLOCKED ${new Date().toISOString()}]\nReason: Empty IntakeQ client ID (defensive guard triggered)\nStatus: Requires investigation`
                })
                .eq('id', appointmentId)

            // Send admin notification
            await emailService.sendEmail({
                to: 'hello@trymoonlit.com',
                subject: `⚠️ DEFENSIVE GUARD TRIGGERED - Empty Client ID - ${appointmentId}`,
                body: `
⚠️ DEFENSIVE VALIDATION GUARD TRIGGERED

Appointment ID: ${appointmentId}
Patient ID: ${patientId}
Provider ID: ${providerId}

ISSUE:
IntakeQ appointment creation was blocked because intakeqClientId is empty.
This should have been caught earlier by the ensureClient failure check.

ACTION REQUIRED:
1. Review logs for appointment ${appointmentId}
2. Check why ensureClient check did not trigger
3. Manually create IntakeQ appointment for this patient
                `.trim()
            })

            // Continue to return the appointment (DB booking succeeded, just IntakeQ sync failed)
        } else {
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
            // V3.0: Enhanced error handling with better user messaging
            const errorType = error.status ? `HTTP ${error.status}` : error.code || 'UNKNOWN'
            pqSyncError = `practiceq_create_failed: ${errorType} - ${error.message}`

            // Check if this is a "Client not found" error (propagation issue)
            const isClientNotFound = error.status === 400 && error.message?.includes('Client not found')

            console.error(`BOOKING DEBUG – PQ create failed: ${errorType}:`, {
                message: error.message,
                status: error.status,
                code: error.code,
                appointmentId,
                isClientNotFound,
                intakeqClientId
            })

            // V3.1 Fix: Update notes with error details but keep status as 'scheduled'
            // Database constraint only allows ['scheduled', 'confirmed'] - 'error' is invalid
            const { error: updateError } = await supabaseAdmin
                .from('appointments')
                .update({
                    // Keep status as 'scheduled' - appointment exists in DB even though IntakeQ sync failed
                    notes: (notes || '') + `\n\n[PQ SYNC FAILED ${new Date().toISOString()}]\nError: ${pqSyncError}\nClient ID: ${intakeqClientId}\nStatus: Requires manual IntakeQ appointment creation`
                })
                .eq('id', appointmentId)

            if (updateError) {
                console.error('BOOKING DEBUG – Failed to persist PQ error notes:', updateError)
            }

            // V3.0: Send notification email to admin about the failure
            try {
                // Get patient and provider details for the notification
                const { data: patientData } = await supabaseAdmin
                    .from('patients')
                    .select('first_name, last_name, email, phone')
                    .eq('id', patientId)
                    .single()

                const { data: providerData } = await supabaseAdmin
                    .from('providers')
                    .select('first_name, last_name')
                    .eq('id', providerId)
                    .single()

                if (patientData && providerData) {
                    const appointmentDate = startDate.toISOString().split('T')[0]
                    const appointmentTime = startDate.toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true,
                        timeZone: 'America/Denver'
                    })

                    await emailService.sendEmail({
                        to: 'hello@trymoonlit.com',
                        subject: `🚨 FAILED BOOKING - ${appointmentDate} - Action Required`,
                        body: `
🚨 BOOKING FAILED - MANUAL INTERVENTION REQUIRED

PATIENT INFORMATION:
• Name: ${patientData.first_name} ${patientData.last_name}
• Email: ${patientData.email}
• Phone: ${patientData.phone || 'Not provided'}

APPOINTMENT DETAILS:
• Provider: ${providerData.first_name} ${providerData.last_name}
• Date: ${appointmentDate}
• Time: ${appointmentTime} (Mountain Time)
• Duration: ${durationMinutes} minutes

ERROR DETAILS:
• Error Type: ${errorType}
• IntakeQ Client ID: ${intakeqClientId}
• Appointment ID: ${appointmentId}
• Technical Error: ${error.message}
• Is Client Not Found: ${isClientNotFound ? 'YES - Propagation delay issue' : 'NO'}

WHAT HAPPENED:
${isClientNotFound
    ? 'Patient was created in IntakeQ but the system could not create the appointment due to propagation delays. The patient record exists in both our database and IntakeQ.'
    : 'Unknown error occurred while creating the IntakeQ appointment. The patient record exists in our database.'}

ACTION REQUIRED:
1. Log into IntakeQ and find client: ${intakeqClientId}
2. Manually create appointment for this patient
3. Update appointment ${appointmentId} in Supabase with the IntakeQ appointment ID
4. Send confirmation email to patient

DATABASE APPOINTMENT ID: ${appointmentId}
Status: 'scheduled' (appointment exists in DB, IntakeQ sync failed - see notes field)

---
This is an automated alert from Moonlit Scheduler.
                        `.trim()
                    })

                    console.log('✅ Failure notification email sent to hello@trymoonlit.com')
                }
            } catch (emailError: any) {
                console.error('❌ Failed to send failure notification email:', emailError.message)
                // Don't fail the error response if email fails
            }

            // V3.0: Provide user-friendly error message
            const userMessage = isClientNotFound
                ? 'Your information was saved, but there was a temporary delay syncing with our scheduling system. Our team has been notified and will complete your booking within 1 hour. You will receive a confirmation email once processed.'
                : 'We encountered an issue finalizing your booking. Our team has been notified and will contact you shortly to complete your appointment.'

            return NextResponse.json({
                success: false,
                error: userMessage,
                code: 'EHR_WRITE_FAILED',
                details: {
                    errorType,
                    appointmentId,
                    technicalError: error.message,
                    isRetryable: isClientNotFound
                }
            }, { status: 502 })
            }
        } // V3.1: End of else block for non-empty client ID validation

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
            // V3.2: Don't throw - use compensation instead
            // The appointment exists, we just couldn't update it with PQ ID
            await supabaseAdmin
                .from('appointments')
                .update({
                    notes: (notes || '') + `\n\n[COMPENSATION NOTE ${new Date().toISOString()}]\nFailed to update appointment with IntakeQ ID: ${updateError.message}\nIntakeQ appointment ID: ${pqAppointmentId}\nRequires manual DB update.`,
                    status: 'scheduled' // Still mark as scheduled since appointment exists
                })
                .eq('id', appointmentId)
                .then(({ error }) => {
                    if (error) console.error('Failed to update appointment notes:', error)
                })

            // Send admin notification about the failed update
            await emailService.sendEmail({
                to: 'hello@trymoonlit.com',
                subject: `⚠️ DB Update Failed - Appointment ${appointmentId}`,
                body: `
⚠️ DATABASE UPDATE FAILED - MANUAL INTERVENTION NEEDED

Appointment ID: ${appointmentId}
IntakeQ Appointment ID: ${pqAppointmentId}

ISSUE:
Appointment was created successfully in both our database and IntakeQ,
but we couldn't update the database with the IntakeQ appointment ID.

ACTION REQUIRED:
UPDATE appointments SET pq_appointment_id = '${pqAppointmentId}' WHERE id = '${appointmentId}';

This is a non-critical error - the appointment is valid and the patient has been notified.
                `.trim()
            }).catch(err => console.error('Failed to send admin notification:', err))
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
                        // V3.2: Add compensation - update appointment notes with failure
                        await supabaseAdmin
                            .from('appointments')
                            .update({
                                notes: (notes || '') + `\n\n[COMPENSATION NOTE ${new Date().toISOString()}]\nFailed to save meeting URL: ${meetingUrlError.message}\nGoogle Meet URL: ${meetingUrl}\nRequires manual update.`
                            })
                            .eq('id', appointmentId)
                            .then(({ error }) => {
                                if (error) console.error('Failed to update appointment notes:', error)
                            })

                        // Send admin notification about missing meeting URL
                        await emailService.sendEmail({
                            to: 'hello@trymoonlit.com',
                            subject: `⚠️ Meeting URL Not Saved - Appointment ${appointmentId}`,
                            body: `
⚠️ MEETING URL NOT SAVED - MANUAL UPDATE NEEDED

Appointment ID: ${appointmentId}
Google Meet URL: ${meetingUrl}

ISSUE:
Telehealth appointment was created successfully but the Google Meet URL
couldn't be saved to the database.

ACTION REQUIRED:
UPDATE appointments SET meeting_url = '${meetingUrl}' WHERE id = '${appointmentId}';

This is important - patient/provider need this link to join the appointment.
                            `.trim()
                        }).catch(err => console.error('Failed to send meeting URL notification:', err))
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
            const { error: insertError } = await supabaseAdmin
                .from('idempotency_requests')
                .insert({
                    key: idempotencyKey,
                    appointment_id: appointmentId,
                    request_payload: body,
                    response_data: response
                })

            if (insertError) {
                // V3.2: Handle unique constraint violation (code 23505)
                // This means another request with same key already succeeded
                if (insertError.code === '23505') {
                    console.log(`⚠️ Idempotency key already exists (race condition handled): ${idempotencyKey.substring(0, 20)}...`)

                    // Fetch the existing record and return its response
                    const { data: existing, error: fetchError } = await supabaseAdmin
                        .from('idempotency_requests')
                        .select('appointment_id, response_data')
                        .eq('key', idempotencyKey)
                        .single()

                    if (existing && !fetchError) {
                        console.log(`✅ Returning cached response for concurrent request: ${existing.appointment_id}`)
                        // Return the cached response from the request that won the race
                        return NextResponse.json(existing.response_data as IntakeBookingResponse, { status: 200 })
                    }
                } else {
                    // Other errors are logged but don't fail the request
                    console.warn(`⚠️ Failed to save idempotency record: ${insertError.message}`)
                }
            } else {
                console.log(`✅ Idempotency record saved for key: ${idempotencyKey.substring(0, 20)}...`)
            }
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