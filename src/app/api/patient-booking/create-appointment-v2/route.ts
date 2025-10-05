// NEW SIMPLE APPROACH: Direct IntakeQ integration without complex triggers
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { DateTime } from 'luxon'
import { intakeQService } from '@/lib/services/intakeQService'
import { emailService } from '@/lib/services/emailService'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

interface AppointmentRequest {
  providerId: string
  serviceInstanceId: string
  payerId: string
  date: string
  time: string
  duration?: number
  patient: {
    firstName: string
    lastName: string
    email: string
    phone: string
    dateOfBirth?: string
  }
  insurance?: {
    policyNumber?: string
    groupNumber?: string
    memberName?: string
  }
  roiContacts?: any[]
  appointmentType?: string
  reason?: string
  createInEMR?: boolean
  isTest?: boolean
}

export async function POST(request: NextRequest) {
  try {
    const data: AppointmentRequest = await request.json()

    const {
      providerId,
      serviceInstanceId,
      payerId,
      date,
      time,
      duration = 60,
      patient,
      insurance = {},
      roiContacts = [],
      appointmentType = 'telehealth',
      reason = 'Scheduled appointment',
      createInEMR = true,
      isTest = false
    } = data

    console.log('📨 V2 API - Creating appointment:', {
      providerId,
      serviceInstanceId,
      payerId,
      date,
      time,
      patient: `${patient.firstName} ${patient.lastName}`,
      isTest
    })

    // Validate required fields
    if (!providerId || !serviceInstanceId || !payerId || !date || !time ||
        !patient?.firstName || !patient?.lastName || !patient?.phone) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields',
          required: ['providerId', 'serviceInstanceId', 'payerId', 'date', 'time', 'patient.firstName', 'patient.lastName', 'patient.phone']
        },
        { status: 400 }
      )
    }

    // Get provider details
    const { data: provider, error: providerError } = await supabase
      .from('providers')
      .select('id, first_name, last_name, email, intakeq_practitioner_id, is_active, is_bookable')
      .eq('id', providerId)
      .single()

    if (providerError || !provider) {
      console.error('❌ Provider not found:', providerError)
      return NextResponse.json(
        { success: false, error: 'Provider not found' },
        { status: 404 }
      )
    }

    if (!provider.is_active || !provider.is_bookable) {
      return NextResponse.json(
        { success: false, error: 'Provider not available for booking' },
        { status: 400 }
      )
    }

    // Construct timezone-aware timestamps
    const start = DateTime.fromISO(`${date}T${time}`, { zone: 'America/Denver' }).toUTC().toISO();
    const end = DateTime.fromISO(`${date}T${time}`, { zone: 'America/Denver' })
      .plus({ minutes: duration })
      .toUTC()
      .toISO();

    if (!start || !end) {
      return NextResponse.json(
        { success: false, error: 'Invalid date/time format' },
        { status: 400 }
      );
    }

    console.log('⏰ V2 - Timestamps:', {
      local: `${date}T${time} America/Denver`,
      startUTC: start,
      endUTC: end
    })

    // STEP 1: Check for conflicts in Supabase
    const { data: conflicts } = await supabase
      .from('appointments')
      .select('id, start_time, end_time, status')
      .eq('provider_id', providerId)
      .gte('start_time', DateTime.fromISO(start!).minus({ hours: 1 }).toISO())
      .lte('start_time', DateTime.fromISO(start!).plus({ hours: 1 }).toISO())
      .neq('status', 'cancelled')

    if (conflicts && conflicts.length > 0) {
      const exactOverlap = conflicts.find(apt => {
        const aptStart = new Date(apt.start_time).getTime()
        const aptEnd = new Date(apt.end_time).getTime()
        const newStart = new Date(start!).getTime()
        const newEnd = new Date(end!).getTime()
        return (newStart < aptEnd && newEnd > aptStart)
      })

      if (exactOverlap) {
        console.log('❌ Conflict in Supabase:', exactOverlap.id)
        return NextResponse.json(
          {
            success: false,
            error: 'TIME_CONFLICT',
            details: 'This time slot is no longer available.'
          },
          { status: 409 }
        )
      }
    }

    // STEP 2: Check for conflicts in IntakeQ (if provider has IntakeQ ID)
    if (provider.intakeq_practitioner_id && createInEMR && !isTest) {
      try {
        const intakeQAppointments = await intakeQService.getAppointmentsForDate(
          provider.intakeq_practitioner_id,
          date
        )

        const intakeQConflict = intakeQAppointments.some(apt => {
          const aptStart = new Date(apt.StartDate).getTime()
          const aptEnd = new Date(apt.EndDate || aptStart + 60 * 60 * 1000).getTime()
          const newStart = new Date(start!).getTime()
          const newEnd = new Date(end!).getTime()
          return (newStart < aptEnd && newEnd > aptStart)
        })

        if (intakeQConflict) {
          console.log('❌ Conflict in IntakeQ')
          return NextResponse.json(
            {
              success: false,
              error: 'TIME_CONFLICT',
              details: 'This time slot is already booked in IntakeQ.'
            },
            { status: 409 }
          )
        }
      } catch (error) {
        console.error('⚠️ IntakeQ conflict check failed (non-fatal):', error)
        // Continue - we'll catch this when creating the appointment
      }
    }

    // STEP 3: Insert appointment in Supabase
    const appointmentData = {
      provider_id: providerId,
      service_instance_id: serviceInstanceId,
      payer_id: payerId,
      start_time: start,
      end_time: end,
      timezone: 'America/Denver',
      status: 'scheduled',
      appointment_type: appointmentType,
      patient_info: {
        first_name: patient.firstName,
        last_name: patient.lastName,
        email: patient.email,
        phone: patient.phone,
        date_of_birth: patient.dateOfBirth || null
      },
      insurance_info: {
        payer_id: payerId,
        policy_number: insurance.policyNumber || null,
        group_number: insurance.groupNumber || null,
        member_name: insurance.memberName || null
      },
      roi_contacts: roiContacts,
      notes: reason,
      booking_source: 'widget',
      is_test: isTest,
      athena_appointment_id: null // Will be populated later if needed
    }

    console.log('💾 V2 - Inserting to Supabase...')

    const { data: appointment, error: insertError } = await supabase
      .from('appointments')
      .insert([appointmentData])
      .select('id')
      .single()

    if (insertError || !appointment?.id) {
      console.error('❌ V2 - Supabase insert failed:', insertError)
      return NextResponse.json(
        {
          success: false,
          error: 'DB_INSERT_FAILED',
          details: insertError?.message || 'Failed to create appointment in database'
        },
        { status: 500 }
      )
    }

    console.log('✅ V2 - Appointment created in Supabase:', appointment.id)

    // STEP 4: Create in IntakeQ (if enabled)
    let intakeQAppointmentId = null
    if (provider.intakeq_practitioner_id && createInEMR && !isTest) {
      // Check if provider has IntakeQ service/location configured via join table
      const { data: intakeqSettings } = await supabase
        .from('provider_intakeq_settings')
        .select('practitioner_id, service_id, location_id')
        .eq('provider_id', providerId)
        .single()

      if (!intakeqSettings?.service_id || !intakeqSettings?.location_id) {
        console.log('⚠️ V2 - Provider missing IntakeQ settings (service_id or location_id), skipping IntakeQ creation')
      } else {
        try {
          console.log('📤 V2 - Creating in IntakeQ...', {
            practitionerId: intakeqSettings.practitioner_id,
            serviceId: intakeqSettings.service_id,
            locationId: intakeqSettings.location_id
          })

          intakeQAppointmentId = await intakeQService.createAppointment({
            practitionerId: intakeqSettings.practitioner_id,
            clientFirstName: patient.firstName,
            clientLastName: patient.lastName,
            clientEmail: patient.email,
            clientPhone: patient.phone,
            clientDateOfBirth: patient.dateOfBirth,
            serviceId: intakeqSettings.service_id,
            locationId: intakeqSettings.location_id,
            dateTime: new Date(start!),
            status: 'Confirmed',
            sendEmailNotification: true
          })

        console.log('✅ V2 - IntakeQ appointment created:', intakeQAppointmentId)

        // Update Supabase with IntakeQ ID
        await supabase
          .from('appointments')
          .update({
            athena_appointment_id: intakeQAppointmentId // Using athena field for IntakeQ ID
          })
          .eq('id', appointment.id)

        // STEP 5: Send intake questionnaire to patient
        try {
          const INTAKE_QUESTIONNAIRE_ID = '687ad30e356f38c6e4b11e62' // Pre-visit intake questionnaire

          await intakeQService.sendQuestionnaire({
            questionnaireId: INTAKE_QUESTIONNAIRE_ID,
            clientName: `${patient.firstName} ${patient.lastName}`,
            clientEmail: patient.email,
            practitionerId: intakeqSettings.practitioner_id,
            clientPhone: patient.phone
          })

          console.log('✅ V2 - Intake questionnaire sent to patient')
        } catch (questionnaireError: any) {
          console.error('⚠️ V2 - Failed to send intake questionnaire:', questionnaireError.message)
          // Non-fatal - appointment is still created
        }

        // STEP 6: Send admin notification email
        try {
          await emailService.sendAppointmentNotifications({
            appointmentId: appointment.id,
            emrAppointmentId: intakeQAppointmentId || undefined,
            provider: {
              id: providerId,
              name: `${provider.first_name} ${provider.last_name}`,
              email: provider.email || 'noreply@moonlit.health'
            },
            patient: {
              name: `${patient.firstName} ${patient.lastName}`,
              email: patient.email,
              phone: patient.phone
            },
            schedule: {
              date,
              startTime: time,
              endTime: DateTime.fromISO(`${date}T${time}`, { zone: 'America/Denver' })
                .plus({ minutes: duration })
                .toFormat('HH:mm'),
              duration: `${duration} minutes`
            },
            emrSystem: 'IntakeQ'
          })

          console.log('✅ V2 - Admin notification email sent')
        } catch (emailError: any) {
          console.error('⚠️ V2 - Failed to send admin notification:', emailError.message)
          // Non-fatal - appointment is still created
        }

        } catch (intakeQError: any) {
          console.error('❌ V2 - IntakeQ creation failed:', intakeQError.message)
          // Don't fail the whole request - appointment exists in Supabase
          // Admin can manually create in IntakeQ later
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        appointment: {
          id: appointment.id,
          provider_id: providerId,
          start_time: start,
          end_time: end,
          patient_name: `${patient.firstName} ${patient.lastName}`,
          intakeq_appointment_id: intakeQAppointmentId
        }
      }
    })

  } catch (error: any) {
    console.error('💥 V2 - Unexpected error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_ERROR',
        details: error.message
      },
      { status: 500 }
    )
  }
}
