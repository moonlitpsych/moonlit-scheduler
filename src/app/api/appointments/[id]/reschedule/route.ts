// Appointment Reschedule API - Push to EHR, update DB on success, with audit
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { intakeQService } from '@/lib/services/intakeQService'
import { athenaService } from '@/lib/services/athenaService'
import { emailService } from '@/lib/services/emailService'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: appointmentId } = params
    const body = await request.json()
    
    // Get partner user ID from headers
    const partnerUserId = request.headers.get('x-partner-user-id')
    
    if (!partnerUserId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Partner user authentication required' 
        },
        { status: 401 }
      )
    }

    // Validate request body
    const { new_start_time, new_end_time, reason, notify_patient = true } = body
    
    if (!new_start_time || !new_end_time) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'New start and end times are required' 
        },
        { status: 400 }
      )
    }

    console.log('🔄 Processing appointment reschedule:', { 
      appointmentId, 
      new_start_time, 
      new_end_time,
      reason,
      partner_user_id: partnerUserId
    })

    // Get partner user's organization
    const { data: partnerUser, error: userError } = await supabaseAdmin
      .from('partner_users')
      .select('organization_id, first_name, last_name, email')
      .eq('id', partnerUserId)
      .eq('status', 'active')
      .single()

    if (userError || !partnerUser?.organization_id) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Partner user or organization not found' 
        },
        { status: 404 }
      )
    }

    // Get appointment details and verify organization access
    const { data: appointment, error: appointmentError } = await supabaseAdmin
      .from('appointments')
      .select(`
        *,
        providers(id, first_name, last_name, intakeq_practitioner_id, athena_provider_id),
        patients!inner(
          id,
          first_name,
          last_name,
          email,
          phone,
          intakeq_client_id,
          patient_affiliations!inner(
            organization_id,
            status
          )
        )
      `)
      .eq('id', appointmentId)
      .single()

    if (appointmentError || !appointment) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Appointment not found' 
        },
        { status: 404 }
      )
    }

    // Verify organization access
    const hasAccess = appointment.patients.patient_affiliations.some(
      (affiliation: any) => 
        affiliation.organization_id === partnerUser.organization_id && 
        affiliation.status === 'active'
    )

    if (!hasAccess) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Access denied: Patient not affiliated with your organization' 
        },
        { status: 403 }
      )
    }

    // Validate appointment can be rescheduled
    const now = new Date()
    const appointmentTime = new Date(appointment.start_time)
    const hoursUntilAppt = (appointmentTime.getTime() - now.getTime()) / (1000 * 60 * 60)
    
    if (hoursUntilAppt < 24) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Appointment cannot be rescheduled less than 24 hours in advance' 
        },
        { status: 400 }
      )
    }

    if (['cancelled', 'completed', 'no_show'].includes(appointment.status)) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Appointment cannot be rescheduled (status: ${appointment.status})` 
        },
        { status: 400 }
      )
    }

    // Step 1: Check availability of new time slot
    const { data: conflictingAppointments } = await supabaseAdmin
      .from('appointments')
      .select('id')
      .eq('provider_id', appointment.provider_id)
      .gte('start_time', new_start_time)
      .lte('end_time', new_end_time)
      .neq('id', appointmentId)
      .neq('status', 'cancelled')

    if (conflictingAppointments && conflictingAppointments.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'New time slot conflicts with existing appointment' 
        },
        { status: 409 }
      )
    }

    // Step 2: Push update to EHR (determine EHR system and call appropriate service)
    let ehrUpdateSuccess = false
    let ehrError = null
    let ehrSystem = 'none'

    try {
      // Determine EHR system and update accordingly
      if (appointment.emr_appointment_id && appointment.providers?.intakeq_practitioner_id) {
        // IntakeQ appointment
        ehrSystem = 'intakeq'
        console.log('🔄 Updating IntakeQ appointment:', appointment.emr_appointment_id)
        
        const intakeQResult = await intakeQService.rescheduleAppointment(
          appointment.emr_appointment_id,
          {
            startTime: new_start_time,
            endTime: new_end_time,
            reason: reason || 'Rescheduled by partner organization'
          }
        )
        
        ehrUpdateSuccess = intakeQResult.success
        if (!ehrUpdateSuccess) {
          ehrError = 'IntakeQ reschedule failed'
        }
      } else if (appointment.emr_appointment_id && appointment.providers?.athena_provider_id) {
        // Athena appointment
        ehrSystem = 'athena'
        console.log('🔄 Updating Athena appointment:', appointment.emr_appointment_id)
        
        // Parse date and time components for Athena format
        const newStartDate = new Date(new_start_time)
        const newEndDate = new Date(new_end_time)
        
        const athenaResult = await athenaService.rescheduleAppointment(
          appointment.emr_appointment_id,
          {
            date: newStartDate.toISOString().split('T')[0], // YYYY-MM-DD
            startTime: newStartDate.toTimeString().substring(0, 5), // HH:MM
            endTime: newEndDate.toTimeString().substring(0, 5), // HH:MM
            reason: reason || 'Rescheduled by partner organization'
          }
        )
        
        ehrUpdateSuccess = athenaResult.success
        if (!ehrUpdateSuccess) {
          ehrError = 'Athena reschedule failed'
        }
      } else {
        console.warn('⚠️ No EHR integration available for appointment:', appointmentId)
        ehrUpdateSuccess = true // Proceed without EHR update
      }
    } catch (error: any) {
      console.error(`❌ ${ehrSystem} EHR update failed:`, error)
      ehrError = error.message
    }

    // Step 3: Update database only if EHR update succeeded (or no EHR integration)
    if (ehrUpdateSuccess) {
      const { data: updatedAppointment, error: updateError } = await supabaseAdmin
        .from('appointments')
        .update({
          start_time: new_start_time,
          end_time: new_end_time,
          status: 'rescheduled',
          notes: appointment.notes ? 
            `${appointment.notes}\n\nRescheduled by ${partnerUser.first_name} ${partnerUser.last_name} (${partnerUser.email}) on ${new Date().toISOString()}. Reason: ${reason || 'No reason provided'}` :
            `Rescheduled by ${partnerUser.first_name} ${partnerUser.last_name} (${partnerUser.email}) on ${new Date().toISOString()}. Reason: ${reason || 'No reason provided'}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', appointmentId)
        .select()
        .single()

      if (updateError) {
        console.error('❌ Database update failed:', updateError)
        return NextResponse.json(
          { 
            success: false, 
            error: 'Failed to update appointment in database',
            details: updateError.message
          },
          { status: 500 }
        )
      }

      // Step 4: Create audit log
      await supabaseAdmin
        .from('scheduler_audit_logs')
        .insert({
          action: 'appointment_rescheduled',
          resource_type: 'appointment',
          resource_id: appointmentId,
          details: {
            original_start_time: appointment.start_time,
            original_end_time: appointment.end_time,
            new_start_time,
            new_end_time,
            reason: reason || 'No reason provided',
            rescheduled_by: {
              partner_user_id: partnerUserId,
              name: `${partnerUser.first_name} ${partnerUser.last_name}`,
              email: partnerUser.email,
              organization_id: partnerUser.organization_id
            },
            patient: {
              id: appointment.patients.id,
              name: `${appointment.patients.first_name} ${appointment.patients.last_name}`
            },
            provider: {
              id: appointment.provider_id,
              name: `${appointment.providers?.first_name} ${appointment.providers?.last_name}`
            },
            ehr_system: ehrSystem,
            ehr_update_success: ehrUpdateSuccess,
            notify_patient
          }
        })

      // Step 5: Send notifications (if requested)
      if (notify_patient && appointment.patients.email) {
        try {
          await sendRescheduleNotification({
            patientEmail: appointment.patients.email,
            patientName: `${appointment.patients.first_name} ${appointment.patients.last_name}`,
            providerName: `Dr. ${appointment.providers?.first_name} ${appointment.providers?.last_name}`,
            oldDateTime: appointment.start_time,
            newDateTime: new_start_time,
            reason: reason || 'Schedule adjustment requested by your care team'
          })
        } catch (notificationError) {
          console.warn('⚠️ Failed to send notification:', notificationError)
          // Don't fail the request if notification fails
        }
      }

      console.log('✅ Appointment rescheduled successfully:', {
        appointmentId,
        old_time: appointment.start_time,
        new_time: new_start_time,
        rescheduled_by: partnerUser.email
      })

      return NextResponse.json({
        success: true,
        data: {
          appointment: updatedAppointment,
          reschedule_details: {
            original_start_time: appointment.start_time,
            original_end_time: appointment.end_time,
            new_start_time,
            new_end_time,
            reason: reason || 'No reason provided',
            rescheduled_by: `${partnerUser.first_name} ${partnerUser.last_name}`,
            ehr_system: ehrSystem,
            ehr_updated: ehrUpdateSuccess,
            notification_sent: notify_patient
          }
        },
        message: 'Appointment rescheduled successfully'
      })

    } else {
      // EHR update failed - don't update database
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to update appointment in EHR system',
          details: ehrError
        },
        { status: 502 }
      )
    }

  } catch (error: any) {
    console.error('❌ Appointment reschedule error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to reschedule appointment',
        details: error.message
      },
      { status: 500 }
    )
  }
}

