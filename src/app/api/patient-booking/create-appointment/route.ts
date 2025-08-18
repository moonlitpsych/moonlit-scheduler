// src/app/api/patient-booking/create-appointment/route.ts
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('📥 Received appointment creation request:', body)

    const {
      provider_id,
      payer_id,
      time_slot,
      patient_info,
      insurance_info,
      roi_contacts,
      booking_scenario,
      case_manager_info,
      communication_preferences
    } = body

    // Validate required fields
    if (!provider_id || !time_slot || !patient_info) {
      return NextResponse.json(
        { error: 'Missing required fields: provider_id, time_slot, patient_info' },
        { status: 400 }
      )
    }

    // Create proper datetime strings from time slot and selected date
    const selectedDate = new Date(time_slot.start_time).toISOString().split('T')[0]
    const timeString = time_slot.start_time.includes('T') 
      ? time_slot.start_time.split('T')[1].substring(0, 8)  // Extract time if full ISO
      : time_slot.start_time  // Use as-is if just time

    // Combine date and time properly
    const startDateTime = new Date(`${selectedDate}T${timeString}`)
    const endDateTime = new Date(startDateTime.getTime() + (60 * 60 * 1000)) // Default 1 hour duration

    console.log('🕐 Calculated appointment times:', {
      selectedDate,
      timeString,
      startDateTime: startDateTime.toISOString(),
      endDateTime: endDateTime.toISOString()
    })

    // Get default service instance ID (you may want to make this dynamic)
    const { data: serviceInstance } = await supabase
      .from('service_instances')
      .select('id')
      .eq('service_type', 'telehealth')
      .limit(1)
      .single()

    if (!serviceInstance) {
      console.error('❌ No service instance found')
      return NextResponse.json(
        { error: 'No service instance available' },
        { status: 500 }
      )
    }

    // Create appointment data
    const appointmentData = {
      provider_id,
      service_instance_id: serviceInstance.id,
      payer_id: payer_id || null,
      start_time: startDateTime.toISOString(),
      end_time: endDateTime.toISOString(),
      timezone: 'America/Denver',
      patient_info: {
        first_name: patient_info.first_name,
        last_name: patient_info.last_name,
        date_of_birth: patient_info.date_of_birth,
        email: patient_info.email,
        phone: patient_info.phone,
        address: patient_info.address || null,
        emergency_contact: patient_info.emergency_contact || null
      },
      insurance_info: insurance_info ? {
        payer_name: insurance_info.payer_name,
        member_id: insurance_info.member_id,
        group_number: insurance_info.group_number,
        effective_date: insurance_info.effective_date
      } : null,
      roi_contacts: roi_contacts && roi_contacts.length > 0 ? roi_contacts : null,
      appointment_type: 'telehealth',
      status: 'scheduled',
      booking_source: 'widget',
      notes: `Booking scenario: ${booking_scenario}${case_manager_info ? ` | Case manager: ${case_manager_info.name} (${case_manager_info.email})` : ''}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    console.log('💾 Creating appointment with data:', appointmentData)

    // Insert appointment into database
    const { data: appointment, error: insertError } = await supabase
      .from('appointments')
      .insert([appointmentData])
      .select(`
        *,
        provider:providers(first_name, last_name, title, email),
        payer:payers(name, display_name),
        service_instance:service_instances(service_name, location_name)
      `)
      .single()

    if (insertError) {
      console.error('❌ Error inserting appointment:', insertError)
      return NextResponse.json(
        { error: 'Failed to create appointment: ' + insertError.message },
        { status: 500 }
      )
    }

    console.log('✅ Appointment created successfully:', appointment.id)

    // Generate confirmation code
    const confirmationCode = generateConfirmationCode()

    // Update appointment with confirmation code
    const { error: updateError } = await supabase
      .from('appointments')
      .update({ 
        confirmation_code: confirmationCode,
        updated_at: new Date().toISOString()
      })
      .eq('id', appointment.id)

    if (updateError) {
      console.error('⚠️ Error updating confirmation code:', updateError)
      // Don't fail the request for this
    }

    // TODO: Send confirmation email based on communication preferences
    // TODO: Notify case manager if applicable
    // TODO: Update provider availability cache

    const response = {
      success: true,
      appointment: {
        ...appointment,
        confirmation_code: confirmationCode
      },
      message: 'Appointment created successfully'
    }

    console.log('📤 Sending response:', response)
    return NextResponse.json(response)

  } catch (error) {
    console.error('💥 Error in appointment creation:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown error'),
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

function generateConfirmationCode(): string {
  // Generate a 6-character alphanumeric confirmation code
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// Allow CORS for development
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}