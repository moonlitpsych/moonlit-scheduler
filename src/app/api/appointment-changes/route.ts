// Appointment Change Requests API - For partner users to request changes
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { athenaService } from '@/lib/services/athenaService'
import { emailService } from '@/lib/services/emailService'

// Helper function to get partner user from auth (same as dashboard)
async function getPartnerUserFromAuth(request: NextRequest) {
  const partnerUserId = request.headers.get('x-partner-user-id')
  
  if (!partnerUserId) {
    throw new Error('Partner user authentication required')
  }

  const { data: partnerUser, error } = await supabaseAdmin
    .from('partner_users')
    .select(`
      *,
      organization:organizations(*)
    `)
    .eq('id', partnerUserId)
    .eq('status', 'active')
    .single()

  if (error || !partnerUser) {
    throw new Error('Partner user not found or inactive')
  }

  return partnerUser
}

interface CreateChangeRequestBody {
  appointment_id: string
  change_type: 'reschedule' | 'cancel' | 'modify_details'
  reason: string
  urgency?: 'low' | 'medium' | 'high' | 'urgent'
  
  // For reschedules
  requested_start_time?: string
  requested_provider_id?: string
  
  // Additional context
  patient_preference?: string
}

// POST - Create appointment change request
export async function POST(request: NextRequest) {
  try {
    const partnerUser = await getPartnerUserFromAuth(request)
    const body: CreateChangeRequestBody = await request.json()
    
    const {
      appointment_id,
      change_type,
      reason,
      urgency = 'medium',
      requested_start_time,
      requested_provider_id,
      patient_preference
    } = body

    if (!appointment_id || !change_type || !reason) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Appointment ID, change type, and reason are required' 
        },
        { status: 400 }
      )
    }

    // Validate change_type
    if (!['reschedule', 'cancel', 'modify_details'].includes(change_type)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid change type' 
        },
        { status: 400 }
      )
    }

    console.log('📅 Creating appointment change request:', {
      appointment_id,
      change_type,
      partner_user_id: partnerUser.id,
      organization: partnerUser.organization?.name
    })

    // 1. Get appointment details and verify access
    const { data: appointment, error: appointmentError } = await supabaseAdmin
      .from('appointments')
      .select(`
        *,
        providers(id, first_name, last_name, email),
        payers(id, name),
        patients!inner(
          *,
          patient_organization_affiliations!inner(
            id,
            organization_id,
            status,
            roi_consent_status
          )
        )
      `)
      .eq('id', appointment_id)
      .eq('patients.patient_organization_affiliations.organization_id', partnerUser.organization_id)
      .eq('patients.patient_organization_affiliations.status', 'active')
      .single()

    if (appointmentError || !appointment) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Appointment not found or access denied' 
        },
        { status: 404 }
      )
    }

    // 2. Check ROI consent
    const affiliation = appointment.patients.patient_organization_affiliations[0]
    if (affiliation.roi_consent_status !== 'granted') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'ROI consent required to modify appointments for this patient' 
        },
        { status: 403 }
      )
    }

    // 3. Validate reschedule request
    if (change_type === 'reschedule' && !requested_start_time) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Requested start time is required for reschedules' 
        },
        { status: 400 }
      )
    }

    // 4. Check for existing pending requests for this appointment
    const { data: existingRequest } = await supabaseAdmin
      .from('appointment_change_requests')
      .select('id, status')
      .eq('appointment_id', appointment_id)
      .eq('status', 'pending')
      .single()

    if (existingRequest) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'A change request for this appointment is already pending' 
        },
        { status: 409 }
      )
    }

    // 5. Create change request
    const changeRequestData = {
      appointment_id,
      requested_by_user_id: partnerUser.id,
      change_type,
      reason: reason.trim(),
      urgency,
      patient_preference: patient_preference || null,
      status: 'pending',
      
      // Store original appointment details
      original_start_time: appointment.start_time,
      original_provider_id: appointment.provider_id,
      
      // Store requested changes
      requested_start_time: requested_start_time || null,
      requested_provider_id: requested_provider_id || appointment.provider_id,
    }

    const { data: changeRequest, error: createError } = await supabaseAdmin
      .from('appointment_change_requests')
      .insert(changeRequestData)
      .select(`
        *,
        appointments(
          *,
          providers(first_name, last_name),
          patients(first_name, last_name)
        ),
        requested_by_user:partner_users(
          first_name,
          last_name,
          email,
          organization:organizations(name)
        )
      `)
      .single()

    if (createError) {
      console.error('❌ Failed to create change request:', createError)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to create change request',
          details: createError.message
        },
        { status: 500 }
      )
    }

    // 6. Log for audit
    await supabaseAdmin
      .from('scheduler_audit_logs')
      .insert({
        user_identifier: partnerUser.id,
        action: 'appointment_change_requested',
        resource_type: 'appointment',
        resource_id: appointment_id,
        appointment_id: appointment_id,
        details: {
          change_type,
          urgency,
          organization_id: partnerUser.organization_id,
          organization_name: partnerUser.organization?.name,
          patient_name: `${appointment.patients.first_name} ${appointment.patients.last_name}`,
          provider_name: `${appointment.providers.first_name} ${appointment.providers.last_name}`,
          original_time: appointment.start_time,
          requested_time: requested_start_time
        }
      })

    // 7. Send notification emails
    try {
      await sendChangeRequestNotification(changeRequest, partnerUser)
    } catch (emailError: any) {
      console.error('⚠️ Failed to send notification email:', emailError.message)
      // Don't fail the request for email issues
    }

    // 8. For urgent requests, attempt immediate processing
    if (urgency === 'urgent' && change_type === 'cancel') {
      try {
        await processChangeRequest(changeRequest.id, 'auto-approved', 'Urgent cancellation auto-processed')
      } catch (autoProcessError: any) {
        console.error('⚠️ Auto-processing failed:', autoProcessError.message)
        // Don't fail the request, it will be processed manually
      }
    }

    console.log('✅ Appointment change request created:', {
      id: changeRequest.id,
      appointment_id,
      change_type,
      urgency,
      status: changeRequest.status
    })

    return NextResponse.json({
      success: true,
      data: changeRequest,
      message: 'Change request submitted successfully'
    })

  } catch (error: any) {
    console.error('❌ Appointment change request error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Failed to create change request',
        details: error.message
      },
      { status: 500 }
    )
  }
}

