/**
 * Patient Roster Follow-Up Data API
 *
 * Fetches follow-up data from IntakeQ for a batch of patients.
 * Designed to be called AFTER the main roster loads for lazy loading.
 *
 * POST /api/patients/roster/follow-ups
 * Body: { patientIds: string[] }
 *
 * Returns: { followUps: { [patientId: string]: FollowUpDetails } }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'
import { intakeQService } from '@/lib/services/intakeQService'
import { parseFollowUpFromNote } from '@/lib/utils/followUpParser'
import type { FollowUpDetails } from '@/types/patient-roster'

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { patientIds } = body

    if (!Array.isArray(patientIds) || patientIds.length === 0) {
      return NextResponse.json(
        { error: 'patientIds array is required' },
        { status: 400 }
      )
    }

    // Limit batch size to prevent abuse
    const limitedPatientIds = patientIds.slice(0, 50)

    console.log(`📋 [Follow-Up API] Fetching follow-ups for ${limitedPatientIds.length} patients`)

    // Get practiceq_client_id for all patients
    const { data: patientData, error } = await supabaseAdmin
      .from('patients')
      .select('id, practiceq_client_id')
      .in('id', limitedPatientIds)

    if (error) {
      console.error('❌ Error fetching practiceq_client_ids:', error)
      return NextResponse.json(
        { error: 'Failed to fetch patient data' },
        { status: 500 }
      )
    }

    // Create map of patient_id -> practiceq_client_id
    const clientIdMap = new Map<string, string>()
    const patientIdByClientId = new Map<string, string>()

    for (const p of patientData || []) {
      if (p.practiceq_client_id) {
        clientIdMap.set(p.id, p.practiceq_client_id)
        patientIdByClientId.set(p.practiceq_client_id, p.id)
      }
    }

    // Get unique client IDs to fetch
    const clientIds = Array.from(new Set(clientIdMap.values()))

    if (clientIds.length === 0) {
      console.log('📋 [Follow-Up API] No patients have practiceq_client_id')
      return NextResponse.json({ followUps: {} })
    }

    console.log(`📋 [Follow-Up API] Fetching IntakeQ notes for ${clientIds.length} clients`)

    // Batch fetch latest locked notes from IntakeQ
    const notesMap = await intakeQService.getLatestLockedNotesForClients(clientIds)

    // Build response map: patientId -> followUp
    const followUps: { [patientId: string]: FollowUpDetails } = {}

    for (const [clientId, note] of notesMap.entries()) {
      const patientId = patientIdByClientId.get(clientId)
      if (!patientId) continue

      const parsed = parseFollowUpFromNote(note)
      if (parsed.text) {
        followUps[patientId] = {
          text: parsed.text,
          noteDate: parsed.noteDate
        }
      }
    }

    console.log(`📋 [Follow-Up API] Found follow-up info for ${Object.keys(followUps).length} patients`)

    return NextResponse.json({ followUps })

  } catch (error: any) {
    console.error('❌ [Follow-Up API] Error:', error.message)
    return NextResponse.json(
      { error: 'Failed to fetch follow-up data', details: error.message },
      { status: 500 }
    )
  }
}
