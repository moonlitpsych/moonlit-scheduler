// Email notification service for appointment bookings
interface AppointmentDetails {
  appointmentId: string
  emrAppointmentId?: string
  provider: {
    id: string
    name: string
    email: string
  }
  patient: {
    name: string
    email: string
    phone: string
  }
  schedule: {
    date: string
    startTime: string
    endTime: string
    duration: string
  }
  emrSystem: string
  payerName?: string
}

class EmailService {
  
  async sendAppointmentNotifications(appointmentDetails: AppointmentDetails): Promise<void> {
    console.log('📧 Sending appointment notifications...')

    // Send admin notification
    try {
      await this.sendAdminNotification(appointmentDetails)
      console.log('✅ Admin notification sent successfully')
    } catch (error: any) {
      console.error('❌ Failed to send admin notification:', error.message)
      // Don't throw - email failure shouldn't break appointment creation
    }

    // Send provider notification
    try {
      await this.sendPractitionerNotification(appointmentDetails)
      console.log('✅ Provider notification sent successfully')
    } catch (error: any) {
      console.error('❌ Failed to send provider notification:', error.message)
      // Don't throw - email failure shouldn't break appointment creation
    }

    // IntakeQ handles patient emails natively
    console.log('ℹ️ Patient notification handled by IntakeQ natively')
  }

  // Future method for handling bounced emails from IntakeQ
  async sendFallbackPatientNotification(appointmentDetails: AppointmentDetails, alternateEmail?: string): Promise<void> {
    console.log('📧 Sending fallback patient notification...')
    
    const subject = `Appointment Confirmation - ${appointmentDetails.schedule.date}`
    
    const emailBody = `
Dear ${appointmentDetails.patient.name.split(' ')[0]},

Your appointment has been successfully scheduled:

APPOINTMENT DETAILS:
• Provider: ${appointmentDetails.provider.name}
• Date: ${appointmentDetails.schedule.date}
• Time: ${appointmentDetails.schedule.startTime}
• Duration: ${appointmentDetails.schedule.duration}
• Location: Telehealth (link will be provided separately)

IMPORTANT NOTES:
• Please arrive 5-10 minutes early for your telehealth appointment
• You will receive a separate email with the meeting link
• If you need to reschedule, please call us at least 24 hours in advance

Questions? Contact us at hello@trymoonlit.com or ${appointmentDetails.patient.phone}

Best regards,
Moonlit Psychiatry Team
    `.trim()

    const recipientEmail = alternateEmail || appointmentDetails.patient.email
    
    await this.sendEmail({
      to: recipientEmail,
      subject,
      body: emailBody
    })

    console.log(`📧 Fallback patient notification sent to ${recipientEmail}`)
  }

  private async sendAdminNotification(details: AppointmentDetails): Promise<void> {
    const subject = `New Appointment Booked - ${details.patient.name} with ${details.provider.name}`
    
    const emailBody = `
🎯 New Appointment Booking Alert

APPOINTMENT DETAILS:
• Patient: ${details.patient.name}
• Email: ${details.patient.email}
• Phone: ${details.patient.phone}
• Provider: ${details.provider.name}
• Date: ${details.schedule.date}
• Time: ${details.schedule.startTime} - ${details.schedule.endTime}
• Duration: ${details.schedule.duration}

SYSTEM DETAILS:
• Local Appointment ID: ${details.appointmentId}
• ${details.emrSystem.toUpperCase()} Appointment ID: ${details.emrAppointmentId || 'Not created'}
• Payer: ${details.payerName || 'Unknown'}

NEXT STEPS:
✅ Appointment has been automatically created in ${details.emrSystem.toUpperCase()}
ℹ️ Patient & Practitioner notifications handled by ${details.emrSystem.toUpperCase()} natively
⏳ Check IntakeQ dashboard to verify appointment appears correctly

---
This booking was created through the Moonlit Scheduler widget.
    `.trim()

    await this.sendEmail({
      to: 'hello@trymoonlit.com',
      subject,
      body: emailBody
    })

    console.log('📧 Admin notification sent to hello@trymoonlit.com')
  }

  private async sendPractitionerNotification(details: AppointmentDetails): Promise<void> {
    const subject = `New Patient Appointment - ${details.schedule.date} at ${details.schedule.startTime}`
    
    const emailBody = `
👋 Hi ${details.provider.name.split(' ')[0]},

You have a new patient appointment that needs confirmation:

PATIENT INFORMATION:
• Name: ${details.patient.name}
• Email: ${details.patient.email}
• Phone: ${details.patient.phone}

APPOINTMENT DETAILS:
• Date: ${details.schedule.date}
• Time: ${details.schedule.startTime} - ${details.schedule.endTime}
• Duration: ${details.schedule.duration}

CONFIRMATION REQUIRED:
This appointment has been automatically added to your ${details.emrSystem.toUpperCase()} calendar, but please:

1. ✅ Confirm the appointment time works for you
2. ✅ Review the patient information
3. ✅ Reach out to the patient if needed: ${details.patient.email}

${details.emrSystem.toUpperCase()} APPOINTMENT ID: ${details.emrAppointmentId || 'Not created'}
MOONLIT APPOINTMENT ID: ${details.appointmentId}

If you have any questions, contact the admin team at hello@trymoonlit.com.

Best regards,
Moonlit Scheduler Team
    `.trim()

    await this.sendEmail({
      to: details.provider.email,
      subject,
      body: emailBody
    })

    console.log(`📧 Practitioner notification sent to ${details.provider.email}`)
  }

  private async sendEmail(params: { to: string; subject: string; body: string }): Promise<void> {
    // Check if we have Resend API key configured
    const resendApiKey = process.env.RESEND_API_KEY
    
    if (!resendApiKey) {
      console.log('⚠️ No RESEND_API_KEY found - logging email instead of sending:')
      console.log('📬 EMAIL TO SEND:')
      console.log(`To: ${params.to}`)
      console.log(`Subject: ${params.subject}`)
      console.log('Body:')
      console.log('---')
      console.log(params.body)
      console.log('---\n')
      return
    }

    try {
      // Use Resend to send actual emails
      const { Resend } = await import('resend')
      const resend = new Resend(resendApiKey)

      const { data, error } = await resend.emails.send({
        from: process.env.FROM_EMAIL || 'Moonlit Scheduler <notifications@trymoonlit.com>',
        to: params.to,
        subject: params.subject,
        text: params.body,
      })

      if (error) {
        throw new Error(`Resend API error: ${error.message}`)
      }

      console.log(`✅ Email sent successfully to ${params.to} (ID: ${data?.id})`)
      
    } catch (error: any) {
      console.error(`❌ Failed to send email to ${params.to}:`, error.message)
      
      // Fallback: log the email content so it's not lost
      console.log('📬 EMAIL CONTENT (fallback):')
      console.log(`To: ${params.to}`)
      console.log(`Subject: ${params.subject}`)
      console.log('Body:')
      console.log('---')
      console.log(params.body)
      console.log('---\n')
      
      // Re-throw error so caller knows sending failed
      throw new Error(`Email delivery failed: ${error.message}`)
    }
  }
}

// Create and export singleton instance
export const emailService = new EmailService()
export default emailService