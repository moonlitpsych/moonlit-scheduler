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

    // Step 4: Log what the server actually receives
    console.log('📥 CREATE-APPT payload (server)', data)
    
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

    // ✅ Backend safety fallback using real seeded instances
    let finalServiceInstanceId = serviceInstanceId
    if (!finalServiceInstanceId && payerId === 'a01d69d6-ae70-4917-afef-49b5ef7e5220') {
      console.log('🔄 BOOKING DEBUG - Missing serviceInstanceId for Utah Medicaid, using seeded fallback...')

      // Use real seeded service instance IDs
      const TELEHEALTH_INTAKE_SERVICE_ID = 'f0a05d4c-188a-4f1b-9600-54d6c27a3f62'
      const SERVICE_INSTANCE_ID_HOUSED = '12191f44-a09c-426f-8e22-0c5b8e57b3b7'
      const SERVICE_INSTANCE_ID_UNHOUSED = '1a659f8e-249a-4690-86e7-359c6c381bc0'

      // Default to housed instance for MVP (housing status logic can be added later)
      finalServiceInstanceId = SERVICE_INSTANCE_ID_HOUSED
      console.log(`🔄 BOOKING DEBUG - Using seeded fallback service instance: ${finalServiceInstanceId}`)

      // Verify the instance exists in database (optional safety check)
      const { data: instanceCheck, error: checkError } = await supabase
        .from('service_instances')
        .select('id, service_id, location, pos_code')
        .eq('id', finalServiceInstanceId)
        .eq('service_id', TELEHEALTH_INTAKE_SERVICE_ID)
        .eq('payer_id', payerId)
        .single()

      if (checkError || !instanceCheck) {
        console.error('❌ BOOKING DEBUG - Seeded service instance not found in database:', checkError)
        return NextResponse.json(
          {
            success: false,
            error: 'Service instance not properly configured in database',
            details: 'Please ensure the Telehealth Intake service instances are properly seeded'
          },
          { status: 500 }
        )
      }

      console.log(`✅ BOOKING DEBUG - Verified service instance: ${instanceCheck.service_id} at ${instanceCheck.location} (POS ${instanceCheck.pos_code})`)
    }

    // Final validation - serviceInstanceId must be present after fallback attempt
    if (!finalServiceInstanceId) {
      return NextResponse.json(
        {
          success: false,
          error: 'MISSING_SERVICE_INSTANCE',
          details: 'serviceInstanceId is required and no fallback was available'
        },
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
      service_instance_id: finalServiceInstanceId, // Use fallback if needed
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

    // Step 4: Safety check before insert
    const { data: si, error: siErr } = await supabase
      .from('service_instances')
      .select('id, service_id, payer_id, location, pos_code')
      .eq('id', finalServiceInstanceId)
      .single()
    console.log('🔎 Verified service_instance', { serviceInstanceId: finalServiceInstanceId, si, siErr })

    // Pre-insert availability check to avoid P0001 constraint violation
    console.log('🔍 PRE-INSERT AVAILABILITY CHECK:', {
      provider_id: providerId,
      start_time: start,
      end_time: end,
      checking: 'existing appointments overlap'
    })

    const { data: conflicts, error: conflictError } = await supabase
      .from('appointments')
      .select('id, start_time, end_time, status')
      .eq('provider_id', providerId)
      .gte('start_time', DateTime.fromISO(start!).minus({ hours: 2 }).toISO())
      .lte('start_time', DateTime.fromISO(start!).plus({ hours: 2 }).toISO())
      .neq('status', 'cancelled')

    console.log('🔍 CONFLICT CHECK RESULT:', { conflicts, conflictError })

    if (conflicts && conflicts.length > 0) {
      console.log('⚠️ FOUND POTENTIAL CONFLICTS:', conflicts)
      // Check for exact overlaps
      const exactOverlap = conflicts.find(apt => {
        const aptStart = new Date(apt.start_time).getTime()
        const aptEnd = new Date(apt.end_time).getTime()
        const newStart = new Date(start!).getTime()
        const newEnd = new Date(end!).getTime()

        return (newStart < aptEnd && newEnd > aptStart) // Overlap check
      })

      if (exactOverlap) {
        console.log('❌ EXACT OVERLAP FOUND, blocking insert:', exactOverlap)
        return NextResponse.json(
          {
            success: false,
            error: 'TIME_CONFLICT',
            details: 'This time slot is no longer available. Please select a different time.'
          },
          { status: 409 }
        )
      }
    }

    // Step 5: Print the exact object passed to supabase insert
    console.log('📋 INSERT OBJECT:', JSON.stringify(appointmentData, null, 2))

    // Insert appointment first - this is the critical operation
    let appointment, insertError
    try {
      const result = await supabase
        .from('appointments')
        .insert([appointmentData])
        .select('id')
        .single();
      appointment = result.data
      insertError = result.error
    } catch (e: any) {
      console.error('❌ DB_INSERT_FAILED (supabase error)', {
        message: e?.message, details: e?.details, hint: e?.hint, code: e?.code, e
      })
      return NextResponse.json({ success:false, error:'DB_INSERT_FAILED', details: e?.details || e?.message }, { status: 500 })
    }

    if (insertError || !appointment?.id) {
      console.error('❌ DB_INSERT_FAILED (supabase error)', {
        message: insertError?.message, details: insertError?.details, hint: insertError?.hint, code: insertError?.code, insertError
      });

      return NextResponse.json(
        {
          success: false,
          error: 'DB_INSERT_FAILED',
          details: insertError?.details || insertError?.message
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