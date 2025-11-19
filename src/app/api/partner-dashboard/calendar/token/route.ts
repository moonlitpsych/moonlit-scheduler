/**
 * Partner Dashboard API - Calendar Token Management
 * Generate and retrieve calendar subscription tokens
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'
import { randomBytes } from 'crypto'

/**
 * GET - Retrieve current calendar token (or generate if missing)
 */
export async function GET(request: NextRequest) {
  try {
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
      .select('id, calendar_token, full_name')
      .eq('auth_user_id', session.user.id)
      .eq('is_active', true)
      .single()

    if (userError || !partnerUser) {
      return NextResponse.json(
        { success: false, error: 'Partner user not found' },
        { status: 404 }
      )
    }

    // Generate token if missing
    let calendarToken = partnerUser.calendar_token

    if (!calendarToken) {
      calendarToken = generateCalendarToken()

      const { error: updateError } = await supabaseAdmin
        .from('partner_users')
        .update({ calendar_token: calendarToken })
        .eq('id', partnerUser.id)

      if (updateError) {
        console.error('Error generating calendar token:', updateError)
        return NextResponse.json(
          { success: false, error: 'Failed to generate calendar token' },
          { status: 500 }
        )
      }
    }

    // Generate calendar feed URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const feedUrl = `${baseUrl}/api/partner-dashboard/calendar/feed?token=${calendarToken}`

    return NextResponse.json({
      success: true,
      data: {
        calendar_token: calendarToken,
        feed_url: feedUrl,
        instructions: {
          outlook: 'In Outlook, go to Calendar > Add Calendar > Subscribe from web, then paste the feed URL',
          google: 'In Google Calendar, click the + next to "Other calendars" > From URL, then paste the feed URL',
          apple: 'In Calendar app, go to File > New Calendar Subscription, then paste the feed URL',
          other: 'Copy the feed URL and add it as a calendar subscription in your calendar app'
        }
      }
    })

  } catch (error: any) {
    console.error('❌ Error retrieving calendar token:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve calendar token', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST - Regenerate calendar token (invalidates old token)
 */
export async function POST(request: NextRequest) {
  try {
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
      .select('id, full_name')
      .eq('auth_user_id', session.user.id)
      .eq('is_active', true)
      .single()

    if (userError || !partnerUser) {
      return NextResponse.json(
        { success: false, error: 'Partner user not found' },
        { status: 404 }
      )
    }

    // Generate new token
    const newToken = generateCalendarToken()

    const { error: updateError } = await supabaseAdmin
      .from('partner_users')
      .update({ calendar_token: newToken })
      .eq('id', partnerUser.id)

    if (updateError) {
      console.error('Error regenerating calendar token:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to regenerate calendar token' },
        { status: 500 }
      )
    }

    // Generate new feed URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const feedUrl = `${baseUrl}/api/partner-dashboard/calendar/feed?token=${newToken}`

    return NextResponse.json({
      success: true,
      data: {
        calendar_token: newToken,
        feed_url: feedUrl,
        message: 'Calendar token regenerated. Please update your calendar subscription with the new URL.'
      }
    })

  } catch (error: any) {
    console.error('❌ Error regenerating calendar token:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to regenerate calendar token', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * Generates a secure random calendar token
 */
function generateCalendarToken(): string {
  return randomBytes(32).toString('hex')
}
