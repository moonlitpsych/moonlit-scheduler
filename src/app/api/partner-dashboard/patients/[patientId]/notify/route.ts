/**
 * Partner Dashboard API - Patient Notifications
 * Resend appointment reminders and intake forms to patients
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'
import { emailService } from '@/lib/services/emailService'

export async function POST(
  request: NextRequest,
  { params }: { params: { patientId: string } }
) {
  try {
    const patientId = params.patientId

    // Get authenticated user
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    if (sessionError || !session) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get partner user record
    const { data: partnerUser, error: userError } = await supabaseAdmin
      .from('partner_users')
      .select('id, organization_id, role, is_active, full_name')
      .eq('auth_user_id', session.user.id)
      .eq('is_active', true)
      .single()

    if (userError || !partnerUser) {
      return NextResponse.json(
        { success: false, error: 'Partner user not found' },
        { status: 404 }
      )
    }

    // Only admin and case_manager can send notifications
    if (!['partner_admin', 'partner_case_manager'].includes(partnerUser.role)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Get request body
    const body = await request.json()
    const { notification_type, appointment_id, message } = body

    if (!notification_type) {
      return NextResponse.json(
        { success: false, error: 'notification_type is required' },
        { status: 400 }
      )
    }

    // Validate notification type
    const validTypes = ['appointment_reminder', 'intake_form', 'general_message']
    if (!validTypes.includes(notification_type)) {
      return NextResponse.json(
        { success: false, error: `Invalid notification_type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Verify patient access (check ROI consent and organization affiliation)
    const { data: affiliation } = await supabaseAdmin
      .from('patient_organization_affiliations')
      .select('consent_on_file, consent_expires_on, status')
      .eq('patient_id', patientId)
      .eq('organization_id', partnerUser.organization_id)
      .eq('status', 'active')
      .single()

    if (!affiliation) {
      return NextResponse.json(
        { success: false, error: 'Patient not affiliated with your organization' },
        { status: 404 }
      )
    }

    // Check ROI consent
    if (!affiliation.consent_on_file) {
      return NextResponse.json(
        { success: false, error: 'No ROI consent on file' },
        { status: 403 }
      )
    }

    if (affiliation.consent_expires_on && new Date(affiliation.consent_expires_on) < new Date()) {
      return NextResponse.json(
        { success: false, error: 'ROI consent has expired' },
        { status: 403 }
      )
    }

    // Get patient details
    const { data: patient, error: patientError } = await supabaseAdmin
      .from('patients')
      .select('first_name, last_name, email')
      .eq('id', patientId)
      .single()

    if (patientError || !patient) {
      return NextResponse.json(
        { success: false, error: 'Patient not found' },
        { status: 404 }
      )
    }

    if (!patient.email) {
      return NextResponse.json(
        { success: false, error: 'Patient email not found' },
        { status: 400 }
      )
    }

    // Handle different notification types
    let emailSubject = ''
    let emailBody = ''
    let appointmentDetails: any = null

    if (notification_type === 'appointment_reminder' || notification_type === 'intake_form') {
      if (!appointment_id) {
        return NextResponse.json(
          { success: false, error: 'appointment_id is required for appointment reminders and intake forms' },
          { status: 400 }
        )
      }

      // Get appointment details
      const { data: appointment, error: apptError } = await supabaseAdmin
        .from('appointments')
        .select(`
          id,
          start_time,
          end_time,
          status,
          location_type,
          providers (
            first_name,
            last_name
          )
        `)
        .eq('id', appointment_id)
        .eq('patient_id', patientId)
        .single()

      if (apptError || !appointment) {
        return NextResponse.json(
          { success: false, error: 'Appointment not found' },
          { status: 404 }
        )
      }

      appointmentDetails = appointment

      const appointmentDate = new Date(appointment.start_time).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })

      const appointmentTime = new Date(appointment.start_time).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'America/Denver'
      })

      const providerName = appointment.providers
        ? `Dr. ${appointment.providers.last_name}`
        : 'your provider'

      if (notification_type === 'appointment_reminder') {
        emailSubject = `Reminder: Upcoming Appointment with ${providerName}`
        emailBody = `
Hi ${patient.first_name},

This is a reminder about your upcoming appointment:

**Appointment Details:**
• Date: ${appointmentDate}
• Time: ${appointmentTime} (Mountain Time)
• Provider: ${providerName}
• Type: ${appointment.location_type === 'telehealth' ? 'Telehealth (Video)' : 'In-Person'}

${message || ''}

If you need to reschedule or have any questions, please contact us.

Best regards,
Moonlit Scheduler
        `.trim()
      } else if (notification_type === 'intake_form') {
        emailSubject = `Action Required: Complete Intake Form for Appointment`
        emailBody = `
Hi ${patient.first_name},

Please complete the intake questionnaire before your upcoming appointment:

**Appointment Details:**
• Date: ${appointmentDate}
• Time: ${appointmentTime} (Mountain Time)
• Provider: ${providerName}

${message || 'Please complete the intake form as soon as possible to ensure we have all necessary information for your appointment.'}

Best regards,
Moonlit Scheduler
        `.trim()
      }
    } else if (notification_type === 'general_message') {
      emailSubject = `Message from Moonlit Scheduler`
      emailBody = `
Hi ${patient.first_name},

${message || 'You have a message from your care team.'}

If you have any questions, please don't hesitate to reach out.

Best regards,
Moonlit Scheduler
      `.trim()
    }

    // Send email notification
    try {
      await emailService.sendEmail({
        to: patient.email,
        subject: emailSubject,
        body: emailBody
      })
    } catch (emailError: any) {
      console.error('Error sending notification email:', emailError)
      return NextResponse.json(
        { success: false, error: 'Failed to send notification email' },
        { status: 500 }
      )
    }

    // Log activity
    const { error: activityError } = await supabaseAdmin
      .from('patient_activity_log')
      .insert({
        patient_id: patientId,
        organization_id: partnerUser.organization_id,
        appointment_id: appointment_id || null,
        activity_type: notification_type === 'appointment_reminder' ? 'reminder_sent' : 'form_sent',
        title: notification_type === 'appointment_reminder'
          ? 'Appointment reminder sent'
          : notification_type === 'intake_form'
          ? 'Intake form reminder sent'
          : 'Message sent',
        description: `Notification sent by ${partnerUser.full_name || 'Case Manager'}`,
        metadata: {
          notification_type,
          appointment_id: appointment_id || null,
          sent_to: patient.email
        },
        actor_type: 'partner_user',
        actor_id: partnerUser.id,
        actor_name: partnerUser.full_name || 'Partner User',
        visible_to_partner: true,
        visible_to_patient: false
      })

    if (activityError) {
      console.error('Error logging notification activity:', activityError)
      // Don't fail the request if activity logging fails
    }

    return NextResponse.json({
      success: true,
      data: {
        patient_id: patientId,
        notification_type,
        sent_to: patient.email,
        sent_at: new Date().toISOString()
      },
      message: 'Notification sent successfully'
    })

  } catch (error: any) {
    console.error('❌ Error sending patient notification:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to send notification', details: error.message },
      { status: 500 }
    )
  }
}
