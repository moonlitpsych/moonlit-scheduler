// src/app/api/webhooks/athena/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import crypto from 'crypto'

interface AthenaWebhookEvent {
  eventtype: string
  practiceId: string
  appointmentid?: string
  patientid?: string
  providerid?: string
  departmentid?: string
  timestamp: string
  data: any
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const signature = request.headers.get('X-Athena-Signature')
    const timestamp = request.headers.get('X-Athena-Timestamp')

    // Verify webhook signature
    if (!verifyWebhookSignature(rawBody, signature, timestamp)) {
      console.error('❌ Invalid webhook signature')
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    const event: AthenaWebhookEvent = JSON.parse(rawBody)
    
    console.log('📡 Athena webhook received:', {
      eventtype: event.eventtype,
      practiceId: event.practiceId,
      appointmentid: event.appointmentid,
      timestamp: event.timestamp
    })

    // Process the event based on type
    const result = await processWebhookEvent(event)

    return NextResponse.json({
      success: true,
      processed: true,
      eventtype: event.eventtype,
      ...result
    })

  } catch (error: any) {
    console.error('❌ Webhook processing error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Webhook processing failed',
        details: error.message 
      },
      { status: 500 }
    )
  }
}

/**
 * Verify the webhook signature from Athena
 */
function verifyWebhookSignature(
  payload: string, 
  signature: string | null, 
  timestamp: string | null
): boolean {
  const webhookSecret = process.env.ATHENA_WEBHOOK_SECRET

  if (!webhookSecret || !signature || !timestamp) {
    console.warn('⚠️ Webhook signature verification skipped - missing secret or headers')
    return true // Allow in development, but log warning
  }

  try {
    // Athena uses HMAC-SHA256 for webhook signatures
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(timestamp + payload)
      .digest('hex')

    const providedSignature = signature.replace('sha256=', '')

    const isValid = crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(providedSignature, 'hex')
    )

    if (!isValid) {
      console.error('❌ Webhook signature mismatch')
    }

    return isValid

  } catch (error) {
    console.error('❌ Signature verification error:', error)
    return false
  }
}

/**
 * Process different types of webhook events
 */
async function processWebhookEvent(event: AthenaWebhookEvent): Promise<any> {
  switch (event.eventtype) {
    case 'appointment.created':
      return await handleAppointmentCreated(event)
    
    case 'appointment.updated':
      return await handleAppointmentUpdated(event)
    
    case 'appointment.cancelled':
      return await handleAppointmentCancelled(event)
    
    case 'patient.created':
      return await handlePatientCreated(event)
    
    case 'patient.updated':
      return await handlePatientUpdated(event)
    
    case 'provider.updated':
      return await handleProviderUpdated(event)
    
    default:
      console.log(`ℹ️ Unhandled event type: ${event.eventtype}`)
      return { message: `Event type ${event.eventtype} received but not processed` }
  }
}

/**
 * Handle appointment created events
 */
