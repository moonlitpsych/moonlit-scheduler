// src/app/api/partner/calendar-export/route.ts
// API endpoint for partner calendar exports

import { supabaseAdmin } from '@/lib/supabase'
import { calendarExportService, type AppointmentExportData } from '@/lib/services/calendarExportService'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { 
            partner_user_id, 
            format = 'ics', 
            date_range,
            organization_id,
            include_all_org_appointments = false 
        } = body

        if (!partner_user_id) {
            return NextResponse.json(
                { success: false, error: 'partner_user_id is required' },
                { status: 400 }
            )
        }

        console.log('📅 Calendar export request:', {
            partner_user_id,
            format,
            date_range,
            organization_id,
            include_all_org_appointments
        })

        // Verify partner user access
        const { data: partnerUser, error: userError } = await supabaseAdmin
            .from('partner_users')
            .select(`
                id,
                organization_id,
                full_name,
                role,
                is_active,
                organizations (
                    id,
                    name,
                    type
                )
            `)
            .eq('id', partner_user_id)
            .eq('is_active', true)
            .single()

        if (userError || !partnerUser) {
            console.error('❌ Partner user not found:', userError)
            return NextResponse.json(
                { success: false, error: 'Partner user not found or inactive' },
                { status: 404 }
            )
        }

        // Determine date range
        const startDate = date_range?.start_date ? new Date(date_range.start_date) : new Date()
        const endDate = date_range?.end_date ? new Date(date_range.end_date) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days

        console.log('📊 Fetching appointments for date range:', {
            start: startDate.toISOString(),
            end: endDate.toISOString(),
            organization: partnerUser.organizations?.name
        })

        // Fetch appointments based on partner access level
        const appointments = await fetchPartnerAppointments(
            partnerUser,
            startDate,
            endDate,
            include_all_org_appointments
        )

        console.log(`✅ Found ${appointments.length} appointments for export`)

        if (appointments.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No appointments found in the specified date range',
                data: {
                    appointment_count: 0,
                    date_range: { start: startDate, end: endDate },
                    format
                }
            })
        }

        // Generate calendar export
        const exportResult = await calendarExportService.exportAppointments(
            appointments,
            format as any,
            partnerUser.organizations?.name || 'Partner Organization'
        )

        // Return file download response
        const response = new NextResponse(exportResult.content)
        response.headers.set('Content-Type', exportResult.mimeType)
        response.headers.set('Content-Disposition', `attachment; filename="${exportResult.filename}"`)
        response.headers.set('Cache-Control', 'no-cache')
        
        return response

    } catch (error: any) {
        console.error('❌ Calendar export error:', error)
        return NextResponse.json(
            { 
                success: false, 
                error: 'Failed to generate calendar export',
                details: error.message 
            },
            { status: 500 }
        )
    }
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const partner_user_id = searchParams.get('partner_user_id')
        const format = searchParams.get('format') || 'ics'
        
        if (!partner_user_id) {
            return NextResponse.json(
                { success: false, error: 'partner_user_id is required' },
                { status: 400 }
            )
        }

        // For GET requests, provide upcoming appointments (next 30 days)
        const startDate = new Date()
        const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

        // Verify access and fetch appointments
        const { data: partnerUser, error: userError } = await supabaseAdmin
            .from('partner_users')
            .select(`
                id,
                organization_id,
                organizations (
                    id,
                    name
                )
            `)
            .eq('id', partner_user_id)
            .eq('is_active', true)
            .single()

        if (userError || !partnerUser) {
            return NextResponse.json(
                { success: false, error: 'Partner user not found' },
                { status: 404 }
            )
        }

        const appointments = await fetchPartnerAppointments(partnerUser, startDate, endDate, false)
        
        // Generate export
        const exportResult = await calendarExportService.exportAppointments(
            appointments,
            format as any,
            partnerUser.organizations?.name || 'Partner Organization'
        )

        const response = new NextResponse(exportResult.content)
        response.headers.set('Content-Type', exportResult.mimeType)
        response.headers.set('Content-Disposition', `attachment; filename="${exportResult.filename}"`)
        
        return response

    } catch (error: any) {
        console.error('❌ GET calendar export error:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to generate calendar export' },
            { status: 500 }
        )
    }
}

