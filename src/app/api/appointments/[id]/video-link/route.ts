// Appointment Video Link API - Resolve from EHR with optional caching
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { intakeQService } from '@/lib/services/intakeQService'
import { athenaService } from '@/lib/services/athenaService'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: appointmentId } = params
    
    // Get partner user ID from headers
    const partnerUserId = request.headers.get('x-partner-user-id')
    
    if (!partnerUserId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Partner user authentication required' 
        },
        { status: 401 }
      )
    }

    console.log('📹 Fetching video link for appointment:', { appointmentId, partnerUserId })

    // Get partner user's organization
    const { data: partnerUser, error: userError } = await supabaseAdmin
      .from('partner_users')
      .select('organization_id, first_name, last_name, email')
      .eq('id', partnerUserId)
      .eq('status', 'active')
      .single()

    if (userError || !partnerUser?.organization_id) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Partner user or organization not found' 
        },
        { status: 404 }
      )
    }

    // Get appointment details and verify organization access
    const { data: appointment, error: appointmentError } = await supabaseAdmin
      .from('appointments')
      .select(`
        *,
        providers(id, first_name, last_name, intakeq_practitioner_id, athena_provider_id),
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
      .eq('id', appointmentId)
      .single()

    if (appointmentError || !appointment) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Appointment not found' 
        },
        { status: 404 }
      )
    }

    // Verify organization access
    const hasAccess = appointment.patients.patient_affiliations.some(
      (affiliation: any) => 
        affiliation.organization_id === partnerUser.organization_id && 
        affiliation.status === 'active'
    )

    if (!hasAccess) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Access denied: Patient not affiliated with your organization' 
        },
        { status: 403 }
      )
    }

    // Check if appointment is within valid time range for video access
    const now = new Date()
    const appointmentStart = new Date(appointment.start_time)
    const appointmentEnd = new Date(appointment.end_time)
    const bufferMinutes = 15 // Allow access 15 minutes before and after

    const validStart = new Date(appointmentStart.getTime() - bufferMinutes * 60 * 1000)
    const validEnd = new Date(appointmentEnd.getTime() + bufferMinutes * 60 * 1000)

    const isWithinValidTime = now >= validStart && now <= validEnd
    const minutesUntilStart = Math.round((appointmentStart.getTime() - now.getTime()) / (1000 * 60))
    const minutesAfterEnd = Math.round((now.getTime() - appointmentEnd.getTime()) / (1000 * 60))

    // Check cache first using new appointment_external_links table
    let cachedVideoLink = null
    try {
      const { data: cachedLink } = await supabaseAdmin
        .from('appointment_external_links')
        .select('*')
        .eq('appointment_id', appointmentId)
        .eq('link_type', 'video')
        .eq('status', 'active')
        .or(`expires_at.is.null,expires_at.gte.${now.toISOString()}`)
        .order('cached_at', { ascending: false })
        .limit(1)
        .single()

      if (cachedLink) {
        cachedVideoLink = cachedLink
        console.log('✅ Using cached video link from appointment_external_links')
        
        // Update access tracking
        await supabaseAdmin.rpc('track_link_access', { link_id: cachedLink.id })
      }
    } catch (cacheError) {
      // Cache miss or error - continue to fetch from EHR
    }

    let videoLinkData: any = null

    if (cachedVideoLink) {
      // Use cached data
      videoLinkData = {
        patient_join_url: cachedVideoLink.patient_url,
        provider_join_url: cachedVideoLink.provider_url,
        waiting_room_url: cachedVideoLink.waiting_room_url,
        session_id: cachedVideoLink.session_id,
        expires_at: cachedVideoLink.expires_at,
        source: 'cache',
        cached_at: cachedVideoLink.cached_at,
        access_count: cachedVideoLink.access_count
      }
    } else {
      // Fetch from EHR using real services
      try {
        let ehrVideoLink: any = null
        let ehrSystem = 'none'

        if (appointment.emr_appointment_id && appointment.providers?.intakeq_practitioner_id) {
          // IntakeQ appointment
          ehrSystem = 'intakeq'
          console.log('📹 Fetching video link from IntakeQ:', appointment.emr_appointment_id)
          
          ehrVideoLink = await intakeQService.getVideoLink(appointment.emr_appointment_id)
        } else if (appointment.emr_appointment_id && appointment.providers?.athena_provider_id) {
          // Athena appointment  
          ehrSystem = 'athena'
          console.log('📹 Fetching video link from Athena:', appointment.emr_appointment_id)
          
          ehrVideoLink = await athenaService.getVideoLink(appointment.emr_appointment_id)
        } else {
          throw new Error('No EHR integration available for appointment')
        }

        if (ehrVideoLink && (ehrVideoLink.patientUrl || ehrVideoLink.patient_join_url)) {
          // Normalize the response format
          videoLinkData = {
            patient_join_url: ehrVideoLink.patientUrl || ehrVideoLink.patient_join_url,
            provider_join_url: ehrVideoLink.providerUrl || ehrVideoLink.provider_join_url,  
            waiting_room_url: ehrVideoLink.waitingRoomUrl || ehrVideoLink.waiting_room_url,
            session_id: ehrVideoLink.sessionId || ehrVideoLink.session_id,
            expires_at: ehrVideoLink.expiresAt || ehrVideoLink.expires_at,
            source: 'ehr',
            ehr_system: ehrSystem
          }

          // Cache the video link for future use using appointment_external_links table
          const expiresAt = videoLinkData.expires_at ? 
            new Date(videoLinkData.expires_at) : 
            new Date(appointmentEnd.getTime() + 4 * 60 * 60 * 1000) // 4 hours after appointment
            
          const cacheData = {
            appointment_id: appointmentId,
            ehr_system: ehrSystem,
            ehr_appointment_id: appointment.emr_appointment_id,
            link_type: 'video',
            url: videoLinkData.patient_join_url,
            patient_url: videoLinkData.patient_join_url,
            provider_url: videoLinkData.provider_join_url,
            waiting_room_url: videoLinkData.waiting_room_url,
            session_id: videoLinkData.session_id,
            expires_at: expiresAt.toISOString(),
            status: 'active',
            created_by: partnerUserId
          }
          
          await supabaseAdmin
            .from('appointment_external_links')
            .upsert(cacheData, { 
              onConflict: 'appointment_id,link_type,ehr_system'
            })

          console.log(`✅ Video link fetched from ${ehrSystem} and cached`)
        } else {
          throw new Error(`Failed to fetch video link from ${ehrSystem}`)
        }
      } catch (ehrError: any) {
        console.warn('⚠️ EHR video link fetch failed:', ehrError)
        
        // Generate fallback video link
        videoLinkData = await generateFallbackVideoLink(appointmentId)
        videoLinkData.source = 'fallback'
        videoLinkData.error = ehrError.message
      }
    }

    // Log access for audit
    await supabaseAdmin
      .from('scheduler_audit_logs')
      .insert({
        action: 'appointment_video_link_accessed',
        resource_type: 'appointment',
        resource_id: appointmentId,
        details: {
          accessed_by: {
            partner_user_id: partnerUserId,
            name: `${partnerUser.first_name} ${partnerUser.last_name}`,
            email: partnerUser.email,
            organization_id: partnerUser.organization_id
          },
          appointment_time: appointment.start_time,
          patient_id: appointment.patients.id,
          provider_id: appointment.provider_id,
          video_link_source: videoLinkData?.source,
          within_valid_time: isWithinValidTime,
          minutes_until_start: minutesUntilStart,
          minutes_after_end: minutesAfterEnd
        }
      })

    console.log('✅ Video link retrieved:', {
      appointmentId,
      source: videoLinkData?.source,
      within_valid_time: isWithinValidTime
    })

    return NextResponse.json({
      success: true,
      data: {
        video_links: videoLinkData,
        appointment: {
          id: appointment.id,
          start_time: appointment.start_time,
          end_time: appointment.end_time,
          status: appointment.status,
          patient_name: `${appointment.patients.first_name} ${appointment.patients.last_name}`,
          provider_name: `Dr. ${appointment.providers?.first_name} ${appointment.providers?.last_name}`
        },
        access_info: {
          is_within_valid_time: isWithinValidTime,
          minutes_until_start: minutesUntilStart,
          minutes_after_end: minutesAfterEnd,
          access_window: `${bufferMinutes} minutes before to ${bufferMinutes} minutes after appointment`
        }
      }
    })

  } catch (error: any) {
    console.error('❌ Video link fetch error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch video link',
        details: error.message
      },
      { status: 500 }
    )
  }
}


// Helper function to generate fallback video link
async function generateFallbackVideoLink(appointmentId: string) {
  // Generate fallback video links (e.g., using a backup video service)
  return {
    patient_join_url: `https://meet.moonlitpsychiatry.com/appointment/${appointmentId}/patient`,
    provider_join_url: `https://meet.moonlitpsychiatry.com/appointment/${appointmentId}/provider`,
    waiting_room_url: `https://meet.moonlitpsychiatry.com/waiting-room/${appointmentId}`,
    session_id: `fallback_${appointmentId}_${Date.now()}`,
    expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4 hours from now
    is_fallback: true
  }
}