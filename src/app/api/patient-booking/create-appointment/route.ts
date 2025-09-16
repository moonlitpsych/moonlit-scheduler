// Ensure this runs on Node.js runtime for full feature support
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { DateTime } from 'luxon'
import crypto from 'crypto'

// Use service role to avoid RLS blocks on inserts
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! // Must be present in env
);

// One-time boolean log (no secrets)
console.log('BOOKING DEBUG: service role present?', !!process.env.SUPABASE_SERVICE_KEY);

interface AppointmentRequest {
  providerId: string
  serviceInstanceId: string // Required - no fallback
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
  appointmentType?: string
  reason?: string
  createInEMR?: boolean
  isTest?: boolean // For testing purposes
}

// Simple background EMR queue (fire-and-forget)
async function enqueueCreateInEMR(params: { 
  appointmentId: string, 
  providerId: string, 
  start: string 
}): Promise<void> {
  // In production, this would use a proper job queue
  // For now, just log that we would enqueue it
  console.log('BOOKING DEBUG - EMR creation enqueued:', {
    appointmentId: params.appointmentId,
    providerId: params.providerId,
    start: params.start
  });
  
  // Simulate async EMR creation without blocking response
  setTimeout(async () => {
    try {
      console.log('BOOKING DEBUG - EMR background job started for:', params.appointmentId);
      // Here you would call intakeQService or athenaService
      // await emrService.createAppointment(...)
    } catch (error) {
      console.error('BOOKING DEBUG - EMR background job failed:', error);
    }
  }, 100);
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
      appointmentType = 'consultation',
      reason = 'Scheduled appointment',
      createInEMR = true,
      isTest = false
    } = data

    // Enhanced API request entry logging
    console.log('📨 BOOKING DEBUG - API Request received:', {
      providerId: !!providerId,
      serviceInstanceId: !!serviceInstanceId,
      payerId: !!payerId,
      date,
      time,
      hasPatientFirstName: !!patient?.firstName,
      hasPatientLastName: !!patient?.lastName,
      hasPatientPhone: !!patient?.phone,
      hasPatientEmail: !!patient?.email,
      createInEMR,
      isTest
    });

    // Validate required fields
    if (!providerId || !serviceInstanceId || !payerId || !date || !time || 
        !patient?.firstName || !patient?.lastName || !patient?.phone) {
      console.error('❌ BOOKING DEBUG - Missing required fields:', {
        hasProviderId: !!providerId,
        hasServiceInstanceId: !!serviceInstanceId,
        hasPayerId: !!payerId,
        hasDate: !!date,
        hasTime: !!time,
        hasPatientFirstName: !!patient.firstName,
        hasPatientLastName: !!patient.lastName,
        hasPatientPhone: !!patient.phone
      });
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields',
          required: ['providerId', 'serviceInstanceId', 'payerId', 'date', 'time', 'patient.firstName', 'patient.lastName', 'patient.phone']
        },
        { status: 400 }
      )
    }

    // Validate serviceInstanceId is present (no fallback)
    if (!serviceInstanceId) {
      return NextResponse.json(
        { success: false, error: 'MISSING_SERVICE_INSTANCE' }, 
        { status: 400 }
      );
    }

    // Construct timezone-safe timestamps server-side
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

    console.log('⏰ BOOKING DEBUG - Computed UTC timestamps:', {
      localDateTime: `${date}T${time} America/Denver`,
      startUTC: start,
      endUTC: end,
      duration,
      providerId,
      date,
      time
    });

    // Get provider details for validation
    const { data: provider, error: providerError } = await supabase
      .from('providers')
      .select('id, first_name, last_name, email, is_active, is_bookable')
      .eq('id', providerId)
      .single()

    if (providerError || !provider) {
      console.error('❌ BOOKING DEBUG - Provider not found:', providerError);
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

    // Check if provider accepts this payer
    const { data: network, error: networkError } = await supabase
      .from('provider_payer_networks')
      .select('*, payers(name)')
      .eq('provider_id', providerId)
      .eq('payer_id', payerId)
      .eq('status', 'in_network')
      .single()

    if (networkError || !network) {
      console.error('❌ BOOKING DEBUG - Provider-payer network not found:', networkError);
      return NextResponse.json(
        { success: false, error: 'Provider does not accept this insurance' },
        { status: 400 }
      )
    }

    // Optional idempotency - compute deterministic key
    const idempotencyKey = crypto
      .createHash('sha256')
      .update(`${providerId}:${start}:${patient.email || ''}`)
      .digest('hex');

    console.log('🔄 BOOKING DEBUG - Checking for duplicate appointment:', {
      idempotencyKey,
      providerId,
      start
    });

    // Check for existing appointment within same minute
    const { data: existingAppointment, error: duplicateCheckError } = await supabase
      .from('appointments')
      .select('id')
      .eq('provider_id', providerId)
      .gte('start_time', DateTime.fromISO(start!).minus({ minutes: 1 }).toISO())
      .lte('start_time', DateTime.fromISO(start!).plus({ minutes: 1 }).toISO())
      .maybeSingle();

    if (duplicateCheckError) {
      console.error('❌ BOOKING DEBUG - Duplicate check failed:', duplicateCheckError);
    } else if (existingAppointment) {
      console.log('♻️ BOOKING DEBUG - Returning existing appointment:', existingAppointment.id);
      return NextResponse.json({
        success: true,
        data: { 
          appointment: { 
            id: existingAppointment.id,
            duplicate: true 
          } 
        }
      });
    }

    // Prepare appointment data for insert
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
      notes: reason,
      booking_source: 'widget',
      is_test: isTest
    };

    console.log('💾 BOOKING DEBUG - About to insert appointment:', {
      provider_id: appointmentData.provider_id,
      service_instance_id: appointmentData.service_instance_id,
      payer_id: appointmentData.payer_id,
      start_time: appointmentData.start_time,
      end_time: appointmentData.end_time,
      timezone: appointmentData.timezone,
      hasPatientInfo: !!appointmentData.patient_info,
      hasInsuranceInfo: !!appointmentData.insurance_info,
      booking_source: appointmentData.booking_source,
      is_test: appointmentData.is_test
    });

    // Insert appointment first - this is the critical operation
    const { data: appointment, error: insertError } = await supabase
      .from('appointments')
      .insert([appointmentData])
      .select('id')
      .single();

    if (insertError || !appointment?.id) {
      console.error('❌ BOOKING DEBUG - DB insert failed:', {
        error: insertError,
        code: insertError?.code,
        message: insertError?.message,
        details: insertError?.details
      });
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'DB_INSERT_FAILED',
          details: insertError?.message 
        }, 
        { status: 500 }
      );
    }

    console.log('✅ BOOKING DEBUG - Appointment created successfully:', {
      appointmentId: appointment.id,
      providerId,
      start,
      patientName: `${patient.firstName} ${patient.lastName}`
    });

    // Fire-and-log EMR creation; do not block success response
    if (createInEMR && !isTest) {
      enqueueCreateInEMR({ 
        appointmentId: appointment.id, 
        providerId, 
        start: start! 
      }).catch(error => 
        console.error('BOOKING DEBUG - EMR enqueue failed:', error)
      );
    }

    // Return success immediately after DB insert
    return NextResponse.json({
      success: true,
      data: {
        appointment: {
          id: appointment.id,
          provider: {
            id: provider.id,
            name: `${provider.first_name} ${provider.last_name}`
          },
          schedule: {
            date,
            start_time: time,
            timezone: 'America/Denver'
          },
          emr_queued: createInEMR && !isTest
        }
      }
    }, { status: 200 });

  } catch (error: any) {
    console.error('❌ BOOKING DEBUG - Unexpected error:', {
      error: error.message,
      stack: error.stack
    });
    
    return NextResponse.json(
      { 
        success: false,
        error: 'UNEXPECTED_ERROR',
        details: error.message
      },
      { status: 500 }
    )
  }
}

// GET endpoint to retrieve appointment details (unchanged)
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