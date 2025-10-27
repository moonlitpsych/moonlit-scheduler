/**
 * Debug endpoint: Test Google Meet API integration
 *
 * Tests if the Google Meet service is properly configured and can generate links
 *
 * GET /api/debug/test-google-meet - Check configuration
 * POST /api/debug/test-google-meet - Generate a test meeting link
 */

import { NextRequest, NextResponse } from 'next/server'
import { googleMeetService } from '@/lib/services/googleMeetService'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Testing Google Meet Service configuration...')

    // Check configuration
    const config = await googleMeetService.checkConfiguration()

    if (!config.configured) {
      return NextResponse.json({
        success: false,
        message: 'Google Meet Service is not properly configured',
        error: config.message,
        details: config.details
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Google Meet Service is properly configured',
      details: config.details
    })

  } catch (error: any) {
    console.error('❌ Error checking Google Meet configuration:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to check configuration',
      details: error.message
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔗 Generating test Google Meet link...')

    // Generate a test meeting link
    const testAppointmentId = `test-${Date.now()}`
    const testPatientName = 'Test Patient'
    const testProviderName = 'Test Provider'
    const testAppointmentTime = new Date(Date.now() + 24 * 60 * 60 * 1000) // Tomorrow

    const meetingUrl = await googleMeetService.generateMeetingLink(
      testAppointmentId,
      testPatientName,
      testProviderName,
      testAppointmentTime
    )

    if (!meetingUrl) {
      return NextResponse.json({
        success: false,
        error: 'Failed to generate meeting link',
        details: 'Check server logs for more information'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully generated Google Meet link',
      data: {
        meetingUrl,
        appointmentId: testAppointmentId,
        appointmentTime: testAppointmentTime.toISOString(),
        note: 'This is a test meeting space. You can join it to verify it works.'
      }
    })

  } catch (error: any) {
    console.error('❌ Error generating Google Meet link:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to generate meeting link',
      details: error.message
    }, { status: 500 })
  }
}