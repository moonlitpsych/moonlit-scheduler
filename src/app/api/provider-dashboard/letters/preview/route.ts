/**
 * POST /api/provider-dashboard/letters/preview
 *
 * Returns a default editable body for the chosen letter type, populated with
 * patient + provider details. The dashboard then lets the provider edit it.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'
import { buildDefaultBody, LetterType } from '@/lib/services/letterService'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const {
      patientId,
      providerId,
      letterType,
      diagnosisCodes,
      recipientName,
      recipientOrganization,
      leaveStartDate,
      leaveEndDate,
    } = body as {
      patientId: string
      providerId: string
      letterType: LetterType
      diagnosisCodes?: string[]
      recipientName?: string
      recipientOrganization?: string
      leaveStartDate?: string
      leaveEndDate?: string
    }

    if (!patientId || !providerId || !letterType) {
      return NextResponse.json(
        { success: false, error: 'patientId, providerId, and letterType are required' },
        { status: 400 },
      )
    }

    const [{ data: patient }, { data: provider }] = await Promise.all([
      supabaseAdmin
        .from('patients')
        .select('id, first_name, last_name, date_of_birth, default_diagnosis_codes')
        .eq('id', patientId)
        .single(),
      supabaseAdmin
        .from('providers')
        .select('id, first_name, last_name, title, role, npi')
        .eq('id', providerId)
        .single(),
    ])

    if (!patient || !provider) {
      return NextResponse.json({ success: false, error: 'Patient or provider not found' }, { status: 404 })
    }

    // First appointment date for "established since"
    const { data: firstAppt } = await supabaseAdmin
      .from('appointments')
      .select('start_time')
      .eq('provider_id', providerId)
      .eq('patient_id', patientId)
      .order('start_time', { ascending: true })
      .limit(1)
      .maybeSingle()

    const dxCodes =
      diagnosisCodes && diagnosisCodes.length > 0
        ? diagnosisCodes
        : (patient as any).default_diagnosis_codes || []

    const patientName = `${patient.first_name} ${patient.last_name}`.trim()
    const providerName = `${provider.first_name} ${provider.last_name}`.trim()
    const credentials = provider.title || provider.role || 'MD'

    const bodyText = buildDefaultBody({
      letterType,
      patientName,
      patientDob: (patient as any).date_of_birth,
      providerName,
      providerCredentials: credentials,
      firstAppointmentDate: firstAppt?.start_time || null,
      diagnosisCodes: dxCodes,
      recipientName,
      recipientOrganization,
      leaveStartDate,
      leaveEndDate,
    })

    return NextResponse.json({
      success: true,
      data: {
        bodyText,
        defaults: {
          patientName,
          patientDob: (patient as any).date_of_birth,
          providerName,
          providerCredentials: credentials,
          providerNpi: (provider as any).npi || null,
          firstAppointmentDate: firstAppt?.start_time || null,
          diagnosisCodes: dxCodes,
        },
      },
    })
  } catch (error: any) {
    console.error('❌ letters/preview error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 },
    )
  }
}