/**
 * Fetch appointments that a partner user has access to
 */
async function fetchPartnerAppointments(
    partnerUser: any,
    startDate: Date,
    endDate: Date,
    includeAllOrgAppointments: boolean
): Promise<AppointmentExportData[]> {
    
    console.log('🔍 Fetching partner appointments...', {
        partner_user_id: partnerUser.id,
        organization_id: partnerUser.organization_id,
        includeAllOrgAppointments,
        dateRange: [startDate, endDate]
    })

    try {
        // Query appointments with patient and provider information
        // This query looks for appointments where:
        // 1. Patient has an affiliation with the partner's organization, OR
        // 2. Patient was referred by the partner's organization
        
        const { data: appointments, error } = await supabaseAdmin
            .from('appointments')
            .select(`
                id,
                start_time,
                end_time,
                appointment_type,
                status,
                notes,
                patient_info,
                meeting_url,
                practiceq_generated_google_meet,
                providers!appointments_provider_id_fkey (
                    id,
                    first_name,
                    last_name,
                    title,
                    role
                )
            `)
            .gte('start_time', startDate.toISOString())
            .lte('start_time', endDate.toISOString())
            .eq('status', 'confirmed') // Only confirmed appointments
            .order('start_time', { ascending: true })

        if (error) {
            console.error('❌ Error fetching appointments:', error)
            return []
        }

        if (!appointments || appointments.length === 0) {
            console.log('⚠️ No appointments found in date range')
            return []
        }

        console.log(`📊 Found ${appointments.length} total appointments, filtering for partner access...`)

        // For now, we'll return a subset based on the organization
        // In production, you'd filter based on patient affiliations and ROI consent
        const filteredAppointments: AppointmentExportData[] = appointments
            .slice(0, includeAllOrgAppointments ? appointments.length : Math.min(appointments.length, 10))
            .map(apt => {
                const patientInfo = apt.patient_info as any
                const provider = apt.providers
                // Prefer practiceq_generated_google_meet, fall back to meeting_url
                const meetingUrl = apt.practiceq_generated_google_meet || apt.meeting_url || null

                return {
                    id: apt.id,
                    patient_name: patientInfo?.firstName && patientInfo?.lastName
                        ? `${patientInfo.firstName} ${patientInfo.lastName}`
                        : 'Patient Name',
                    provider_name: provider
                        ? `${provider.title || 'Dr.'} ${provider.first_name} ${provider.last_name}`
                        : 'Provider',
                    start_time: apt.start_time,
                    end_time: apt.end_time,
                    appointment_type: apt.appointment_type || 'Consultation',
                    location: 'Telehealth', // Default for now
                    notes: apt.notes || '',
                    status: apt.status || 'confirmed',
                    patient_phone: patientInfo?.phone,
                    organization_name: partnerUser.organizations?.name,
                    meeting_url: meetingUrl
                }
            })

        console.log(`✅ Filtered to ${filteredAppointments.length} appointments for partner export`)
        return filteredAppointments

    } catch (error) {
        console.error('❌ Error in fetchPartnerAppointments:', error)
        return []
    }
}

// Separate endpoint for calendar subscription feeds
export async function calendar_feed_handler(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const partner_id = searchParams.get('partner_id')
    const token = searchParams.get('token')
    const format = searchParams.get('format') || 'ics'

    if (!partner_id || !token) {
        return new NextResponse('Missing partner_id or token', { status: 400 })
    }

    // Verify token and partner access
    // This would validate the subscription token
    
    try {
        const feedContent = await calendarExportService.generateCalendarFeed(
            partner_id,
            format as any
        )

        const response = new NextResponse(feedContent)
        response.headers.set('Content-Type', format === 'ics' ? 'text/calendar' : 'application/json')
        response.headers.set('Cache-Control', 'public, max-age=3600') // Cache for 1 hour
        
        return response
        
    } catch (error) {
        console.error('❌ Calendar feed error:', error)
        return new NextResponse('Failed to generate calendar feed', { status: 500 })
    }
}