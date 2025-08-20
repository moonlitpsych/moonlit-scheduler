// src/app/api/patient-booking/create-appointment/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { athenaService } from '@/lib/services/athenaService'

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
  createInAthena?: boolean
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
      createInAthena = true
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

    // Get provider details
    const { data: provider, error: providerError } = await supabase
      .from('providers')
      .select('id, first_name, last_name, athena_provider_id, npi')
      .eq('id', providerId)
      .single()

    if (providerError || !provider) {
      return NextResponse.json(
        { success: false, error: 'Provider not found' },
        { status: 404 }
      )
    }

    // Check if provider accepts this payer
    const { data: network, error: networkError } = await supabase
      .from('provider_payer_networks')
      .select('*')
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

    let athenaAppointmentId: string | null = null
    let appointmentStatus = 'scheduled'

    // Create appointment in Athena if enabled and provider has Athena ID
    if (createInAthena && provider.athena_provider_id) {
      try {
        console.log('🏥 Creating appointment in Athena...')
        
        athenaAppointmentId = await athenaService.createAppointment({
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

        console.log(`✅ Athena appointment created: ${athenaAppointmentId}`)
        appointmentStatus = 'confirmed'

      } catch (athenaError: any) {
        console.error('❌ Failed to create appointment in Athena:', athenaError.message)
        
        // Continue with local appointment creation but mark the error
        appointmentStatus = 'scheduled_local_only'
      }
    }

    // Create appointment in local database
    const appointmentData = {
      provider_id: providerId,
      payer_id: payerId,
      athena_appointment_id: athenaAppointmentId,
      start_time: startDateTime.toISOString(),
      end_time: endDateTime.toISOString(),
      status: appointmentStatus,
      appointment_type: appointmentType,
      patient_info: {
        first_name: patient.firstName,
        last_name: patient.lastName,
        email: patient.email,
        phone: patient.phone,
        date_of_birth: patient.dateOfBirth
      },
      notes: reason,
      created_via: 'patient_booking_widget',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .insert(appointmentData)
      .select()
      .single()

    if (appointmentError) {
      console.error('❌ Failed to create appointment in database:', appointmentError)
      
      // If we created in Athena but failed locally, try to cancel Athena appointment
      if (athenaAppointmentId) {
        try {
          await athenaService.cancelAppointment(athenaAppointmentId, 'Database creation failed')
        } catch (cancelError) {
          console.error('❌ Failed to cancel Athena appointment after database error:', cancelError)
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

    // Prepare response
    const response = {
      success: true,
      data: {
        appointment: {
          id: appointment.id,
          athena_appointment_id: athenaAppointmentId,
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
          created_in_athena: !!athenaAppointmentId
        },
        booking_confirmation: {
          confirmation_number: appointment.id,
          athena_confirmation: athenaAppointmentId,
          instructions: athenaAppointmentId 
            ? 'Your appointment has been scheduled in both our system and Athena Health EMR.'
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