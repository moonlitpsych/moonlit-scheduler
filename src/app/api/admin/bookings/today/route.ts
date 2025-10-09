/**
 * Admin Tool: Today's Bookings Query
 *
 * Search and retrieve appointments created today with filtering:
 * - By patient email (joins patients table)
 * - By pq_appointment_id (IntakeQ cross-reference)
 * - By appointment ID
 * - All today's bookings (default)
 *
 * Mountain Time (America/Denver) is used for "today" calculation.
 *
 * READ-ONLY endpoint - no data modifications
 *
 * Usage:
 *   GET /api/admin/bookings/today
 *   GET /api/admin/bookings/today?email=patient@example.com
 *   GET /api/admin/bookings/today?pq_appointment_id=68e7f98a867a401b3b557e7c
 *   GET /api/admin/bookings/today?appointment_id=665f7b82-2bdb-4497-a6b6-8d0221980296
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const email = searchParams.get('email')
    const pqAppointmentId = searchParams.get('pq_appointment_id')
    const appointmentId = searchParams.get('appointment_id')

    console.log('🔍 Admin query: Today\'s bookings', { email, pqAppointmentId, appointmentId })

    // Calculate "today" in Mountain Time
    const now = new Date()
    const mtOffset = -6 // Mountain Time (MDT) UTC-6
    const mtNow = new Date(now.getTime() + (mtOffset * 60 * 60 * 1000))
    const todayMT = mtNow.toISOString().split('T')[0] // YYYY-MM-DD

    console.log('📅 Mountain Time today:', todayMT)

    // Build query - always join patients for email search capability
    let query = supabaseAdmin
      .from('appointments')
      .select(`
        id,
        patient_id,
        provider_id,
        payer_id,
        start_time,
        end_time,
        status,
        pq_appointment_id,
        created_at,
        notes,
        patients:patient_id (
          id,
          first_name,
          last_name,
          email,
          phone
        ),
        providers:provider_id (
          id,
          first_name,
          last_name,
          title
        ),
        payers:payer_id (
          id,
          name
        )
      `)

    // Apply filters based on query params
    if (appointmentId) {
      // Specific appointment ID lookup
      query = query.eq('id', appointmentId)
    } else if (pqAppointmentId) {
      // IntakeQ appointment ID lookup
      query = query.eq('pq_appointment_id', pqAppointmentId)
    } else if (email) {
      // Email search requires filtering after fetch (can't filter on joined table directly)
      // We'll filter created_at first to reduce data, then filter by email in memory
      query = query.gte('created_at', `${todayMT}T00:00:00Z`)
    } else {
      // Default: all appointments created today
      query = query.gte('created_at', `${todayMT}T00:00:00Z`)
    }

    query = query.order('created_at', { ascending: false })

    const { data: appointments, error } = await query

    if (error) {
      console.error('❌ Error fetching appointments:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch appointments', details: error },
        { status: 500 }
      )
    }

    // Filter by email if provided (post-fetch filtering)
    let filteredAppointments = appointments || []
    if (email && filteredAppointments.length > 0) {
      filteredAppointments = filteredAppointments.filter(apt => {
        const patient = apt.patients as any
        return patient?.email?.toLowerCase().includes(email.toLowerCase())
      })
    }

    // Format response
    const formattedAppointments = filteredAppointments.map(apt => {
      const patient = apt.patients as any
      const provider = apt.providers as any
      const payer = apt.payers as any

      return {
        appointmentId: apt.id,
        pqAppointmentId: apt.pq_appointment_id,
        status: apt.status,
        createdAt: apt.created_at,
        startTime: apt.start_time,
        endTime: apt.end_time,
        patient: patient ? {
          id: patient.id,
          name: `${patient.first_name} ${patient.last_name}`,
          email: patient.email,
          phone: patient.phone
        } : null,
        provider: provider ? {
          id: provider.id,
          name: `${provider.first_name} ${provider.last_name}`,
          title: provider.title
        } : null,
        payer: payer ? {
          id: payer.id,
          name: payer.name
        } : null,
        notes: apt.notes,
        // Enrichment status
        enrichmentStatus: apt.pq_appointment_id
          ? 'synced'
          : apt.notes?.includes('IntakeQ sync skipped')
          ? 'skipped'
          : 'pending'
      }
    })

    const summary = {
      totalResults: formattedAppointments.length,
      todayDate: todayMT,
      timezone: 'America/Denver (Mountain Time)',
      filters: {
        email: email || null,
        pqAppointmentId: pqAppointmentId || null,
        appointmentId: appointmentId || null
      },
      enrichmentBreakdown: {
        synced: formattedAppointments.filter(a => a.enrichmentStatus === 'synced').length,
        skipped: formattedAppointments.filter(a => a.enrichmentStatus === 'skipped').length,
        pending: formattedAppointments.filter(a => a.enrichmentStatus === 'pending').length
      }
    }

    console.log('📊 Bookings query results:', summary)

    return NextResponse.json({
      success: true,
      summary,
      appointments: formattedAppointments
    })

  } catch (error: any) {
    console.error('❌ Admin bookings query failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Bookings query failed',
        details: error.message
      },
      { status: 500 }
    )
  }
}