// GET - List change requests for organization
export async function GET(request: NextRequest) {
  try {
    const partnerUser = await getPartnerUserFromAuth(request)
    const { searchParams } = new URL(request.url)
    
    const page = parseInt(searchParams.get('page') || '1')
    const perPage = Math.min(parseInt(searchParams.get('per_page') || '20'), 50)
    const offset = (page - 1) * perPage
    
    const status = searchParams.get('status') // pending, approved, denied, completed, cancelled
    const changeType = searchParams.get('change_type')
    const myRequestsOnly = searchParams.get('my_requests_only') === 'true'

    console.log('📋 Fetching change requests:', {
      organization_id: partnerUser.organization_id,
      status,
      change_type: changeType,
      my_requests_only: myRequestsOnly
    })

    let query = supabaseAdmin
      .from('appointment_change_requests')
      .select(`
        *,
        appointments(
          id,
          start_time,
          end_time,
          status,
          providers(id, first_name, last_name),
          patients!inner(
            id,
            first_name,
            last_name,
            patient_organization_affiliations!inner(
              organization_id,
              status
            )
          )
        ),
        requested_by_user:partner_users(
          id,
          first_name,
          last_name,
          email
        )
      `, { count: 'exact' })
      .eq('appointments.patients.patient_organization_affiliations.organization_id', partnerUser.organization_id)

    if (status) {
      query = query.eq('status', status)
    }
    if (changeType) {
      query = query.eq('change_type', changeType)
    }
    if (myRequestsOnly) {
      query = query.eq('requested_by_user_id', partnerUser.id)
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + perPage - 1)

    const { data: changeRequests, error, count } = await query

    if (error) {
      console.error('❌ Error fetching change requests:', error)
      throw new Error('Failed to fetch change requests')
    }

    const totalPages = Math.ceil((count || 0) / perPage)

    return NextResponse.json({
      success: true,
      data: changeRequests || [],
      pagination: {
        page,
        per_page: perPage,
        total: count || 0,
        total_pages: totalPages
      }
    })

  } catch (error: any) {
    console.error('❌ Change requests fetch error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Failed to fetch change requests',
        details: error.message
      },
      { status: 500 }
    )
  }
}

// Helper function to send notification emails
async function sendChangeRequestNotification(changeRequest: any, partnerUser: any) {
  const appointment = changeRequest.appointments
  const patient = appointment.patients
  const provider = appointment.providers
  
  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #091747;">Appointment Change Request</h2>
      
      <p>A ${changeRequest.change_type} request has been submitted by ${partnerUser.first_name} ${partnerUser.last_name} from ${partnerUser.organization?.name}.</p>
      
      <div style="background-color: #FEF8F1; padding: 15px; border-left: 4px solid #BF9C73; margin: 20px 0;">
        <h3>Appointment Details:</h3>
        <ul style="margin: 0;">
          <li><strong>Patient:</strong> ${patient.first_name} ${patient.last_name}</li>
          <li><strong>Provider:</strong> Dr. ${provider.first_name} ${provider.last_name}</li>
          <li><strong>Original Time:</strong> ${new Date(appointment.start_time).toLocaleString()}</li>
          ${changeRequest.requested_start_time ? `<li><strong>Requested Time:</strong> ${new Date(changeRequest.requested_start_time).toLocaleString()}</li>` : ''}
          <li><strong>Urgency:</strong> ${changeRequest.urgency.toUpperCase()}</li>
        </ul>
      </div>
      
      <div style="background-color: #f8f9fa; padding: 15px; margin: 20px 0;">
        <h3>Reason:</h3>
        <p style="margin: 0;">"${changeRequest.reason}"</p>
        ${changeRequest.patient_preference ? `<p style="margin: 10px 0 0 0;"><em>Patient preference: ${changeRequest.patient_preference}</em></p>` : ''}
      </div>
      
      <p>Please review and process this request in the admin dashboard.</p>
      
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      <p style="color: #666; font-size: 14px;">
        Moonlit Scheduler - Partner Dashboard System
      </p>
    </div>
  `

  // Send to admin team
  await emailService.sendEmail({
    to: 'hello@trymoonlit.com',
    subject: `${changeRequest.urgency.toUpperCase()}: ${changeRequest.change_type} request for ${patient.first_name} ${patient.last_name}`,
    html: emailHtml
  })
}

// Helper function to process change requests (for auto-processing urgent cancellations)
async function processChangeRequest(changeRequestId: string, processedBy: string, notes: string) {
  // This would integrate with Athena/IntakeQ to actually make the changes
  // For now, just update the status
  await supabaseAdmin
    .from('appointment_change_requests')
    .update({
      status: 'completed',
      processed_by: processedBy,
      processed_at: new Date().toISOString(),
      processing_notes: notes
    })
    .eq('id', changeRequestId)
}