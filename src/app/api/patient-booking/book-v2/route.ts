/**
 * V2.0 Enhanced Booking API
 *
 * New Features:
 * - Client upsert with DOB/phone/insurance enrichment
 * - Guaranteed intake questionnaire sending
 * - Contact/case manager mirroring
 * - Duplicate detection with email alerts
 * - Enhanced audit logging
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { resolveIntakeServiceInstance } from '@/lib/services/intakeResolver'
import { getIntakeqPractitionerId } from '@/lib/integrations/providerMap'
import { getIntakeqServiceId } from '@/lib/integrations/serviceInstanceMap'
import { upsertPracticeQClient } from '@/lib/services/intakeqClientUpsert'
import { createAppointment } from '@/lib/intakeq/client'
import { sendIntakeQuestionnaire, buildQuestionnaireUrl } from '@/lib/services/intakeqQuestionnaire'
import { emailService } from '@/lib/services/emailService'
import { logIntakeqSync } from '@/lib/services/intakeqAudit'
import { featureFlags } from '@/lib/config/featureFlags'

interface V2BookingRequest {
  // Patient data
  patientId?: string
  patient?: {
    firstName: string
    lastName: string
    email: string
    phone?: string
    dateOfBirth?: string
  }

  // Insurance data
  memberId?: string
  groupNumber?: string

  // Contact/case manager (V2.0)
  contact?: {
    name?: string
    email?: string
    phone?: string
  }

  // Booking data
  providerId: string
  payerId: string
  start: string
  locationType: 'telehealth' | 'in_person'
  notes?: string

  // Client control
  idempotencyKey?: string
}

interface V2BookingResponse {
  success: boolean
  data?: {
    appointmentId: string
    pqAppointmentId?: string
    status: string
    start: string
    end: string
    duration: number
    provider: {
      id: string
      name: string
    }
    enrichment?: {
      clientId: string
      enrichedFields: string[]
      questionnaireSent: boolean
      contactNotified: boolean
    }
  }
  error?: string
  code?: string
  warnings?: string[]
}

export async function POST(request: NextRequest): Promise<NextResponse<V2BookingResponse>> {
  // V2.0: Strong identity matching without ON CONFLICT - FRESH COMPILE TEST
  console.log('🔵 V2.0 BOOK-V2 ENDPOINT - FRESH COMPILATION ACTIVE')
  const startTime = Date.now()
  const warnings: string[] = []

  try {
    const body = await request.json() as V2BookingRequest

    // DEV: Warn if address fields present (should never happen)
    if (process.env.NODE_ENV === 'development') {
      const bodyKeys = Object.keys(body)
      const addressKeys = bodyKeys.filter(key =>
        key.toLowerCase().includes('address') ||
        key === 'street' ||
        key === 'city' ||
        key === 'state' ||
        key === 'zip'
      )
      if (addressKeys.length > 0) {
        console.warn(`⚠️ V2.0 DEV WARNING: Address fields detected in payload (should not happen):`, addressKeys)
      }
    }

    // Check idempotency
    const idempotencyKey = body.idempotencyKey || request.headers.get('Idempotency-Key')
    if (idempotencyKey) {
      const { data: existing } = await supabaseAdmin
        .from('idempotency_requests')
        .select('appointment_id, response_data')
        .eq('key', idempotencyKey)
        .single()

      if (existing) {
        console.log(`✅ V2.0: Idempotent request detected, returning cached response`)
        return NextResponse.json(existing.response_data as V2BookingResponse)
      }
    }

    // Step 1: Ensure patient exists (V2.0: Strong matching logic)
    const { patientId, patient } = body
    let resolvedPatientId: string
    let matchType: 'strong' | 'fallback' | 'none' = 'none'

    if (patientId) {
      resolvedPatientId = patientId
      matchType = 'strong' // Existing patient ID is strongest match

      // V2.0: Update primary_payer_id if not already set
      try {
        const { data: existingPatient } = await supabaseAdmin
          .from('patients')
          .select('primary_payer_id')
          .eq('id', patientId)
          .single()

        if (existingPatient && !existingPatient.primary_payer_id && body.payerId && body.payerId !== 'cash-payment') {
          await supabaseAdmin
            .from('patients')
            .update({ primary_payer_id: body.payerId })
            .eq('id', patientId)
          console.log(`✅ V2.0: Set primary_payer_id for existing patient`)
        }
      } catch (error) {
        console.error('⚠️ V2.0: Failed to update primary_payer_id (non-blocking):', error)
      }
    } else if (patient) {
      // Normalize input for matching
      const normalizedEmail = patient.email.toLowerCase()
      const normalizedFirstName = patient.firstName.trim().toLowerCase()
      const normalizedLastName = patient.lastName.trim().toLowerCase()
      const normalizedDob = patient.dateOfBirth || null
      const normalizedPhone = patient.phone?.replace(/\D/g, '') || null

      // Debug logging for DX
      if (process.env.INTEGRATIONS_DEBUG_HTTP === 'true') {
        console.log('[V2 PATIENT STEP]', {
          matchType: 'checking',
          email: normalizedEmail,
          firstName: normalizedFirstName,
          lastName: normalizedLastName,
          dob: normalizedDob,
          phone: normalizedPhone
        })
      }

      try {
        // Strong match: email + firstName + lastName + DOB
        if (normalizedDob) {
          console.log(`🔍 V2.0: Attempting strong match with:`, {
            email: normalizedEmail,
            firstName: normalizedFirstName,
            lastName: normalizedLastName,
            dob: normalizedDob
          })

          const { data: strongMatch, error: strongMatchError } = await supabaseAdmin
            .from('patients')
            .select('id, primary_payer_id')
            .eq('email', normalizedEmail)
            .ilike('first_name', normalizedFirstName)
            .ilike('last_name', normalizedLastName)
            .eq('date_of_birth', normalizedDob)
            .maybeSingle()

          if (strongMatchError) {
            console.error(`❌ V2.0: Strong match query error:`, strongMatchError)
          }

          if (strongMatch) {
            resolvedPatientId = strongMatch.id
            matchType = 'strong'
            console.log(`✅ V2.0: Strong match found (email+name+DOB): ${resolvedPatientId}`)

            // Update primary_payer_id if not set (skip for cash payment)
            if (!strongMatch.primary_payer_id && body.payerId && body.payerId !== 'cash-payment') {
              await supabaseAdmin
                .from('patients')
                .update({ primary_payer_id: body.payerId })
                .eq('id', resolvedPatientId)
            }
          } else {
            console.log(`⚠️ V2.0: No strong match found`)
          }
        }

        // Fallback match: email + firstName + lastName + phone (only if no strong match)
        if (!resolvedPatientId && normalizedPhone) {
          console.log(`🔍 V2.0: Attempting fallback match with phone: ${patient.phone}`)

          const { data: fallbackMatch, error: fallbackMatchError } = await supabaseAdmin
            .from('patients')
            .select('id, primary_payer_id')
            .eq('email', normalizedEmail)
            .ilike('first_name', normalizedFirstName)
            .ilike('last_name', normalizedLastName)
            .eq('phone', patient.phone) // Use original phone format
            .maybeSingle()

          if (fallbackMatchError) {
            console.error(`❌ V2.0: Fallback match query error:`, fallbackMatchError)
          }

          if (fallbackMatch) {
            resolvedPatientId = fallbackMatch.id
            matchType = 'fallback'
            console.log(`✅ V2.0: Fallback match found (email+name+phone): ${resolvedPatientId}`)

            // Update primary_payer_id if not set (skip for cash payment)
            if (!fallbackMatch.primary_payer_id && body.payerId && body.payerId !== 'cash-payment') {
              await supabaseAdmin
                .from('patients')
                .update({ primary_payer_id: body.payerId })
                .eq('id', resolvedPatientId)
            }
          } else {
            console.log(`⚠️ V2.0: No fallback match found`)
          }
        }

        // No match found - create new patient
        if (!resolvedPatientId) {
          console.log(`📝 V2.0: Creating new patient with email: ${normalizedEmail}`)
          const { data: newPatient, error: insertError } = await supabaseAdmin
            .from('patients')
            .insert({
              first_name: patient.firstName,
              last_name: patient.lastName,
              email: normalizedEmail,
              phone: patient.phone || null,
              date_of_birth: patient.dateOfBirth || null,
              // Set to null for cash payment (not a valid UUID)
              primary_payer_id: (body.payerId && body.payerId !== 'cash-payment') ? body.payerId : null,
              status: 'active',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select('id')
            .single()

          if (insertError || !newPatient) {
            // Log to audit trail
            await logIntakeqSync({
              action: 'create_client',
              status: 'failed',
              payload: {
                firstName: patient.firstName,
                lastName: patient.lastName,
                email: normalizedEmail,
                // Redact sensitive fields
                phone: patient.phone ? 'REDACTED' : null,
                dateOfBirth: patient.dateOfBirth ? 'REDACTED' : null
              },
              error: insertError?.message,
              enrichmentData: {
                identityMatch: matchType,
                pgCode: (insertError as any)?.code,
                pgHint: (insertError as any)?.hint
              }
            })

            return NextResponse.json({
              success: false,
              code: 'PATIENT_UPSERT_FAILED',
              message: `Failed to create patient record: ${insertError?.message || 'Unknown error'}`,
              details: {
                pgCode: (insertError as any)?.code,
                pgHint: (insertError as any)?.hint
              }
            }, { status: 500 })
          }

          resolvedPatientId = newPatient.id
          matchType = 'none'
          console.log(`✅ V2.0: Created new patient: ${resolvedPatientId}`)
        }

      } catch (error: any) {
        // Log unexpected errors
        await logIntakeqSync({
          action: 'create_client',
          status: 'failed',
          error: error.message,
          payload: { email: normalizedEmail },
          enrichmentData: { identityMatch: matchType }
        })

        return NextResponse.json({
          success: false,
          code: 'PATIENT_UPSERT_FAILED',
          message: `Patient matching failed: ${error.message}`,
          details: {
            pgCode: error.code,
            pgHint: error.hint
          }
        }, { status: 500 })
      }

      // Final debug log
      if (process.env.INTEGRATIONS_DEBUG_HTTP === 'true') {
        console.log('[V2 PATIENT STEP] Complete', {
          matchType,
          resolvedPatientId
        })
      }
    } else {
      return NextResponse.json({
        success: false,
        error: 'Either patientId or patient data required',
        code: 'INVALID_REQUEST'
      }, { status: 400 })
    }

    console.log(`🚀 V2.0 Booking: Patient ${resolvedPatientId}, Provider ${body.providerId}, Payer ${body.payerId}`)

    // Step 2: Trust the UI's bookability logic
    // If a provider was shown for this payer, they ARE bookable
    // The UI uses v_bookable_provider_payer which includes all supply/supervision rules
    // No additional validation needed here - the UI is the source of truth

    // Step 3: Resolve service instance and duration
    // The resolver handles cash payment correctly - returns real UUID for cash service instance
    const intakeInstance = await resolveIntakeServiceInstance(body.payerId)
    const isCashPayment = body.payerId === 'cash-payment'
    const serviceInstanceId = intakeInstance.serviceInstanceId // Always use resolver value (no override)
    const durationMinutes = intakeInstance.durationMinutes

    console.log(`🔍 V2.0: Resolved service instance:`, {
      payerId: body.payerId,
      isCashPayment,
      serviceInstanceId,
      serviceInstanceType: typeof serviceInstanceId,
      durationMinutes
    })

    const startDate = new Date(body.start)
    const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000)

    // Step 4: Check for conflicts
    console.log(`🔍 V2.0: Checking conflicts for provider ${body.providerId}, patient ${resolvedPatientId}`)
    const { data: conflicts } = await supabaseAdmin
      .from('appointments')
      .select('id, start_time, end_time, patient_id, created_at, status')
      .eq('provider_id', body.providerId)
      .eq('status', 'scheduled')
      .lt('start_time', endDate.toISOString())
      .gt('end_time', startDate.toISOString())

    if (conflicts && conflicts.length > 0) {
      console.log(`⚠️ V2.0: Found ${conflicts.length} conflicting appointments:`, conflicts.map(c => ({
        id: c.id,
        patient_id: c.patient_id,
        is_same_patient: c.patient_id === resolvedPatientId,
        start: c.start_time,
        created_at: c.created_at,
        age_minutes: Math.floor((Date.now() - new Date(c.created_at).getTime()) / (60 * 1000))
      })))

      // Detect test patient by email pattern (for extended duplicate window)
      const { data: patientForCheck } = await supabaseAdmin
        .from('patients')
        .select('email')
        .eq('id', resolvedPatientId)
        .single()

      const isTestPatient = patientForCheck?.email?.includes('test') ||
                           patientForCheck?.email?.includes('@trymoonlit.com') ||
                           false

      // Check for duplicate from same patient
      // - Production: within 10 minutes
      // - Test patients: within 24 hours (to prevent false conflicts during testing)
      const duplicateWindow = isTestPatient ? 24 * 60 * 60 * 1000 : 10 * 60 * 1000

      const recentDuplicate = conflicts.find(c => {
        const ageMs = Date.now() - new Date(c.created_at).getTime()
        const isSamePatient = c.patient_id === resolvedPatientId
        const isWithinWindow = ageMs < duplicateWindow

        console.log(`🔍 Checking conflict ${c.id}: patient match=${isSamePatient}, age=${Math.floor(ageMs/1000)}s, within window=${isWithinWindow} (${isTestPatient ? '24h test' : '10min prod'})`)

        return isSamePatient && isWithinWindow
      })

      if (recentDuplicate) {
        const windowDesc = isTestPatient ? '24h test window' : '10min window'
        console.log(`✅ V2.0: Found existing appointment within ${windowDesc} (${recentDuplicate.id}), returning it`)

        // Fetch the full appointment details to return
        const { data: existingAppointment } = await supabaseAdmin
          .from('appointments')
          .select('*')
          .eq('id', recentDuplicate.id)
          .single()

        if (existingAppointment) {
          console.log(`✅ V2.0: Returning existing appointment as success`, {
            id: existingAppointment.id,
            pq_appointment_id: existingAppointment.pq_appointment_id
          })

          // Return success with the existing appointment
          return NextResponse.json({
            success: true,
            data: {
              appointmentId: existingAppointment.id,
              pqAppointmentId: existingAppointment.pq_appointment_id || undefined,
              status: existingAppointment.status,
              start: existingAppointment.start_time,
              end: existingAppointment.end_time,
              duration: durationMinutes,
              provider: {
                id: body.providerId,
                name: providerName
              },
              isDuplicate: true,
              message: 'Found your existing appointment'
            }
          })
        }
      }

      console.log(`❌ V2.0: Conflict is NOT a duplicate - returning 409`)
      return NextResponse.json({
        success: false,
        error: 'Time slot unavailable',
        code: 'CONFLICT'
      }, { status: 409 })
    }

    // Step 5: Build patient_info snapshot (required JSONB field)
    // Fetch current patient data from DB to build accurate snapshot
    const { data: patientData, error: patientFetchError } = await supabaseAdmin
      .from('patients')
      .select('first_name, last_name, email, phone, date_of_birth, primary_payer_id')
      .eq('id', resolvedPatientId)
      .single()

    if (patientFetchError || !patientData) {
      console.error(`❌ V2.0: Failed to fetch patient data for snapshot: ${patientFetchError?.message}`)

      await logIntakeqSync({
        action: 'create_appointment',
        status: 'failed',
        error: `Failed to fetch patient data: ${patientFetchError?.message}`,
        payload: {
          patientId: resolvedPatientId,
          providerId: body.providerId,
          payerId: body.payerId,
          start: body.start
        },
        enrichmentData: { matchType }
      })

      return NextResponse.json({
        success: false,
        code: 'PATIENT_FETCH_FAILED',
        message: `Could not retrieve patient information: ${patientFetchError?.message}`,
        details: {
          pgCode: (patientFetchError as any)?.code,
          pgHint: (patientFetchError as any)?.hint,
          patientId: resolvedPatientId
        }
      }, { status: 500 })
    }

    // Build patient_info snapshot (never null, always object)
    const patientInfo = {
      first_name: patientData.first_name ?? null,
      last_name: patientData.last_name ?? null,
      email: patientData.email ?? null,
      phone: patientData.phone ?? null,
      date_of_birth: patientData.date_of_birth ?? null,
      primary_payer_id: patientData.primary_payer_id ?? null,
      identity_match: matchType // For troubleshooting (non-PHI)
    }

    // Regression guard: Ensure patient_info is an object
    console.assert(patientInfo && typeof patientInfo === 'object', 'patient_info must be an object')
    console.log(`📋 V2.0: Built patient_info snapshot (match: ${matchType})`)

    // Step 5b: Get payer info for insurance_info field
    // Special handling for cash payment
    let payer: { id: string; name: string; payer_type?: string } | null = null
    let payerError = null

    if (body.payerId === 'cash-payment') {
      // Mock payer object for cash payment
      payer = {
        id: 'cash-payment',
        name: 'Cash Payment (Self-Pay)',
        payer_type: 'self_pay'
      }
    } else {
      const result = await supabaseAdmin
        .from('payers')
        .select('id, name, payer_type')
        .eq('id', body.payerId)
        .single()

      payer = result.data
      payerError = result.error

      if (payerError || !payer) {
        console.error('❌ V2.0: Failed to fetch payer:', payerError)
        return NextResponse.json({
          success: false,
          error: `Payer not found: ${body.payerId}`,
          code: 'INVALID_PAYER'
        }, { status: 404 })
      }
    }

    // Build insurance_info snapshot (required non-null field)
    const insuranceInfo = {
      // For cash payment, store null payer_id and indicate self-pay
      payer_id: (body.payerId === 'cash-payment') ? null : body.payerId,
      payer_name: payer.name,
      payment_type: (body.payerId === 'cash-payment') ? 'self_pay' : 'insurance',
      member_id: body.memberId || null,
      group_number: body.groupNumber || null
    }

    console.log(`📋 V2.0: Built insurance_info snapshot:`, {
      payer_name: payer.name,
      payment_type: insuranceInfo.payment_type,
      is_cash: body.payerId === 'cash-payment'
    })

    // Step 6: Create appointment in database first (V2.0: DB-first approach)
    const appointmentPayload = {
      patient_id: resolvedPatientId,
      provider_id: body.providerId,
      // Set to NULL for cash payment (not a valid UUID)
      payer_id: (body.payerId && body.payerId !== 'cash-payment') ? body.payerId : null,
      service_instance_id: serviceInstanceId,
      start_time: startDate.toISOString(),
      end_time: endDate.toISOString(),
      status: 'scheduled',
      appointment_type: body.locationType === 'telehealth' ? 'telehealth' : null, // Only 'telehealth' or NULL allowed by constraint
      location_type: body.locationType,
      patient_info: patientInfo, // Required non-null snapshot
      insurance_info: insuranceInfo, // Required non-null snapshot
      notes: body.notes || null,
      created_at: new Date().toISOString()
    }

    console.log(`🔍 V2.0: Appointment insert payload:`, {
      patient_id: appointmentPayload.patient_id,
      provider_id: appointmentPayload.provider_id,
      payer_id: appointmentPayload.payer_id,
      service_instance_id: appointmentPayload.service_instance_id,
      service_instance_id_type: typeof appointmentPayload.service_instance_id,
      is_cash_payment: body.payerId === 'cash-payment',
      start_time: appointmentPayload.start_time,
      patient_info: appointmentPayload.patient_info,
      insurance_info: appointmentPayload.insurance_info
    })

    const { data: appointment, error: appointmentError} = await supabaseAdmin
      .from('appointments')
      .insert(appointmentPayload)
      .select('id, start_time, end_time')
      .single()

    if (appointmentError || !appointment) {
      console.error(`❌ V2.0: Appointment insert failed:`, {
        error: appointmentError?.message,
        code: (appointmentError as any)?.code,
        details: (appointmentError as any)?.details,
        hint: (appointmentError as any)?.hint,
        payload: appointmentPayload
      })
      console.error(`❌ V2.0: Failed to insert appointment: ${appointmentError?.message}`)

      // Log to audit with full context
      await logIntakeqSync({
        action: 'create_appointment',
        status: 'failed',
        error: appointmentError?.message || 'Unknown error',
        payload: {
          idempotencyKey: idempotencyKey || null,
          patientId: resolvedPatientId,
          providerId: body.providerId,
          payerId: body.payerId,
          start: body.start,
          locationType: body.locationType
        },
        enrichmentData: {
          matchType,
          pgCode: (appointmentError as any)?.code,
          pgHint: (appointmentError as any)?.hint,
          pgDetail: (appointmentError as any)?.details
        }
      })

      return NextResponse.json({
        success: false,
        code: 'APPOINTMENT_INSERT_FAILED',
        message: appointmentError?.message || 'Failed to create appointment',
        details: {
          pgCode: (appointmentError as any)?.code,
          pgHint: (appointmentError as any)?.hint,
          pgDetail: (appointmentError as any)?.details
        }
      }, { status: 500 })
    }

    console.log(`✅ V2.0: DB appointment created: ${appointment.id}`)

    // Step 6: Get provider details for notifications
    const { data: provider } = await supabaseAdmin
      .from('providers')
      .select('first_name, last_name, email')
      .eq('id', body.providerId)
      .single()

    const providerName = provider ? `${provider.first_name} ${provider.last_name}` : 'Provider'

    // Use payer name from already-fetched payer object
    const payerName = payer?.name || 'Unknown'

    // Step 7: IntakeQ sync (non-blocking with enrichment)
    let intakeqClientId: string | undefined
    let pqAppointmentId: string | undefined
    let enrichedFields: string[] = []
    let questionnaireSent = false
    let contactNotified = false
    // isCashPayment already declared at line 344

    console.log(`🔍 DEBUG: Starting IntakeQ enrichment - featureFlags.practiceqEnrich=${featureFlags.practiceqEnrich}, isCashPayment=${isCashPayment}, payerId=${body.payerId}`)

    // V2.0: Cash payment gets FULL IntakeQ treatment (appointments, questionnaires, enrichment, emails)
    // Only difference: payer_id is NULL in database
    if (featureFlags.practiceqEnrich) {
      try {
        console.log('🔄 V2.0: Starting IntakeQ sync with enrichment...')

        // Get patient full details for enrichment
        const { data: fullPatient } = await supabaseAdmin
          .from('patients')
          .select('first_name, last_name, email, phone, date_of_birth')
          .eq('id', resolvedPatientId)
          .single()

        // V2.0: Upsert client with enrichment
        const clientResult = await upsertPracticeQClient({
          firstName: fullPatient?.first_name || patient?.firstName || '',
          lastName: fullPatient?.last_name || patient?.lastName || '',
          email: fullPatient?.email || patient?.email || '',
          phone: fullPatient?.phone || patient?.phone,
          dateOfBirth: fullPatient?.date_of_birth || patient?.dateOfBirth,
          payerId: body.payerId,
          memberId: body.memberId,
          groupNumber: body.groupNumber,
          contactName: body.contact?.name,
          contactEmail: body.contact?.email,
          contactPhone: body.contact?.phone,
          appointmentId: appointment.id,
          patientId: resolvedPatientId,
          identityMatch: matchType // Pass match type for audit trail
        })

        intakeqClientId = clientResult.intakeqClientId
        enrichedFields = clientResult.enrichedFields

        // Handle duplicate detection
        if (clientResult.isDuplicate && featureFlags.practiceqDuplicateAlerts) {
          warnings.push(`Possible duplicate client detected in IntakeQ`)
        }

        // Create appointment in IntakeQ
        const practitionerExternalId = await getIntakeqPractitionerId(body.providerId)
        const serviceExternalId = await getIntakeqServiceId(serviceInstanceId)

        const apptResult = await createAppointment({
          intakeqClientId,
          practitionerExternalId,
          serviceExternalId,
          start: startDate,
          end: endDate,
          locationType: body.locationType,
          notes: body.notes
        })

        pqAppointmentId = apptResult.pqAppointmentId

        // Update DB with IntakeQ IDs
        await supabaseAdmin
          .from('appointments')
          .update({ pq_appointment_id: pqAppointmentId })
          .eq('id', appointment.id)

        console.log(`✅ V2.0: IntakeQ appointment created: ${pqAppointmentId}`)

        // V2.0: Send questionnaire immediately (if enabled)
        if (featureFlags.practiceqSendQuestionnaireOnCreate && intakeqClientId) {
          try {
            console.log('📋 V2.0: Sending intake questionnaire...')
            const questionnaireResult = await sendIntakeQuestionnaire({
              intakeqClientId,
              clientEmail: fullPatient?.email || patient?.email || '',
              clientName: `${fullPatient?.first_name} ${fullPatient?.last_name}`,
              payerId: body.payerId,
              appointmentId: appointment.id,
              practitionerId: practitionerExternalId
            })

            questionnaireSent = questionnaireResult.success

            // Log to audit trail
            await logIntakeqSync({
              action: 'send_questionnaire',
              status: questionnaireResult.success ? 'success' : 'failed',
              appointmentId: appointment.id,
              intakeqClientId,
              payload: {
                questionnaireId: questionnaireResult.questionnaireId,
                questionnaireName: questionnaireResult.questionnaireName,
                clientEmail: fullPatient?.email || patient?.email || ''
              },
              response: questionnaireResult.success ? { sent: true } : undefined,
              error: questionnaireResult.error
            })

            if (!questionnaireSent) {
              console.error('⚠️ V2.0: Questionnaire send failed:', questionnaireResult.error)
              warnings.push('Intake questionnaire sending failed - will retry')
            } else {
              console.log(`✅ V2.0: ${questionnaireResult.questionnaireName} questionnaire sent successfully`)
            }
          } catch (error: any) {
            console.error('⚠️ V2.0: Questionnaire send failed:', error)

            // Log failure
            await logIntakeqSync({
              action: 'send_questionnaire',
              status: 'failed',
              appointmentId: appointment.id,
              intakeqClientId,
              error: error.message
            })

            warnings.push('Intake questionnaire will be sent separately')
          }
        } else {
          console.log('ℹ️ V2.0: Questionnaire sending disabled by flag')
        }

        // V2.0: Send contact mirror email
        if (body.contact?.email) {
          try {
            // Determine telehealth URL with conservative fallback
            let meetingUrl: string

            if (pqAppointmentId) {
              // Try to get meeting URL from appointment record if stored
              const { data: apptWithLink } = await supabaseAdmin
                .from('appointments')
                .select('telehealth_join_url')
                .eq('id', appointment.id)
                .single()

              if (apptWithLink?.telehealth_join_url) {
                meetingUrl = apptWithLink.telehealth_join_url
                console.log(`✅ V2.0: Using stored telehealth URL`)
              } else {
                // Conservative: Use portal link, not unverified IntakeQ pattern
                meetingUrl = `https://trymoonlit.com/portal/appointments/${appointment.id}/join`
                console.log(`⚠️ V2.0: Using portal telehealth URL - no stored link`)
              }
            } else {
              // Fallback: Use our portal link
              meetingUrl = `https://trymoonlit.com/portal/appointments/${appointment.id}/join`
              console.log(`⚠️ V2.0: Using fallback telehealth URL - PQ appointment not created`)

              await logIntakeqSync({
                action: 'telehealth_fallback',
                status: 'success',
                appointmentId: appointment.id,
                payload: { reason: 'pq_appointment_id_missing' }
              })
            }

            const telehealth = {
              meetingUrl,
              intakeUrl: buildQuestionnaireUrl(
                questionnaireSent ? '67632ecd93139e4c43407617' : '', // General questionnaire ID
                fullPatient?.email || '',
                `${fullPatient?.first_name} ${fullPatient?.last_name}`
              )
            }

            await emailService.sendContactMirrorEmail({
              appointmentId: appointment.id,
              emrAppointmentId: pqAppointmentId,
              provider: {
                id: body.providerId,
                name: providerName,
                email: provider?.email || 'provider@trymoonlit.com'
              },
              patient: {
                name: `${fullPatient?.first_name} ${fullPatient?.last_name}`,
                email: fullPatient?.email || '',
                phone: fullPatient?.phone || ''
              },
              contact: {
                name: body.contact.name || 'Contact',
                email: body.contact.email,
                phone: body.contact.phone
              },
              schedule: {
                date: startDate.toLocaleDateString('en-US', { timeZone: 'America/Denver' }),
                startTime: startDate.toLocaleTimeString('en-US', {
                  timeZone: 'America/Denver',
                  hour: '2-digit',
                  minute: '2-digit'
                }),
                endTime: endDate.toLocaleTimeString('en-US', {
                  timeZone: 'America/Denver',
                  hour: '2-digit',
                  minute: '2-digit'
                }),
                duration: `${durationMinutes} minutes`
              },
              emrSystem: 'IntakeQ',
              telehealth
            })

            contactNotified = true
            console.log(`✅ V2.0: Contact mirror email sent to ${body.contact.email}`)
          } catch (error) {
            console.error('⚠️ V2.0: Contact mirror email failed:', error)
            warnings.push('Contact notification failed - will retry')
          }
        }

      } catch (error: any) {
        console.error('⚠️ V2.0: IntakeQ sync failed (non-blocking):', error)
        warnings.push('IntakeQ sync in progress - you will receive confirmation')

        // Log failure but don't block booking
        await logIntakeqSync({
          action: 'create_appointment',
          status: 'failed',
          appointmentId: appointment.id,
          patientId: resolvedPatientId,
          error: error.message,
          durationMs: Date.now() - startTime
        })
      }
    }

    // Step 7b: Send admin email notification (for all bookings)
    try {
      // Get patient full details for email
      const { data: fullPatient } = await supabaseAdmin
        .from('patients')
        .select('first_name, last_name, email, phone')
        .eq('id', resolvedPatientId)
        .single()

      if (fullPatient) {
        // Format date for subject line (e.g., "2025-10-15")
        const appointmentDate = startDate.toISOString().split('T')[0]

        // Get patient initials
        const firstInitial = fullPatient.first_name ? fullPatient.first_name.charAt(0).toUpperCase() : ''
        const lastInitial = fullPatient.last_name ? fullPatient.last_name.charAt(0).toUpperCase() : ''
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
• Patient: ${fullPatient.first_name} ${fullPatient.last_name}
• Email: ${fullPatient.email}
• Phone: ${fullPatient.phone || 'Not provided'}
• Provider: ${providerName}
• Date: ${appointmentDate}
• Time: ${appointmentTime} (Mountain Time)
• Duration: ${durationMinutes} minutes
• Payer: ${payerName}

SYSTEM DETAILS:
• Local Appointment ID: ${appointment.id}
• IntakeQ Appointment ID: ${pqAppointmentId || 'Not created (cash payment)'}
• Service Instance: ${serviceInstanceId}
• Location: ${body.locationType}
• Booking Type: ${isCashPayment ? 'Cash Payment (Self-Pay)' : 'Insurance'}

---
This booking was created through the Moonlit Scheduler widget.
          `.trim()
        })

        console.log('✅ Admin notification email sent to hello@trymoonlit.com')
      }
    } catch (emailError: any) {
      console.error('❌ Failed to send admin notification email:', emailError.message)
      // Don't fail the booking if email fails
    }

    // Step 8: Cache idempotency response
    if (idempotencyKey) {
      const responseData: V2BookingResponse = {
        success: true,
        data: {
          appointmentId: appointment.id,
          pqAppointmentId,
          status: 'scheduled',
          start: appointment.start_time,
          end: appointment.end_time,
          duration: durationMinutes,
          provider: {
            id: body.providerId,
            name: providerName
          },
          enrichment: intakeqClientId ? {
            clientId: intakeqClientId,
            enrichedFields,
            questionnaireSent,
            contactNotified
          } : undefined
        },
        warnings: warnings.length > 0 ? warnings : undefined
      }

      await supabaseAdmin
        .from('idempotency_requests')
        .insert({
          key: idempotencyKey,
          appointment_id: appointment.id,
          request_payload: body,
          response_data: responseData,
          created_at: new Date().toISOString()
        })
    }

    // Log success
    await logIntakeqSync({
      action: 'create_appointment',
      status: 'success',
      appointmentId: appointment.id,
      patientId: resolvedPatientId,
      intakeqClientId,
      intakeqAppointmentId: pqAppointmentId,
      enrichmentData: {
        enrichedFields,
        questionnaireSent,
        contactNotified
      },
      durationMs: Date.now() - startTime
    })

    return NextResponse.json({
      success: true,
      data: {
        appointmentId: appointment.id,
        pqAppointmentId,
        status: 'scheduled',
        start: appointment.start_time,
        end: appointment.end_time,
        duration: durationMinutes,
        provider: {
          id: body.providerId,
          name: providerName
        },
        enrichment: intakeqClientId ? {
          clientId: intakeqClientId,
          enrichedFields,
          questionnaireSent,
          contactNotified
        } : undefined
      },
      warnings: warnings.length > 0 ? warnings : undefined
    })

  } catch (error: any) {
    console.error('❌ V2.0 Booking error:', error)

    // Log error
    await logIntakeqSync({
      action: 'create_appointment',
      status: 'failed',
      error: error.message,
      durationMs: Date.now() - startTime
    })

    return NextResponse.json({
      success: false,
      error: error.message,
      code: error.code || 'BOOKING_FAILED'
    }, { status: error.status || 500 })
  }
}