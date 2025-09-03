// Partner Calendar ICS Feed - Initials-only calendar with token authentication
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import crypto from 'crypto'

export async function GET(
  request: NextRequest,
  { params }: { params: { partner_user_id: string } }
) {
  try {
    const { partner_user_id } = params
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    
    if (!partner_user_id || !token) {
      return new NextResponse('Partner user ID and token are required', { status: 400 })
    }

    console.log('📅 Generating partner calendar feed:', { partner_user_id, token: token.substring(0, 8) + '...' })

    // Verify partner user exists and get their organization
    const { data: partnerUser, error: userError } = await supabaseAdmin
      .from('partner_users')
      .select(`
        id,
        organization_id,
        first_name,
        last_name,
        email,
        status,
        timezone,
        calendar_token
      `)
      .eq('id', partner_user_id)
      .eq('status', 'active')
      .single()

    if (userError || !partnerUser) {
      return new NextResponse('Partner user not found', { status: 404 })
    }

    // Verify calendar token (generate one if it doesn't exist)
    let validToken = partnerUser.calendar_token
    if (!validToken) {
      // Generate new calendar token
      validToken = generateCalendarToken(partnerUser.id, partnerUser.email)
      
      await supabaseAdmin
        .from('partner_users')
        .update({ calendar_token: validToken })
        .eq('id', partner_user_id)
    }

    // Validate provided token
    const expectedToken = generateCalendarToken(partnerUser.id, partnerUser.email)
    if (token !== validToken && token !== expectedToken) {
      return new NextResponse('Invalid calendar token', { status: 403 })
    }

    // Get date range for calendar (3 months back, 6 months forward)
    const now = new Date()
    const startDate = new Date(now)
    startDate.setMonth(startDate.getMonth() - 3)
    const endDate = new Date(now)
    endDate.setMonth(endDate.getMonth() + 6)

    // Fetch appointments for patients affiliated with this partner's organization
    const { data: appointments, error: appointmentsError } = await supabaseAdmin
      .from('appointments')
      .select(`
        id,
        provider_id,
        start_time,
        end_time,
        timezone,
        status,
        appointment_type,
        patient_info,
        providers(
          id,
          first_name,
          last_name,
          title
        ),
        patients!inner(
          id,
          first_name,
          last_name,
          patient_affiliations!inner(
            organization_id,
            status
          )
        )
      `)
      .eq('patients.patient_affiliations.organization_id', partnerUser.organization_id)
      .eq('patients.patient_affiliations.status', 'active')
      .gte('start_time', startDate.toISOString())
      .lte('start_time', endDate.toISOString())
      .in('status', ['scheduled', 'confirmed', 'checked_in', 'completed'])
      .order('start_time')

    if (appointmentsError) {
      console.error('❌ Error fetching appointments for calendar:', appointmentsError)
      return new NextResponse('Failed to fetch appointments', { status: 500 })
    }

    // Generate ICS content
    const timezone = partnerUser.timezone || 'America/Denver'
    const icsContent = generateICSContent({
      appointments: appointments || [],
      partnerUser,
      timezone,
      generatedAt: now
    })

    // Log calendar access for audit
    await supabaseAdmin
      .from('scheduler_audit_logs')
      .insert({
        action: 'partner_calendar_accessed',
        resource_type: 'calendar_feed',
        resource_id: partner_user_id,
        details: {
          partner_user: {
            id: partner_user_id,
            name: `${partnerUser.first_name} ${partnerUser.last_name}`,
            email: partnerUser.email,
            organization_id: partnerUser.organization_id
          },
          date_range: {
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString()
          },
          appointments_included: (appointments || []).length,
          user_agent: request.headers.get('user-agent'),
          ip_address: request.headers.get('x-forwarded-for') || 'unknown'
        }
      })

    console.log('✅ Partner calendar generated:', {
      partner_user_id,
      appointments_count: (appointments || []).length,
      date_range: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`
    })

    // Return ICS file
    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="moonlit-partner-${partner_user_id.substring(0, 8)}.ics"`,
        'Cache-Control': 'private, max-age=300', // Cache for 5 minutes
        'X-Calendar-Name': `Moonlit Partner Calendar - ${partnerUser.first_name} ${partnerUser.last_name}`,
        'X-WR-CALNAME': `Moonlit Partner Calendar - ${partnerUser.first_name} ${partnerUser.last_name}`,
        'X-WR-CALDESC': `Appointment calendar for ${partnerUser.organization_id} patients (initials only)`
      }
    })

  } catch (error: any) {
    console.error('❌ Partner calendar generation error:', error)
    
    return new NextResponse('Failed to generate calendar', { status: 500 })
  }
}

// Helper function to generate calendar token
function generateCalendarToken(userId: string, email: string): string {
  const secret = process.env.CALENDAR_TOKEN_SECRET || 'moonlit-calendar-secret-2025'
  const data = `${userId}:${email}:${secret}`
  return crypto.createHash('sha256').update(data).digest('hex')
}

