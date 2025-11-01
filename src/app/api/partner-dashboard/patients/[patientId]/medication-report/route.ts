/**
 * Medication Report API Endpoint
 * POST: Generate medication report for a completed appointment
 * GET: Download existing report PDF
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'
import { generateMedicationReport } from '@/lib/services/medicationReportService'
import emailService from '@/lib/services/emailService'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ patientId: string }> }
) {
  try {
    // Await params (Next.js 15 requirement)
    const { patientId } = await params

    // 1. Authenticate partner user
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const {
      data: { session },
      error: sessionError
    } = await supabase.auth.getSession()

    if (sessionError || !session) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    // 2. Get partner user
    const { data: partnerUser, error: userError } = await supabaseAdmin
      .from('partner_users')
      .select('id, organization_id, role, is_active')
      .eq('auth_user_id', session.user.id)
      .eq('is_active', true)
      .single()

    if (userError || !partnerUser) {
      return NextResponse.json({ success: false, error: 'Partner user not found' }, { status: 404 })
    }

    // 3. Verify role (admin or case_manager)
    if (partnerUser.role !== 'partner_admin' && partnerUser.role !== 'partner_case_manager') {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // 4. Parse request body
    const body = await request.json()
    const { appointment_id, send_email = false, custom_email } = body

    if (!appointment_id) {
      return NextResponse.json({ success: false, error: 'appointment_id is required' }, { status: 400 })
    }

    // Validate email if sending
    if (send_email && !custom_email) {
      return NextResponse.json(
        { success: false, error: 'custom_email is required when send_email is true' },
        { status: 400 }
      )
    }

    // 5. Check ROI consent
    const { data: affiliation, error: affiliationError } = await supabaseAdmin
      .from('patient_organization_affiliations')
      .select('consent_on_file, consent_expires_on')
      .eq('patient_id', patientId)
      .eq('organization_id', partnerUser.organization_id)
      .eq('status', 'active')
      .single()

    if (affiliationError || !affiliation) {
      return NextResponse.json(
        { success: false, error: 'No active affiliation found' },
        { status: 404 }
      )
    }

    if (!affiliation.consent_on_file) {
      return NextResponse.json(
        { success: false, error: 'ROI consent required to generate medication report' },
        { status: 403 }
      )
    }

    // Check if consent is expired
    if (
      affiliation.consent_expires_on &&
      new Date(affiliation.consent_expires_on) < new Date()
    ) {
      return NextResponse.json(
        { success: false, error: 'ROI consent has expired' },
        { status: 403 }
      )
    }

    // 6. Check for existing report for this appointment
    const { data: existingReport } = await supabaseAdmin
      .from('medication_reports')
      .select('id, pdf_url, pdf_generated_at')
      .eq('appointment_id', appointment_id)
      .eq('patient_id', patientId)
      .single()

    if (existingReport) {
      console.log('⚠️ Report already exists for this appointment, regenerating...')
      // Could either return existing or regenerate - let's regenerate for now
    }

    // 7. Generate report
    console.log('📋 Generating medication report...', {
      patientId: patientId,
      appointmentId: appointment_id,
      generatedBy: partnerUser.id
    })

    const result = await generateMedicationReport({
      patientId: patientId,
      appointmentId: appointment_id,
      generatedBy: partnerUser.id
    })

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Report generation failed' },
        { status: 500 }
      )
    }

    // 8. Send email if requested
    let emailSent = false
    if (send_email && custom_email && result.pdfUrl) {
      try {
        // Get organization info and patient/appointment data
        const { data: org } = await supabaseAdmin
          .from('organizations')
          .select('name')
          .eq('id', partnerUser.organization_id)
          .single()

        const { data: patient } = await supabaseAdmin
          .from('patients')
          .select('first_name, last_name')
          .eq('id', patientId)
          .single()

        const { data: appointment } = await supabaseAdmin
          .from('appointments')
          .select('start_time')
          .eq('id', appointment_id)
          .single()

        // Send email to custom email address
        await emailService.sendMedicationReport({
          to: [custom_email],
          organizationName: org?.name || 'Your Organization',
          patientName: patient ? `${patient.first_name} ${patient.last_name}` : 'Patient',
          appointmentDate: appointment
            ? new Date(appointment.start_time).toLocaleDateString()
            : 'Unknown',
          pdfUrl: result.pdfUrl,
          hasChanges: result.hasChanges
        })

        emailSent = true
        console.log('✅ Medication report email sent to:', custom_email)

        // Update report record
        await supabaseAdmin
          .from('medication_reports')
          .update({
            email_sent_at: new Date().toISOString(),
            email_sent_to: [custom_email],
            status: 'sent'
          })
          .eq('id', result.reportId)
      } catch (emailError: any) {
        console.error('❌ Failed to send email:', emailError.message)
        // Don't fail the request if email fails
      }
    }

    // 9. Log activity
    await supabaseAdmin.from('patient_activity_log').insert({
      patient_id: patientId,
      activity_type: 'medication_report_generated',
      description: `Medication report generated by ${partnerUser.role}`,
      metadata: {
        report_id: result.reportId,
        appointment_id: appointment_id,
        has_changes: result.hasChanges,
        email_sent: emailSent
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        reportId: result.reportId,
        pdfUrl: result.pdfUrl,
        hasChanges: result.hasChanges,
        noChangeIndicator: result.noChangeIndicator,
        emailSent
      }
    })
  } catch (error: any) {
    console.error('❌ Medication report API error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { patientId: string } }
) {
  try {
    // Authenticate and get report download URL
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const {
      data: { session },
      error: sessionError
    } = await supabase.auth.getSession()

    if (sessionError || !session) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const reportId = searchParams.get('reportId')

    if (!reportId) {
      return NextResponse.json({ success: false, error: 'reportId is required' }, { status: 400 })
    }

    // Get report
    const { data: report, error: reportError } = await supabaseAdmin
      .from('medication_reports')
      .select('pdf_url')
      .eq('id', reportId)
      .eq('patient_id', patientId)
      .single()

    if (reportError || !report || !report.pdf_url) {
      return NextResponse.json({ success: false, error: 'Report not found' }, { status: 404 })
    }

    // Create signed URL
    const { data: signedUrlData } = await supabaseAdmin.storage
      .from('medication-reports')
      .createSignedUrl(report.pdf_url, 60 * 60) // 1 hour

    if (!signedUrlData) {
      return NextResponse.json({ success: false, error: 'Failed to generate download URL' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        downloadUrl: signedUrlData.signedUrl
      }
    })
  } catch (error: any) {
    console.error('❌ Download medication report error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
