// IntakeQ webhook endpoint to receive appointment notifications
import { NextRequest, NextResponse } from 'next/server'

interface IntakeQWebhookPayload {
  EventType: string
  ActionPerformedByClient: boolean
  Appointment: {
    Id: string
    PractitionerId: string
    ClientId: string
    ClientName: string
    PractitionerName: string
    ServiceName: string
    Status: string
    UtcDateTime: number
    LocationName?: string
    // ... other appointment properties
  }
  ClientId?: string
  PracticeId?: string
}

export async function POST(request: NextRequest) {
  try {
    // Log all webhook details for debugging
    const authKey = request.headers.get('X-Auth-Key')
    const userAgent = request.headers.get('User-Agent')
    const contentType = request.headers.get('Content-Type')
    
    console.log('🔍 Webhook request details:')
    console.log('   Auth Key:', authKey ? 'Present' : 'Missing')
    console.log('   User Agent:', userAgent)
    console.log('   Content Type:', contentType)
    console.log('   Headers:', Object.fromEntries(request.headers.entries()))
    
    // Temporarily allow all requests for testing
    // TODO: Re-enable auth check after webhook is working
    // const expectedKey = process.env.INTAKEQ_API_KEY
    // if (!authKey || authKey !== expectedKey) {
    //   console.log('❌ Unauthorized webhook request')
    //   return NextResponse.json(
    //     { error: 'Unauthorized' },
    //     { status: 401 }
    //   )
    // }

    const payload: IntakeQWebhookPayload = await request.json()
    
    console.log('📨 IntakeQ webhook received:', {
      eventType: payload.EventType,
      appointmentId: payload.Appointment?.Id,
      clientName: payload.Appointment?.ClientName,
      practitionerName: payload.Appointment?.PractitionerName
    })

    // Only process AppointmentCreated events
    if (payload.EventType === 'AppointmentCreated') {
      await handleAppointmentCreated(payload)
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Webhook processed successfully' 
    })

  } catch (error: any) {
    console.error('❌ IntakeQ webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed', details: error.message },
      { status: 500 }
    )
  }
}

async function handleAppointmentCreated(payload: IntakeQWebhookPayload) {
  console.log('🎯 Processing AppointmentCreated webhook...')
  
  const { Appointment } = payload
  
  // Convert UTC timestamp to readable date/time
  const appointmentDate = new Date(Appointment.UtcDateTime)
  const dateStr = appointmentDate.toLocaleDateString()
  const timeStr = appointmentDate.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  })

  // Send admin notification email
  await sendAdminWebhookNotification({
    appointmentId: Appointment.Id,
    clientName: Appointment.ClientName,
    practitionerName: Appointment.PractitionerName,
    serviceName: Appointment.ServiceName,
    appointmentDate: dateStr,
    appointmentTime: timeStr,
    status: Appointment.Status,
    locationName: Appointment.LocationName || 'Default Location'
  })
}

async function sendAdminWebhookNotification(details: {
  appointmentId: string
  clientName: string
  practitionerName: string
  serviceName: string
  appointmentDate: string
  appointmentTime: string
  status: string
  locationName: string
}) {
  console.log('📧 Sending admin webhook notification...')
  
  // For now, just log the notification - we can integrate a real email service later
  const emailContent = `
🎯 IntakeQ Appointment Created (via Webhook)

APPOINTMENT DETAILS:
• Patient: ${details.clientName}
• Provider: ${details.practitionerName}
• Service: ${details.serviceName}
• Date: ${details.appointmentDate}
• Time: ${details.appointmentTime}
• Status: ${details.status}
• Location: ${details.locationName}

SYSTEM DETAILS:
• IntakeQ Appointment ID: ${details.appointmentId}
• Notification Source: IntakeQ Webhook
• Event Type: AppointmentCreated

NEXT STEPS:
✅ Appointment has been created in IntakeQ
✅ Patient and practitioner have been notified by IntakeQ
✅ Admin notification sent via webhook

---
This notification was triggered by IntakeQ's webhook system.
  `.trim()

  console.log('📬 ADMIN WEBHOOK EMAIL:')
  console.log('To: hello@trymoonlit.com')
  console.log('Subject: New IntakeQ Appointment - ' + details.clientName + ' with ' + details.practitionerName)
  console.log('Body:')
  console.log('---')
  console.log(emailContent)
  console.log('---\n')

  // TODO: Replace with actual email service integration
  // This webhook approach means we can use any email service we want
  // Example with simple fetch to email service:
  // await fetch('/api/send-email', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({
  //     to: 'hello@trymoonlit.com',
  //     subject: `New IntakeQ Appointment - ${details.clientName} with ${details.practitionerName}`,
  //     body: emailContent
  //   })
  // })
}

// GET endpoint for webhook verification (some services require this)
export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    message: 'IntakeQ webhook endpoint is active',
    timestamp: new Date().toISOString()
  })
}