// Helper function to generate ICS content
function generateICSContent(params: {
  appointments: any[]
  partnerUser: any
  timezone: string
  generatedAt: Date
}) {
  const { appointments, partnerUser, timezone, generatedAt } = params
  
  // ICS header
  let ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Moonlit Psychiatry//Partner Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:Moonlit Partner Calendar - ${partnerUser.first_name} ${partnerUser.last_name}`,
    `X-WR-CALDESC:Appointment calendar for ${partnerUser.organization_id} patients (initials only)`,
    `X-WR-TIMEZONE:${timezone}`,
    'BEGIN:VTIMEZONE',
    `TZID:${timezone}`,
    'END:VTIMEZONE'
  ]

  // Add events for each appointment
  for (const appointment of appointments) {
    const startTime = new Date(appointment.start_time)
    const endTime = new Date(appointment.end_time)
    
    // Get patient initials only (privacy protection)
    const patientInitials = getPatientInitials(appointment.patients?.first_name, appointment.patients?.last_name)
    const providerName = `Dr. ${appointment.providers?.first_name || ''} ${appointment.providers?.last_name || ''}`.trim()
    
    // Create summary with initials only
    const summary = `${patientInitials} - ${providerName}`
    const description = [
      `Patient: ${patientInitials} (initials only)`,
      `Provider: ${providerName}`,
      `Status: ${appointment.status}`,
      `Type: ${appointment.appointment_type || 'Standard Appointment'}`,
      '',
      'This is a privacy-protected view showing only patient initials.',
      `Full details available at: https://moonlit.partner-dashboard.com/appointments/${appointment.id}`
    ].join('\\n')

    // Generate unique UID
    const uid = `apt-${appointment.id}@moonlit-partner-calendar.com`
    
    // Format dates for ICS (UTC format)
    const formatICSDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
    }

    ics.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${formatICSDate(generatedAt)}`,
      `DTSTART:${formatICSDate(startTime)}`,
      `DTEND:${formatICSDate(endTime)}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      `STATUS:${appointment.status.toUpperCase()}`,
      'TRANSP:OPAQUE',
      'CLASS:CONFIDENTIAL',
      `CATEGORIES:Healthcare,${appointment.status}`,
      'END:VEVENT'
    )
  }

  // ICS footer
  ics.push('END:VCALENDAR')

  return ics.join('\r\n')
}

// Helper function to get patient initials (privacy protection)
function getPatientInitials(firstName?: string, lastName?: string): string {
  if (!firstName && !lastName) return '??'
  
  const first = firstName?.charAt(0)?.toUpperCase() || '?'
  const last = lastName?.charAt(0)?.toUpperCase() || '?'
  
  return `${first}${last}`
}

// POST - Regenerate calendar token
export async function POST(
  request: NextRequest,
  { params }: { params: { partner_user_id: string } }
) {
  try {
    const { partner_user_id } = params
    
    // Get partner user ID from headers (for authentication)
    const requestingUserId = request.headers.get('x-partner-user-id')
    
    if (!requestingUserId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Partner user authentication required' 
        },
        { status: 401 }
      )
    }

    // Verify requesting user has permission (must be the same user or admin)
    const { data: requestingUser } = await supabaseAdmin
      .from('partner_users')
      .select('id, role, organization_id')
      .eq('id', requestingUserId)
      .eq('status', 'active')
      .single()

    if (!requestingUser) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Requesting user not found' 
        },
        { status: 404 }
      )
    }

    // Check if user can regenerate this calendar token
    const canRegenerate = requestingUserId === partner_user_id || requestingUser.role === 'partner_admin'
    
    if (!canRegenerate) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Insufficient permissions to regenerate calendar token' 
        },
        { status: 403 }
      )
    }

    // Get target partner user
    const { data: targetUser, error: targetUserError } = await supabaseAdmin
      .from('partner_users')
      .select('id, first_name, last_name, email, organization_id')
      .eq('id', partner_user_id)
      .eq('status', 'active')
      .single()

    if (targetUserError || !targetUser) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Target partner user not found' 
        },
        { status: 404 }
      )
    }

    // If requesting user is admin, ensure same organization
    if (requestingUser.role === 'partner_admin' && requestingUser.organization_id !== targetUser.organization_id) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Can only regenerate tokens for users in same organization' 
        },
        { status: 403 }
      )
    }

    // Generate new calendar token
    const newToken = generateCalendarToken(targetUser.id, targetUser.email)
    
    // Update user with new token
    const { error: updateError } = await supabaseAdmin
      .from('partner_users')
      .update({ 
        calendar_token: newToken,
        updated_at: new Date().toISOString()
      })
      .eq('id', partner_user_id)

    if (updateError) {
      console.error('❌ Failed to update calendar token:', updateError)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to regenerate calendar token',
          details: updateError.message
        },
        { status: 500 }
      )
    }

    // Create new calendar URL
    const baseUrl = request.url.split('/api/')[0]
    const calendarUrl = `${baseUrl}/api/partner/calendar/${partner_user_id}?token=${newToken}`

    // Log token regeneration for audit
    await supabaseAdmin
      .from('scheduler_audit_logs')
      .insert({
        action: 'partner_calendar_token_regenerated',
        resource_type: 'calendar_token',
        resource_id: partner_user_id,
        details: {
          regenerated_by: {
            partner_user_id: requestingUserId,
            for_user_id: partner_user_id,
            is_self_regeneration: requestingUserId === partner_user_id
          },
          target_user: {
            id: targetUser.id,
            name: `${targetUser.first_name} ${targetUser.last_name}`,
            email: targetUser.email,
            organization_id: targetUser.organization_id
          }
        }
      })

    console.log('✅ Calendar token regenerated:', {
      partner_user_id,
      regenerated_by: requestingUserId,
      is_self: requestingUserId === partner_user_id
    })

    return NextResponse.json({
      success: true,
      data: {
        calendar_url: calendarUrl,
        token: newToken,
        instructions: [
          'Copy the calendar URL and add it to your calendar application',
          'The calendar shows patient initials only for privacy protection',
          'Keep this URL private - anyone with the URL can view appointment times',
          'Regenerate the token if you suspect it has been compromised'
        ]
      },
      message: 'Calendar token regenerated successfully'
    })

  } catch (error: any) {
    console.error('❌ Calendar token regeneration error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to regenerate calendar token',
        details: error.message
      },
      { status: 500 }
    )
  }
}