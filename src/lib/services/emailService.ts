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
    
    try {
      // Send notification to admin
      await this.sendAdminNotification(appointmentDetails)
      
      // Send notification to practitioner
      await this.sendPractitionerNotification(appointmentDetails)
      
      console.log('✅ All appointment notifications sent successfully')
    } catch (error: any) {
      console.error('❌ Failed to send appointment notifications:', error.message)
      // Don't throw - email failure shouldn't break appointment creation
    }
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
✅ Practitioner has been notified
⏳ Awaiting practitioner confirmation

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
    // For now, this is a placeholder that logs the email
    // In production, you would integrate with a service like:
    // - SendGrid
    // - AWS SES
    // - Resend
    // - Nodemailer with SMTP
    
    console.log('📬 EMAIL TO SEND:')
    console.log(`To: ${params.to}`)
    console.log(`Subject: ${params.subject}`)
    console.log('Body:')
    console.log('---')
    console.log(params.body)
    console.log('---\n')
    
    // Simulate email sending delay
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // TODO: Replace with actual email service integration
    // Example with Resend:
    // const resend = new Resend(process.env.RESEND_API_KEY)
    // await resend.emails.send({
    //   from: 'notifications@trymoonlit.com',
    //   to: params.to,
    //   subject: params.subject,
    //   text: params.body
    // })
  }
}

// Create and export singleton instance
export const emailService = new EmailService()
export default emailService