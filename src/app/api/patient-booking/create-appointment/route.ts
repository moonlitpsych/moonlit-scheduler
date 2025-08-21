// src/app/api/patient-booking/create-appointment/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import { athenaService } from '@/lib/services/athenaService'
import { intakeQService } from '@/lib/services/intakeQService'
import { emailService } from '@/lib/services/emailService'

interface AppointmentRequest {
  providerId: string
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
  appointmentType?: string
  reason?: string
  createInEMR?: boolean // Generic flag for EMR integration (IntakeQ or Athena)
}

export async function POST(request: NextRequest) {
  try {
    const data: AppointmentRequest = await request.json()
    
    const {
      providerId,
      payerId,
      date,
      time,
      duration = 60,
      patient,
      appointmentType = 'consultation',
      reason = 'Scheduled appointment',
      createInEMR = true
    } = data

    // Validate required fields
    if (!providerId || !payerId || !date || !time || !patient.firstName || !patient.lastName || !patient.phone) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields',
          required: ['providerId', 'payerId', 'date', 'time', 'patient.firstName', 'patient.lastName', 'patient.phone']
        },
        { status: 400 }
      )
    }

    console.log('📅 Creating appointment:', {
      provider: providerId,
      payer: payerId,
      date,
      time,
      patient: `${patient.firstName} ${patient.lastName}`
    })

    // Calculate end time
    const startDateTime = new Date(`${date}T${time}`)
    const endDateTime = new Date(startDateTime.getTime() + (duration * 60 * 1000))

    // Determine which EMR system to use
    const currentEMR = process.env.CURRENT_EMR || 'athena' // Default to Athena

    // Get provider details
    const { data: provider, error: providerError } = await supabaseAdmin
      .from('providers')
      .select('id, first_name, last_name, email, athena_provider_id, intakeq_practitioner_id, npi')
      .eq('id', providerId)
      .single()

    if (providerError || !provider) {
      return NextResponse.json(
        { success: false, error: 'Provider not found' },
        { status: 404 }
      )
    }

    // Check if provider accepts this payer and get payer info
    const { data: network, error: networkError } = await supabaseAdmin
      .from('provider_payer_networks')
      .select('*, payers(name)')
      .eq('provider_id', providerId)
      .eq('payer_id', payerId)
      .eq('status', 'in_network')
      .single()

    if (networkError || !network) {
      return NextResponse.json(
        { success: false, error: 'Provider does not accept this insurance' },
        { status: 400 }
      )
    }

    let emrAppointmentId: string | null = null
    let appointmentStatus = 'scheduled'
    let emrSystem = currentEMR

    // Create appointment in the configured EMR system
    if (createInEMR) {
      try {
        if (currentEMR === 'intakeq') {
          // Create appointment in IntakeQ
          console.log('🏥 Creating appointment in IntakeQ...')
          
          // Use provider's specific IntakeQ practitioner ID
          const intakeqPractitionerId = provider.intakeq_practitioner_id
          
          if (!intakeqPractitionerId) {
            throw new Error(`Provider ${provider.first_name} ${provider.last_name} is not mapped to an IntakeQ practitioner`)
          }
          
          console.log(`📋 Using IntakeQ practitioner ID: ${intakeqPractitionerId} for ${provider.first_name} ${provider.last_name}`)
          
          emrAppointmentId = await intakeQService.createAppointment({
            practitionerId: intakeqPractitionerId,
            clientFirstName: patient.firstName,
            clientLastName: patient.lastName,
            clientEmail: patient.email,
            clientPhone: patient.phone,
            clientDateOfBirth: patient.dateOfBirth,
            serviceId: process.env.INTAKEQ_SERVICE_ID || 'default_service',
            locationId: process.env.INTAKEQ_LOCATION_ID || 'default_location',
            dateTime: startDateTime,
            status: 'Confirmed',
            sendEmailNotification: true
          })

          console.log(`✅ IntakeQ appointment created: ${emrAppointmentId}`)
          appointmentStatus = 'confirmed'

        } else if (currentEMR === 'athena' && provider.athena_provider_id) {
          // Create appointment in Athena
          console.log('🏥 Creating appointment in Athena...')
          
          emrAppointmentId = await athenaService.createAppointment({
            providerId: provider.athena_provider_id,
            departmentId: '1', // Default department - should be configured
            appointmentType,
            date,
            startTime: time,
            patientFirstName: patient.firstName,
            patientLastName: patient.lastName,
            patientPhone: patient.phone,
            patientEmail: patient.email,
            reason
          })

          console.log(`✅ Athena appointment created: ${emrAppointmentId}`)
          appointmentStatus = 'confirmed'
        } else {
          console.log(`⚠️ EMR integration skipped: currentEMR=${currentEMR}, provider has required ID: ${currentEMR === 'athena' ? !!provider.athena_provider_id : 'N/A for IntakeQ'}`)
        }

      } catch (emrError: any) {
        console.error(`❌ Failed to create appointment in ${currentEMR.toUpperCase()}:`, emrError.message)
        
        // Continue with local appointment creation but mark the error
        appointmentStatus = 'scheduled'
      }
    }

    // Get a service instance (required for appointments table)
    const { data: serviceInstances, error: serviceError } = await supabaseAdmin
      .from('service_instances')
      .select('id')
      .limit(1)

    if (serviceError || !serviceInstances || serviceInstances.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'No service instances available',
          details: serviceError?.message
        },
        { status: 500 }
      )
    }

    // Create appointment in local database
    const appointmentData = {
      provider_id: providerId,
      payer_id: payerId,
      service_instance_id: serviceInstances[0].id,
      athena_appointment_id: emrAppointmentId, // Store EMR appointment ID here regardless of system
      start_time: startDateTime.toISOString(),
      end_time: endDateTime.toISOString(),
      status: appointmentStatus,
      appointment_type: null, // Skip validation for now
      patient_info: {
        first_name: patient.firstName,
        last_name: patient.lastName,
        email: patient.email,
        phone: patient.phone,
        date_of_birth: patient.dateOfBirth
      },
      insurance_info: {
        payer_id: payerId
      },
      notes: reason
    }

    const { data: appointment, error: appointmentError } = await supabaseAdmin
      .from('appointments')
      .insert(appointmentData)
      .select()
      .single()

    if (appointmentError) {
      console.error('❌ Failed to create appointment in database:', appointmentError)
      
      // If we created in EMR but failed locally, try to cancel EMR appointment
      if (emrAppointmentId) {
        try {
          if (currentEMR === 'athena') {
            await athenaService.cancelAppointment(emrAppointmentId, 'Database creation failed')
          } else if (currentEMR === 'intakeq') {
            await intakeQService.updateAppointmentStatus(emrAppointmentId, 'Cancelled')
          }
        } catch (cancelError) {
          console.error(`❌ Failed to cancel ${currentEMR.toUpperCase()} appointment after database error:`, cancelError)
        }
      }

      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to create appointment',
          details: appointmentError.message
        },
        { status: 500 }
      )
    }

    console.log('✅ Appointment created successfully:', appointment.id)

    // Send email notifications
    try {
      await emailService.sendAppointmentNotifications({
        appointmentId: appointment.id,
        emrAppointmentId: emrAppointmentId,
        provider: {
          id: provider.id,
          name: `${provider.first_name} ${provider.last_name}`,
          email: provider.email || 'unknown@trymoonlit.com' // Fallback if no email
        },
        patient: {
          name: `${patient.firstName} ${patient.lastName}`,
          email: patient.email,
          phone: patient.phone
        },
        schedule: {
          date,
          startTime: time,
          endTime: endDateTime.toTimeString().slice(0, 5),
          duration: `${duration} minutes`
        },
        emrSystem: currentEMR,
        payerName: network.payers?.name || 'Unknown'
      })
    } catch (emailError: any) {
      console.error('⚠️ Email notification failed (appointment still created):', emailError.message)
    }

    // Prepare response
    const response = {
      success: true,
      data: {
        appointment: {
          id: appointment.id,
          emr_appointment_id: emrAppointmentId,
          emr_system: emrSystem,
          athena_appointment_id: emrAppointmentId, // Store EMR ID in athena field for now
          provider: {
            id: provider.id,
            name: `${provider.first_name} ${provider.last_name}`,
            npi: provider.npi
          },
          patient: {
            name: `${patient.firstName} ${patient.lastName}`,
            email: patient.email,
            phone: patient.phone
          },
          schedule: {
            date,
            start_time: time,
            end_time: endDateTime.toTimeString().slice(0, 5),
            duration: `${duration} minutes`
          },
          status: appointmentStatus,
          appointment_type: appointmentType,
          created_in_emr: !!emrAppointmentId,
          created_in_athena: currentEMR === 'athena' && !!emrAppointmentId
        },
        booking_confirmation: {
          confirmation_number: appointment.id,
          emr_confirmation: emrAppointmentId,
          emr_system: emrSystem,
          athena_confirmation: currentEMR === 'athena' ? emrAppointmentId : null,
          instructions: emrAppointmentId 
            ? `Your appointment has been scheduled in both our system and ${emrSystem.toUpperCase()} EMR.`
            : 'Your appointment has been scheduled. EMR integration pending.'
        }
      }
    }

    return NextResponse.json(response)

  } catch (error: any) {
    console.error('❌ Appointment creation failed:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Appointment creation failed',
        details: error.message
      },
      { status: 500 }
    )
  }
}

// GET endpoint to retrieve appointment details
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const appointmentId = searchParams.get('id')
    const athenaId = searchParams.get('athena_id')

    if (!appointmentId && !athenaId) {
      return NextResponse.json(
        { success: false, error: 'Appointment ID or Athena ID required' },
        { status: 400 }
      )
    }

    let query = supabase
      .from('appointments')
      .select(`
        *,
        providers (id, first_name, last_name, npi),
        payers (id, name)
      `)

    if (appointmentId) {
      query = query.eq('id', appointmentId)
    } else if (athenaId) {
      query = query.eq('athena_appointment_id', athenaId)
    }

    const { data: appointment, error } = await query.single()

    if (error || !appointment) {
      return NextResponse.json(
        { success: false, error: 'Appointment not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: appointment
    })

  } catch (error: any) {
    console.error('❌ Error retrieving appointment:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to retrieve appointment',
        details: error.message
      },
      { status: 500 }
    )
  }
}