async function handleAppointmentCreated(event: AthenaWebhookEvent): Promise<any> {
  try {
    console.log(`📅 Processing appointment created: ${event.appointmentid}`)

    const appointmentData = {
      athena_appointment_id: event.appointmentid,
      provider_id: await getProviderIdByAthenaId(event.providerid),
      patient_id: await getPatientIdByAthenaId(event.patientid),
      start_time: event.data.appointmentdate + 'T' + event.data.appointmenttime,
      end_time: calculateEndTime(event.data.appointmentdate, event.data.appointmenttime, event.data.duration || 60),
      status: 'scheduled',
      appointment_type: event.data.appointmenttype || 'consultation',
      notes: event.data.reasonforvisit || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('appointments')
      .insert(appointmentData)

    if (error) {
      console.error('❌ Error creating appointment in Supabase:', error)
      throw error
    }

    console.log('✅ Appointment created in Supabase:', data)

    return { message: 'Appointment created successfully', appointmentId: event.appointmentid }

  } catch (error) {
    console.error('❌ Error handling appointment created:', error)
    throw error
  }
}

/**
 * Handle appointment updated events
 */
async function handleAppointmentUpdated(event: AthenaWebhookEvent): Promise<any> {
  try {
    console.log(`📝 Processing appointment updated: ${event.appointmentid}`)

    const updates = {
      start_time: event.data.appointmentdate + 'T' + event.data.appointmenttime,
      end_time: calculateEndTime(event.data.appointmentdate, event.data.appointmenttime, event.data.duration || 60),
      status: mapAthenaStatus(event.data.appointmentstatus),
      appointment_type: event.data.appointmenttype || 'consultation',
      notes: event.data.reasonforvisit || '',
      updated_at: new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('appointments')
      .update(updates)
      .eq('athena_appointment_id', event.appointmentid)

    if (error) {
      console.error('❌ Error updating appointment in Supabase:', error)
      throw error
    }

    console.log('✅ Appointment updated in Supabase')

    return { message: 'Appointment updated successfully', appointmentId: event.appointmentid }

  } catch (error) {
    console.error('❌ Error handling appointment updated:', error)
    throw error
  }
}

/**
 * Handle appointment cancelled events
 */
async function handleAppointmentCancelled(event: AthenaWebhookEvent): Promise<any> {
  try {
    console.log(`🚫 Processing appointment cancelled: ${event.appointmentid}`)

    const { data, error } = await supabase
      .from('appointments')
      .update({
        status: 'cancelled',
        cancellation_reason: event.data.cancellationreason || 'Cancelled via Athena',
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('athena_appointment_id', event.appointmentid)

    if (error) {
      console.error('❌ Error cancelling appointment in Supabase:', error)
      throw error
    }

    console.log('✅ Appointment cancelled in Supabase')

    return { message: 'Appointment cancelled successfully', appointmentId: event.appointmentid }

  } catch (error) {
    console.error('❌ Error handling appointment cancelled:', error)
    throw error
  }
}

/**
 * Handle patient created events
 */
async function handlePatientCreated(event: AthenaWebhookEvent): Promise<any> {
  try {
    console.log(`👤 Processing patient created: ${event.patientid}`)

    // Note: In a real implementation, you might want to sync patient data
    // For now, just log the event

    return { message: 'Patient created event received', patientId: event.patientid }

  } catch (error) {
    console.error('❌ Error handling patient created:', error)
    throw error
  }
}

/**
 * Handle patient updated events
 */
async function handlePatientUpdated(event: AthenaWebhookEvent): Promise<any> {
  try {
    console.log(`📝 Processing patient updated: ${event.patientid}`)

    // Note: In a real implementation, you might want to sync patient data
    // For now, just log the event

    return { message: 'Patient updated event received', patientId: event.patientid }

  } catch (error) {
    console.error('❌ Error handling patient updated:', error)
    throw error
  }
}

/**
 * Handle provider updated events
 */
async function handleProviderUpdated(event: AthenaWebhookEvent): Promise<any> {
  try {
    console.log(`👩‍⚕️ Processing provider updated: ${event.providerid}`)

    // Trigger provider sync
    const { error } = await supabase
      .from('providers')
      .update({
        sync_needed: true,
        updated_at: new Date().toISOString()
      })
      .eq('athena_provider_id', event.providerid)

    if (error) {
      console.error('❌ Error marking provider for sync:', error)
      throw error
    }

    return { message: 'Provider marked for sync', providerId: event.providerid }

  } catch (error) {
    console.error('❌ Error handling provider updated:', error)
    throw error
  }
}

/**
 * Helper functions
 */

async function getProviderIdByAthenaId(athenaProviderId: string | undefined): Promise<string | null> {
  if (!athenaProviderId) return null

  try {
    const { data, error } = await supabase
      .from('providers')
      .select('id')
      .eq('athena_provider_id', athenaProviderId)
      .single()

    if (error || !data) {
      console.warn(`⚠️ Provider not found for Athena ID: ${athenaProviderId}`)
      return null
    }

    return data.id
  } catch (error) {
    console.error('❌ Error looking up provider:', error)
    return null
  }
}

async function getPatientIdByAthenaId(athenaPatientId: string | undefined): Promise<string | null> {
  if (!athenaPatientId) return null

  // Note: You might want to implement patient management in Supabase
  // For now, return null as patient management might be handled differently
  return null
}

function calculateEndTime(date: string, startTime: string, durationMinutes: number): string {
  const startDateTime = new Date(`${date}T${startTime}`)
  const endDateTime = new Date(startDateTime.getTime() + (durationMinutes * 60 * 1000))
  return endDateTime.toISOString()
}

function mapAthenaStatus(athenaStatus: string): string {
  const statusMap: Record<string, string> = {
    'scheduled': 'scheduled',
    'confirmed': 'confirmed',
    'checked-in': 'checked_in',
    'in-progress': 'in_progress',
    'completed': 'completed',
    'cancelled': 'cancelled',
    'no-show': 'no_show',
    'x': 'cancelled'
  }

  return statusMap[athenaStatus] || 'scheduled'
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Athena webhook endpoint is active',
    timestamp: new Date().toISOString()
  })
}