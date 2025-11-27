/**
 * Debug endpoint to fetch raw IntakeQ appointment data
 *
 * GET /api/debug/intakeq-appointment?id=<pq_appointment_id>
 *
 * This helps diagnose why Google Meet links aren't being synced
 */

import { NextRequest, NextResponse } from 'next/server'

const INTAKEQ_API_KEY = process.env.INTAKEQ_API_KEY || ''

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const appointmentId = searchParams.get('id')

  if (!appointmentId) {
    return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 })
  }

  if (!INTAKEQ_API_KEY) {
    return NextResponse.json({ error: 'INTAKEQ_API_KEY not configured' }, { status: 500 })
  }

  try {
    const response = await fetch(`https://intakeq.com/api/v1/appointments/${appointmentId}`, {
      headers: {
        'X-Auth-Key': INTAKEQ_API_KEY,
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json({
        error: `IntakeQ API error: ${response.status}`,
        details: errorText
      }, { status: response.status })
    }

    const data = await response.json()

    // Return the full raw response with special attention to telehealth fields
    return NextResponse.json({
      rawAppointment: data,
      telehealthFields: {
        TelehealthInfo: data.TelehealthInfo || null,
        VideoUrl: data.VideoUrl || null,
        MeetingUrl: data.MeetingUrl || null,
        GoogleMeetUrl: data.GoogleMeetUrl || null,
        // Check all top-level fields for anything with 'url', 'meet', 'video', or 'telehealth'
        possibleUrlFields: Object.entries(data)
          .filter(([key, value]) => {
            const keyLower = key.toLowerCase()
            return (keyLower.includes('url') ||
                    keyLower.includes('meet') ||
                    keyLower.includes('video') ||
                    keyLower.includes('telehealth') ||
                    keyLower.includes('link')) &&
                   value !== null && value !== undefined
          })
          .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {})
      }
    })
  } catch (error: any) {
    return NextResponse.json({
      error: 'Failed to fetch from IntakeQ',
      message: error.message
    }, { status: 500 })
  }
}
