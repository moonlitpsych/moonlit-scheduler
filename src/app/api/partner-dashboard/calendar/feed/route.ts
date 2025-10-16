/**
 * Partner Dashboard API - iCal Calendar Feed
 * Returns iCalendar feed of patient appointments for calendar subscription
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Generates an iCalendar (ICS) feed for partner user's patients
 * Subscribable URL: /api/partner-dashboard/calendar/feed?token=<calendar_token>
 */
export async function GET(request: NextRequest) {
  try {
    // Get calendar token from query params
    const { searchParams } = new URL(request.url)
    const calendarToken = searchParams.get('token')

    if (!calendarToken) {
      return new NextResponse('Calendar token required', { status: 401 })
    }

    // Find partner user by calendar token
    const { data: partnerUser, error: userError } = await supabaseAdmin
      .from('partner_users')
      .select('id, full_name, organization_id, role, is_active')
      .eq('calendar_token', calendarToken)
      .eq('is_active', true)
      .single()

    if (userError || !partnerUser) {
      return new NextResponse('Invalid calendar token', { status: 401 })
    }

    // Get patient IDs for this user based on role
    let patientIds: string[] = []

    if (partnerUser.role === 'partner_referrer') {
      // Referrers only see patients they referred
      const { data: patients } = await supabaseAdmin
        .from('patients')
        .select('id')
        .eq('referred_by_partner_user_id', partnerUser.id)

      patientIds = patients?.map(p => p.id) || []
    } else {
      // Admin and case managers see all org patients
      const { data: affiliations } = await supabaseAdmin
        .from('patient_organization_affiliations')
        .select('patient_id')
        .eq('organization_id', partnerUser.organization_id)
        .eq('status', 'active')

      patientIds = affiliations?.map(a => a.patient_id) || []
    }

    if (patientIds.length === 0) {
      // Return empty calendar
      const emptyCalendar = generateICalHeader(partnerUser.full_name || 'Partner User')
      return new NextResponse(emptyCalendar, {
        status: 200,
        headers: {
          'Content-Type': 'text/calendar; charset=utf-8',
          'Content-Disposition': 'inline; filename="moonlit-appointments.ics"',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      })
    }

    // Get appointments for these patients (next 90 days)
    const now = new Date()
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 90)

    const { data: appointments, error: appointmentsError } = await supabaseAdmin
      .from('appointments')
      .select(`
        id,
        patient_id,
        start_time,
        end_time,
        status,
        appointment_type,
        location_type,
        notes,
        patients (
          id,
          first_name,
          last_name,
          email
        ),
        providers (
          id,
          first_name,
          last_name
        )
      `)
      .in('patient_id', patientIds)
      .in('status', ['scheduled', 'confirmed'])
      .gte('start_time', now.toISOString())
      .lte('start_time', futureDate.toISOString())
      .order('start_time', { ascending: true })

    if (appointmentsError) {
      console.error('Error fetching appointments for calendar:', appointmentsError)
      return new NextResponse('Failed to generate calendar', { status: 500 })
    }

    // Generate iCal feed
    const icalContent = generateICalFeed(
      appointments || [],
      partnerUser.full_name || 'Partner User'
    )

    return new NextResponse(icalContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="moonlit-appointments.ics"',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })

  } catch (error: any) {
    console.error('❌ Error generating calendar feed:', error)
    return new NextResponse('Failed to generate calendar', { status: 500 })
  }
}

/**
 * Generates iCal header
 */
function generateICalHeader(userName: string): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Moonlit Scheduler//Partner Dashboard//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:Moonlit Appointments - ${userName}`,
    'X-WR-TIMEZONE:America/Denver',
    'X-WR-CALDESC:Patient appointments from Moonlit Scheduler',
    'END:VCALENDAR'
  ].join('\r\n')
}

/**
 * Generates complete iCal feed with events
 */
function generateICalFeed(appointments: any[], userName: string): string {
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

  const events = appointments.map(appt => {
    const patient = appt.patients
    const provider = appt.providers

    const startTime = formatICalDate(appt.start_time)
    const endTime = formatICalDate(appt.end_time)

    const patientName = patient ? `${patient.first_name} ${patient.last_name}` : 'Unknown Patient'
    const providerName = provider ? `Dr. ${provider.last_name}` : 'Provider'

    const summary = `${patientName} - ${providerName}`
    const description = [
      `Patient: ${patientName}`,
      `Provider: ${providerName}`,
      `Status: ${appt.status}`,
      appt.location_type === 'telehealth' ? 'Type: Telehealth' : 'Type: In-person',
      appt.notes ? `Notes: ${appt.notes}` : ''
    ].filter(Boolean).join('\\n')

    const uid = `moonlit-appt-${appt.id}@trymoonlit.com`

    return [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART:${startTime}`,
      `DTEND:${endTime}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      `STATUS:${appt.status === 'confirmed' ? 'CONFIRMED' : 'TENTATIVE'}`,
      'TRANSP:OPAQUE',
      'END:VEVENT'
    ].join('\r\n')
  }).join('\r\n')

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Moonlit Scheduler//Partner Dashboard//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:Moonlit Appointments - ${userName}`,
    'X-WR-TIMEZONE:America/Denver',
    'X-WR-CALDESC:Patient appointments from Moonlit Scheduler',
    events,
    'END:VCALENDAR'
  ].join('\r\n')
}

/**
 * Formats date for iCalendar (YYYYMMDDTHHMMSSZ)
 */
function formatICalDate(dateString: string): string {
  return new Date(dateString).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}
