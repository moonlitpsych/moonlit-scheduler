import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: appointmentId } = await params
    const body = await request.json()
    const { googleMeetLink } = body

    // Validate Google Meet link format (optional but recommended)
    if (googleMeetLink && !isValidGoogleMeetUrl(googleMeetLink)) {
      return NextResponse.json(
        { error: 'Invalid Google Meet URL format' },
        { status: 400 }
      )
    }

    // Update appointment
    const { data, error } = await supabaseAdmin
      .from('appointments')
      .update({
        practiceq_generated_google_meet: googleMeetLink || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', appointmentId)
      .select('id, practiceq_generated_google_meet, start_time, patient_id')
      .single()

    if (error) {
      console.error('Error updating Google Meet link:', error)
      return NextResponse.json(
        { error: 'Failed to update Google Meet link' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      appointment: data
    })

  } catch (error: any) {
    console.error('Error in update-google-meet:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

function isValidGoogleMeetUrl(url: string): boolean {
  if (!url || url.trim() === '') return true // Allow clearing the field

  // Valid Google Meet URL patterns:
  // https://meet.google.com/xxx-xxxx-xxx
  // https://meet.google.com/lookup/xxxxx
  const googleMeetPattern = /^https:\/\/meet\.google\.com\/(lookup\/)?[\w-]+$/

  return googleMeetPattern.test(url.trim())
}
