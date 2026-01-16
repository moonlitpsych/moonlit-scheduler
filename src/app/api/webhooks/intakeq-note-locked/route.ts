// IntakeQ "Note Locked" webhook handler for co-signature queue
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Types for IntakeQ webhook payloads
interface NoteLockWebhookPayload {
  NoteId: string
  Type: string  // "Note Locked"
  ClientId: number
}

interface IntakeQNote {
  Id: string
  AppointmentId?: string
  ClientName: string
  PractitionerName: string
  PractitionerEmail?: string
  Date: number  // Unix timestamp in milliseconds
  Status: string
  Questions?: Array<{
    Text: string
    Answer: string
  }>
}

interface IntakeQAppointment {
  Id: string
  LocationName: string
  ServiceName: string
  ClientName: string
  PractitionerName: string
  Status: string
  Note?: string              // Appointment note field (where "Supervisor: X" is stored)
  PractitionerNotes?: string // Alternative note field
}

// Initialize Supabase with service role key for webhook processing
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// Get IntakeQ API key with Next.js .env parsing workaround
function getIntakeQApiKey(): string {
  const rawKey = process.env.INTAKEQ_API_KEY || ''
  if (rawKey.startsWith('4d09ac93') && rawKey.length > 40) {
    return rawKey.substring(0, 40)
  }
  return rawKey
}

