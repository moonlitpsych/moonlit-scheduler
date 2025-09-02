// src/app/api/patient-booking/request-custom-language/route.ts
import { emailService } from '@/lib/services/emailService'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
    try {
        const { 
            customLanguage, 
            patientInfo, 
            selectedPayer, 
            appointmentDetails 
        } = await request.json()

        if (!customLanguage || !patientInfo) {
            return NextResponse.json(
                { success: false, error: 'Custom language and patient info are required' },
                { status: 400 }
            )
        }

        console.log('📧 Processing custom language request:', {
            language: customLanguage,
            payer: selectedPayer?.name,
            patient: patientInfo?.firstName || 'Unknown'
        })

        // Prepare email content
        const emailSubject = `Custom Language Request: ${customLanguage}`
        
        const emailBody = `
New Custom Language Appointment Request

REQUESTED LANGUAGE: ${customLanguage}

PATIENT INFORMATION:
- Name: ${patientInfo.firstName || 'Not provided'} ${patientInfo.lastName || 'Not provided'}
- Email: ${patientInfo.email || 'Not provided'}
- Phone: ${patientInfo.phone || 'Not provided'}

INSURANCE INFORMATION:
- Insurance: ${selectedPayer?.name || 'Not specified'}
- Payer ID: ${selectedPayer?.id || 'N/A'}

APPOINTMENT PREFERENCES:
- Requested Date: ${appointmentDetails?.preferredDate || 'Not specified'}
- Preferred Time: ${appointmentDetails?.preferredTime || 'Not specified'}
- Additional Notes: ${appointmentDetails?.notes || 'None'}

NEXT STEPS:
1. Contact the patient to discuss language accommodation options
2. Identify providers who can conduct appointments in ${customLanguage}
3. Schedule appointment manually if accommodation is possible
4. Follow up within 24-48 hours

This request was generated automatically from the booking system.
        `

        // Send email notification
        try {
            await emailService.sendAdminNotification({
                subject: emailSubject,
                message: emailBody,
                bookingData: {
                    customLanguage,
                    patientInfo,
                    selectedPayer,
                    appointmentDetails
                }
            })
            
            console.log('✅ Custom language request email sent successfully')
            
        } catch (emailError) {
            console.error('⚠️ Failed to send email, but logging request:', emailError)
            // Log to console as fallback
            console.log('📧 CUSTOM LANGUAGE REQUEST (EMAIL FAILED):')
            console.log('Subject:', emailSubject)
            console.log('Body:', emailBody)
        }

        return NextResponse.json({
            success: true,
            message: `Your request for an appointment in ${customLanguage} has been received. We'll contact you within 24-48 hours to discuss accommodation options.`,
            requestId: `custom-lang-${Date.now()}` // Simple request tracking
        })

    } catch (error) {
        console.error('❌ Error processing custom language request:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to process custom language request' },
            { status: 500 }
        )
    }
}