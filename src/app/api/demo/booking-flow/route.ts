// src/app/api/demo/booking-flow/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { athenaService } from '@/lib/services/athenaService'

export async function POST(request: NextRequest) {
  try {
    const { 
      step, 
      payer_id, 
      provider_id, 
      date, 
      time, 
      patient_info,
      booking_preference = 'by_availability' // 'by_availability' or 'by_provider'
    } = await request.json()

    console.log(`🎭 Demo: Processing booking flow step "${step}"`)

    switch (step) {
      case 'select_insurance':
        return await handleInsuranceSelection()
      
      case 'show_booking_options':
        return await handleBookingOptions(payer_id)
      
      case 'get_merged_availability':
        return await handleMergedAvailability(payer_id, date)
      
      case 'get_provider_list':
        return await handleProviderList(payer_id)
      
      case 'get_provider_availability':
        return await handleProviderAvailability(provider_id, date)
      
      case 'preview_booking':
        return await handleBookingPreview(payer_id, provider_id, date, time, patient_info)
      
      case 'create_appointment':
        return await handleAppointmentCreation(payer_id, provider_id, date, time, patient_info)
      
      default:
        return NextResponse.json(
          { success: false, error: 'Unknown step' },
          { status: 400 }
        )
    }

  } catch (error: any) {
    console.error('❌ Demo booking flow error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Demo booking flow failed',
        details: error.message
      },
      { status: 500 }
    )
  }
}

async function handleInsuranceSelection() {
  // Get available payers
  const { data: payers, error } = await supabase
    .from('payers')
    .select('id, name')
    .order('name')

  if (error) {
    throw error
  }

  return NextResponse.json({
    success: true,
    demo_mode: true,
    step: 'select_insurance',
    data: {
      payers: payers || [],
      progress: 1,
      total_steps: 6,
      message: 'Select your insurance to see available providers'
    },
    user_story: 'User Story #2: Insurance is accepted by physician',
    next_step: 'show_booking_options'
  })
}

async function handleBookingOptions(payer_id: string) {
  // Show booking preference options
  return NextResponse.json({
    success: true,
    demo_mode: true,
    step: 'show_booking_options',
    data: {
      payer_id,
      booking_options: [
        {
          id: 'by_availability',
          title: 'Book by Availability',
          description: 'See the earliest available appointments from all providers who accept your insurance',
          recommended: true,
          icon: 'calendar'
        },
        {
          id: 'by_provider',
          title: 'Book by Practitioner', 
          description: 'Browse providers first, then see their individual availability',
          recommended: false,
          icon: 'user'
        }
      ],
      progress: 2,
      total_steps: 6,
      message: 'How would you like to find your appointment?'
    },
    user_stories: [
      'User Story #3: Merged availability (default experience)',
      'User Story #10: Option to scroll through all practitioners',
      'User Story #21: Book by Practitioner vs Book by Availability'
    ],
    next_steps: ['get_merged_availability', 'get_provider_list']
  })
}

async function handleMergedAvailability(payer_id: string, date: string) {
  // Use existing merged availability endpoint
  const response = await fetch(`http://localhost:3000/api/patient-booking/merged-availability`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payer_id, date })
  })

  if (!response.ok) {
    throw new Error('Failed to fetch merged availability')
  }

  const availabilityData = await response.json()

  return NextResponse.json({
    success: true,
    demo_mode: true,
    step: 'get_merged_availability',
    data: {
      ...availabilityData.data,
      progress: 3,
      total_steps: 6,
      booking_preference: 'by_availability'
    },
    user_story: 'User Story #3: Merged availability of providers who accept insurance',
    next_step: 'preview_booking'
  })
}

async function handleProviderList(payer_id: string) {
  // Use enhanced providers endpoint
  const response = await fetch(`http://localhost:3000/api/demo/enhanced-providers?payer_id=${payer_id}`)
  
  if (!response.ok) {
    throw new Error('Failed to fetch providers')
  }

  const providersData = await response.json()

  return NextResponse.json({
    success: true,
    demo_mode: true,
    step: 'get_provider_list',
    data: {
      ...providersData.data,
      progress: 3,
      total_steps: 6,
      booking_preference: 'by_provider'
    },
    user_story: 'User Story #22: Provider cards with detailed information',
    next_step: 'get_provider_availability'
  })
}

