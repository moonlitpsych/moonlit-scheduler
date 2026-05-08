/**
 * POST /api/provider-dashboard/letters/[id]/email
 *
 * Emails an already-generated letter to the recipient. Uses the existing
 * Resend-backed `emailService.sendEmail`. The PDF is delivered as a 7-day
 * signed download link in the email body (matches the medication-report
 * pattern — no large attachments through Resend).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'
import { emailService } from '@/lib/services/emailService'
import { LETTER_TYPE_LABELS, LetterType } from '@/lib/services/letterService'

const STORAGE_BUCKET = 'provider-letters'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: letterId } = await params

    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({} as any))
    const overrideRecipient = (body?.recipientEmail as string | undefined)?.trim()

    const { data: letter, error: letterErr } = await supabaseAdmin
      .from('provider_letters')
      .select('id, letter_type, recipient_name, recipient_email, storage_path, patient_id, provider_id')
      .eq('id', letterId)
      .single()

    if (letterErr || !letter) {
      return NextResponse.json({ success: false, error: 'Letter not found' }, { status: 404 })
    }

    const recipientEmail = overrideRecipient || letter.recipient_email
    if (!recipientEmail) {
      return NextResponse.json(
        { success: false, error: 'No recipient email on file' },
        { status: 400 },
      )
    }

    const [{ data: patient }, { data: provider }] = await Promise.all([
      supabaseAdmin.from('patients').select('first_name, last_name').eq('id', letter.patient_id).single(),
      supabaseAdmin.from('providers').select('first_name, last_name, title').eq('id', letter.provider_id).single(),
    ])

    const { data: signed } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(letter.storage_path, 60 * 60 * 24 * 7)

    if (!signed?.signedUrl) {
      return NextResponse.json(
        { success: false, error: 'Failed to generate signed download URL' },
        { status: 500 },
      )
    }

    const patientName = patient ? `${patient.first_name} ${patient.last_name}` : 'patient'
    const providerName = provider
      ? `${provider.first_name} ${provider.last_name}${provider.title ? `, ${provider.title}` : ''}`
      : 'Moonlit Psychiatry'
    const letterLabel = LETTER_TYPE_LABELS[letter.letter_type as LetterType] || 'Letter'

    const subject = `${letterLabel} — ${patientName} (Moonlit Psychiatry)`
    const greeting = letter.recipient_name ? `Hello ${letter.recipient_name},` : 'Hello,'
    const text = [
      greeting,
      ``,
      `Please find attached a ${letterLabel.toLowerCase()} from ${providerName} regarding ${patientName}.`,
      ``,
      `Download (link expires in 7 days):`,
      signed.signedUrl,
      ``,
      `If you have any questions, please contact our office at (385) 246-2522 or hello@trymoonlit.com.`,
      ``,
      `— Moonlit Psychiatry`,
    ].join('\n')

    await emailService.sendEmail({
      to: recipientEmail,
      subject,
      body: text,
    })

    await supabaseAdmin
      .from('provider_letters')
      .update({
        emailed_at: new Date().toISOString(),
        emailed_to: recipientEmail,
        recipient_email: letter.recipient_email || recipientEmail,
      })
      .eq('id', letterId)

    return NextResponse.json({ success: true, data: { emailedTo: recipientEmail } })
  } catch (error: any) {
    console.error('❌ letters/email error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 },
    )
  }
}