// IntakeQ API helper
async function fetchFromIntakeQ<T>(endpoint: string): Promise<T | null> {
  const apiKey = getIntakeQApiKey()

  if (!apiKey) {
    console.error('❌ IntakeQ API key not configured')
    return null
  }

  try {
    const response = await fetch(`https://intakeq.com/api/v1${endpoint}`, {
      headers: {
        'X-Auth-Key': apiKey,
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      console.error(`❌ IntakeQ API error: ${response.status} for ${endpoint}`)
      return null
    }

    return response.json()
  } catch (error: any) {
    console.error(`❌ IntakeQ API fetch error for ${endpoint}:`, error.message)
    return null
  }
}

// Helper: Log webhook event for debugging
async function logWebhookEvent(
  payload: NoteLockWebhookPayload,
  action: string,
  extra?: Record<string, any>
) {
  try {
    await supabase
      .from('cosign_webhook_log')
      .insert({
        webhook_type: payload.Type,
        note_id: payload.NoteId,
        client_id: payload.ClientId,
        action_taken: action,
        raw_payload: { ...payload, ...extra }
      })
  } catch (error) {
    console.error('⚠️ Failed to log webhook event:', error)
  }
}

// Helper: Detect note type from content
function detectNoteType(note: IntakeQNote): string {
  const titleQuestion = note.Questions?.find(q =>
    q.Text.toLowerCase().includes('note type') ||
    q.Text.toLowerCase().includes('visit type')
  )
  if (titleQuestion?.Answer) {
    return titleQuestion.Answer
  }
  return 'Progress Note'  // Default
}

// Helper: Parse supervisor name from appointment note
// Looks for pattern "Supervisor: [LastName]" (case-insensitive)
function parseSupervisorFromNote(note: string | undefined): string | null {
  if (!note) return null

  // Match "Supervisor: LastName" or "Supervisor: Last Name" (case-insensitive)
  const match = note.match(/supervisor:\s*([a-zA-Z\-]+)/i)
  if (match && match[1]) {
    return match[1].trim()
  }
  return null
}

// Helper: Match supervisor last name to a provider in our database
async function matchSupervisorToProvider(supervisorLastName: string): Promise<{ id: string; name: string } | null> {
  const { data: providers } = await supabase
    .from('providers')
    .select('id, first_name, last_name')
    .ilike('last_name', supervisorLastName)
    .eq('is_active', true)
    .limit(1)

  if (providers && providers.length > 0) {
    const provider = providers[0]
    return {
      id: provider.id,
      name: `${provider.first_name} ${provider.last_name}`
    }
  }

  console.log(`⚠️ [Co-Sign Webhook] No provider found matching supervisor: ${supervisorLastName}`)
  return null
}

export async function POST(request: NextRequest) {
  let payload: NoteLockWebhookPayload | null = null

  try {
    // 1. Parse webhook payload
    payload = await request.json()

    console.log('📨 [Co-Sign Webhook] Note Locked event received:', {
      noteId: payload.NoteId,
      type: payload.Type,
      clientId: payload.ClientId
    })

    // 2. Verify this is a "Note Locked" event
    if (payload.Type !== 'Note Locked') {
      console.log('⚠️ [Co-Sign Webhook] Ignoring non-lock event:', payload.Type)
      await logWebhookEvent(payload, 'ignored_wrong_type')
      return NextResponse.json({ success: true, action: 'ignored_wrong_type' })
    }

    // 3. Check if note is already in queue
    const { data: existingEntry } = await supabase
      .from('cosign_queue')
      .select('id, status')
      .eq('note_id', payload.NoteId)
      .single()

    if (existingEntry) {
      // This is a RE-LOCK — mark as signed if pending
      if (existingEntry.status === 'pending') {
        await supabase
          .from('cosign_queue')
          .update({
            status: 'signed',
            signed_at: new Date().toISOString(),
            signed_by: 'Attending (via IntakeQ)',
            updated_at: new Date().toISOString()
          })
          .eq('id', existingEntry.id)

        console.log('✅ [Co-Sign Webhook] Note marked as signed:', payload.NoteId)
        await logWebhookEvent(payload, 'marked_signed')
        return NextResponse.json({ success: true, action: 'marked_signed' })
      } else {
        // Already signed or skipped, ignore
        console.log('ℹ️ [Co-Sign Webhook] Note already processed:', payload.NoteId, existingEntry.status)
        await logWebhookEvent(payload, 'ignored_already_processed')
        return NextResponse.json({ success: true, action: 'ignored_already_processed' })
      }
    }

    // 4. FIRST LOCK — Fetch full note to get AppointmentId
    const note = await fetchFromIntakeQ<IntakeQNote>(`/notes/${payload.NoteId}`)

    if (!note) {
      console.error('❌ [Co-Sign Webhook] Note not found:', payload.NoteId)
      await logWebhookEvent(payload, 'error_note_not_found')
      return NextResponse.json({ success: false, error: 'Note not found' }, { status: 404 })
    }

    if (!note.AppointmentId) {
      // Note without appointment — skip (can't determine payer)
      console.log('⚠️ [Co-Sign Webhook] Note has no AppointmentId, skipping:', payload.NoteId)
      await logWebhookEvent(payload, 'ignored_no_appointment')
      return NextResponse.json({ success: true, action: 'ignored_no_appointment' })
    }

    // 5. Fetch appointment to get LocationName (payer)
    const appointment = await fetchFromIntakeQ<IntakeQAppointment>(
      `/appointments/${note.AppointmentId}`
    )

    if (!appointment) {
      console.error('❌ [Co-Sign Webhook] Appointment not found:', note.AppointmentId)
      await logWebhookEvent(payload, 'error_appointment_not_found')
      return NextResponse.json({ success: false, error: 'Appointment not found' }, { status: 404 })
    }

    // 6. Look up payer co-sign requirement
    const { data: payerConfig } = await supabase
      .from('payer_cosign_requirements')
      .select('requires_cosign, display_name')
      .eq('intakeq_location_name', appointment.LocationName)
      .single()

    if (!payerConfig) {
      console.log(`⚠️ [Co-Sign Webhook] Unknown payer location: ${appointment.LocationName}`)
      await logWebhookEvent(payload, 'unknown_payer_defaulting_to_cosign', {
        locationName: appointment.LocationName
      })
      // Default to requiring co-sign for unknown payers
    }

    const requiresCosign = payerConfig?.requires_cosign ?? true  // Default to true if unknown

    if (!requiresCosign) {
      console.log(`ℹ️ [Co-Sign Webhook] Payer ${appointment.LocationName} does not require co-sign, skipping`)
      await logWebhookEvent(payload, 'ignored_no_cosign_required')
      return NextResponse.json({ success: true, action: 'ignored_no_cosign_required' })
    }

    // 7. Parse supervisor from appointment note
    const appointmentNote = appointment.Note || appointment.PractitionerNotes
    const supervisorLastName = parseSupervisorFromNote(appointmentNote)
    let supervisorProvider: { id: string; name: string } | null = null

    if (supervisorLastName) {
      supervisorProvider = await matchSupervisorToProvider(supervisorLastName)
      console.log(`📋 [Co-Sign Webhook] Supervisor parsed: "${supervisorLastName}" → ${supervisorProvider ? supervisorProvider.name : 'NOT FOUND'}`)
    } else {
      console.log(`⚠️ [Co-Sign Webhook] No supervisor found in appointment note: "${appointmentNote || '(empty)'}"`)
    }

    // 8. Add to co-sign queue
    const { error: insertError } = await supabase
      .from('cosign_queue')
      .insert({
        note_id: payload.NoteId,
        appointment_id: note.AppointmentId,
        client_id: payload.ClientId,
        patient_name: note.ClientName,
        payer_location_name: appointment.LocationName,
        payer_display_name: payerConfig?.display_name ?? appointment.LocationName,
        resident_name: note.PractitionerName,
        resident_email: note.PractitionerEmail,
        note_date: new Date(note.Date).toISOString(),
        note_type: detectNoteType(note),
        service_name: appointment.ServiceName,
        status: 'pending',
        // Supervisor fields
        supervisor_provider_id: supervisorProvider?.id || null,
        supervisor_name: supervisorLastName,
        appointment_note: appointmentNote
      })

    if (insertError) {
      console.error('❌ [Co-Sign Webhook] Failed to insert into queue:', insertError)
      await logWebhookEvent(payload, 'error_insert_failed', { error: insertError.message })
      return NextResponse.json({ success: false, error: insertError.message }, { status: 500 })
    }

    console.log('✅ [Co-Sign Webhook] Note added to co-sign queue:', {
      noteId: payload.NoteId,
      patient: note.ClientName,
      payer: appointment.LocationName,
      resident: note.PractitionerName,
      supervisor: supervisorProvider?.name || supervisorLastName || 'Not assigned'
    })

    await logWebhookEvent(payload, 'added_to_queue')
    return NextResponse.json({ success: true, action: 'added_to_queue' })

  } catch (error: any) {
    console.error('❌ [Co-Sign Webhook] Processing error:', error)
    if (payload) {
      await logWebhookEvent(payload, 'error_exception', { error: error.message })
    }
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// GET endpoint for health check
export async function GET() {
  return NextResponse.json({
    status: 'active',
    endpoint: 'IntakeQ Note Locked webhook for co-sign queue',
    timestamp: new Date().toISOString()
  })
}