async function handleProviderAvailability(provider_id: string, date: string) {
  // Get specific provider's availability
  const { data: availability, error } = await supabase
    .from('provider_availability')
    .select('*')
    .eq('provider_id', provider_id)
    .eq('is_recurring', true)

  if (error) {
    throw error
  }

  // Get provider details
  const { data: provider, error: providerError } = await supabase
    .from('providers')
    .select('id, first_name, last_name, title, role')
    .eq('id', provider_id)
    .single()

  if (providerError) {
    throw providerError
  }

  return NextResponse.json({
    success: true,
    demo_mode: true,
    step: 'get_provider_availability',
    data: {
      provider,
      availability: availability || [],
      total_slots: availability?.length || 0,
      progress: 4,
      total_steps: 6,
      booking_preference: 'by_provider'
    },
    user_story: 'User Story #23: Calendar that isolates just that practitioner\'s availability',
    next_step: 'preview_booking'
  })
}

async function handleBookingPreview(
  payer_id: string, 
  provider_id: string, 
  date: string, 
  time: string, 
  patient_info: any
) {
  // Get provider details
  const { data: provider, error: providerError } = await supabase
    .from('providers')
    .select('*')
    .eq('id', provider_id)
    .single()

  if (providerError) {
    throw providerError
  }

  // Get payer details
  const { data: payer, error: payerError } = await supabase
    .from('payers')
    .select('*')
    .eq('id', payer_id)
    .single()

  if (payerError) {
    throw payerError
  }

  return NextResponse.json({
    success: true,
    demo_mode: true,
    step: 'preview_booking',
    data: {
      appointment_preview: {
        provider: {
          name: `Dr. ${provider.first_name} ${provider.last_name}`,
          title: provider.title || provider.role,
          id: provider.id
        },
        patient: {
          name: `${patient_info.firstName} ${patient_info.lastName}`,
          email: patient_info.email,
          phone: patient_info.phone
        },
        insurance: {
          name: payer.name,
          id: payer.id
        },
        appointment: {
          date: date,
          time: time,
          duration: '60 minutes',
          type: 'Initial Consultation'
        },
        next_steps: [
          'You will receive a confirmation email with appointment details',
          'Intake paperwork will be sent 24 hours before your appointment',
          'You can change or cancel your appointment up to 24 hours in advance',
          'If this is a telehealth appointment, you\'ll receive a secure video link'
        ]
      },
      progress: 5,
      total_steps: 6,
      can_modify: true
    },
    user_story: 'User Story #4: Next steps after booking to reduce anxiety',
    next_step: 'create_appointment'
  })
}

async function handleAppointmentCreation(
  payer_id: string, 
  provider_id: string, 
  date: string, 
  time: string, 
  patient_info: any
) {
  console.log('📅 Demo: Creating appointment...')

  try {
    // Create appointment using existing endpoint
    const response = await fetch(`http://localhost:3000/api/patient-booking/create-appointment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        providerId: provider_id,
        payerId: payer_id,
        date: date,
        time: time,
        patient: patient_info,
        createInAthena: true // Test Athena integration
      })
    })

    if (!response.ok) {
      throw new Error('Failed to create appointment')
    }

    const appointmentData = await response.json()

    return NextResponse.json({
      success: true,
      demo_mode: true,
      step: 'create_appointment',
      data: {
        appointment: appointmentData.data.appointment,
        confirmation: appointmentData.data.booking_confirmation,
        integration_status: {
          local_database: '✅ Created',
          athena_emr: appointmentData.data.appointment.created_in_athena ? '✅ Created' : '⚠️ Pending'
        },
        progress: 6,
        total_steps: 6
      },
      user_stories: [
        'User Story #4: Confirmation and next steps provided',
        'Integration with Athena EMR demonstrated'
      ],
      completion: true
    })

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      demo_mode: true,
      step: 'create_appointment',
      error: 'Appointment creation failed',
      details: error.message,
      progress: 5,
      total_steps: 6
    })
  }
}

// GET endpoint for flow documentation
export async function GET() {
  return NextResponse.json({
    demo_mode: true,
    available_steps: [
      'select_insurance',
      'show_booking_options', 
      'get_merged_availability',
      'get_provider_list',
      'get_provider_availability',
      'preview_booking',
      'create_appointment'
    ],
    user_stories_demonstrated: [
      'User Story #2: Insurance validation',
      'User Story #3: Merged availability',
      'User Story #4: Next steps information',
      'User Story #10: Provider browsing option',
      'User Story #21: Book by Practitioner vs Availability',
      'User Story #22: Provider detail cards',
      'User Story #23: Individual provider calendars',
      'User Story #25: Progress indication'
    ],
    integration_features: [
      'Real Supabase data with 13 providers',
      'Real provider-payer relationships',
      'Working Athena EMR integration',
      'Dual appointment creation (local + EMR)',
      'Error handling and rollback'
    ]
  })
}