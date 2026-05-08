/**
 * POST /api/provider-dashboard/letters/generate
 *
 * Renders a Moonlit-letterhead PDF from the (possibly edited) body the
 * provider produced in the dashboard, uploads it to the `provider-letters`
 * Supabase Storage bucket, and inserts a row in `provider_letters`.
 *
 * Returns: { letterId, signedUrl, fileName }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import { ProviderLetterPDF } from '@/lib/pdf/ProviderLetterTemplate'
import { LetterType } from '@/lib/services/letterService'

const STORAGE_BUCKET = 'provider-letters'

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

    const payload = await request.json()
    const {
      patientId,
      providerId,
      letterType,
      bodyText,
      diagnosisCodes = [],
      recipientName,
      recipientEmail,
      recipientOrganization,
    } = payload as {
      patientId: string
      providerId: string
      letterType: LetterType
      bodyText: string
      diagnosisCodes?: string[]
      recipientName?: string
      recipientEmail?: string
      recipientOrganization?: string
    }

    if (!patientId || !providerId || !letterType || !bodyText?.trim()) {
      return NextResponse.json(
        { success: false, error: 'patientId, providerId, letterType, and bodyText are required' },
        { status: 400 },
      )
    }

    // Load patient + provider for the PDF and the verification check.
    const [{ data: patient }, { data: provider }] = await Promise.all([
      supabaseAdmin
        .from('patients')
        .select('id, first_name, last_name, date_of_birth')
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

    // Verify provider has at least one appointment with this patient (the
    // patient-search route enforces this, but re-verify server-side).
    const { count: apptCount } = await supabaseAdmin
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('provider_id', providerId)
      .eq('patient_id', patientId)

    if (!apptCount || apptCount === 0) {
      return NextResponse.json(
        { success: false, error: 'This provider has no appointments with this patient' },
        { status: 403 },
      )
    }

    const patientName = `${patient.first_name} ${patient.last_name}`.trim()
    const providerName = `${provider.first_name} ${provider.last_name}`.trim()
    const credentials = provider.title || provider.role || 'MD'
    const dob = (patient as any).date_of_birth
      ? new Date((patient as any).date_of_birth).toLocaleDateString('en-US')
      : null
    const letterDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    const pdfBuffer = await renderToBuffer(
      React.createElement(ProviderLetterPDF, {
        letterType,
        patientName,
        patientDob: dob,
        providerName,
        providerCredentials: credentials,
        providerNpi: (provider as any).npi || null,
        recipientName: recipientName || null,
        recipientOrganization: recipientOrganization || null,
        diagnosisCodes,
        bodyText,
        letterDate,
      }),
    )

    // Insert the row first (we need its id for the storage path), then upload.
    const { data: row, error: insertErr } = await supabaseAdmin
      .from('provider_letters')
      .insert({
        provider_id: providerId,
        patient_id: patientId,
        generated_by_user_id: session.user.id,
        letter_type: letterType,
        recipient_name: recipientName || null,
        recipient_email: recipientEmail || null,
        diagnosis_codes: diagnosisCodes,
        body_text: bodyText,
        // storage_path filled in immediately below
        storage_path: 'pending',
      })
      .select('id')
      .single()

    if (insertErr || !row) {
      return NextResponse.json(
        { success: false, error: insertErr?.message || 'Failed to create letter record' },
        { status: 500 },
      )
    }

    const fileName = `${providerId}/${patientId}/letter-${row.id}.pdf`

    const { error: uploadErr } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(fileName, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      })

    if (uploadErr) {
      // Roll back the row so we don't leave an orphan with storage_path='pending'.
      await supabaseAdmin.from('provider_letters').delete().eq('id', row.id)
      return NextResponse.json(
        { success: false, error: `PDF upload failed: ${uploadErr.message}` },
        { status: 500 },
      )
    }

    await supabaseAdmin
      .from('provider_letters')
      .update({ storage_path: fileName })
      .eq('id', row.id)

    const { data: signed } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(fileName, 60 * 60 * 24 * 7) // 7 days

    return NextResponse.json({
      success: true,
      data: {
        letterId: row.id,
        signedUrl: signed?.signedUrl || null,
        fileName,
      },
    })
  } catch (error: any) {
    console.error('❌ letters/generate error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 },
    )
  }
}