// Helper function to send reschedule notification
async function sendRescheduleNotification(params: {
  patientEmail: string
  patientName: string
  providerName: string
  oldDateTime: string
  newDateTime: string
  reason: string
}) {
  try {
    console.log('📧 Sending reschedule notification to:', params.patientEmail)
    
    // Format dates for display
    const oldDate = new Date(params.oldDateTime)
    const newDate = new Date(params.newDateTime)
    
    const formatDateTime = (date: Date) => {
      return date.toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric', 
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short'
      })
    }

    // Create reschedule notification email
    const subject = 'Your Appointment Has Been Rescheduled'
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #091747;">Appointment Rescheduled</h2>
        
        <p>Dear ${params.patientName},</p>
        
        <p>Your appointment with ${params.providerName} has been rescheduled.</p>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #091747; margin-top: 0;">Previous Appointment:</h3>
          <p style="text-decoration: line-through; color: #6c757d;">${formatDateTime(oldDate)}</p>
          
          <h3 style="color: #091747;">New Appointment:</h3>
          <p style="font-weight: bold; color: #28a745;">${formatDateTime(newDate)}</p>
        </div>
        
        <p><strong>Reason:</strong> ${params.reason}</p>
        
        <p>If you have any questions or concerns about this change, please contact our office at <a href="mailto:hello@trymoonlit.com">hello@trymoonlit.com</a>.</p>
        
        <p>Thank you,<br>
        The Moonlit Psychiatry Team</p>
      </div>
    `
    
    // Use existing email service
    await emailService.sendEmail({
      to: params.patientEmail,
      subject,
      html: htmlContent,
      from: 'hello@trymoonlit.com'
    })
    
    console.log('✅ Reschedule notification sent successfully')
    return { success: true }
  } catch (error: any) {
    console.error('❌ Notification failed:', error)
    // Log to console as fallback
    console.log('📧 Reschedule notification (fallback):', params)
    return { success: false, error: error.message }
  }
}