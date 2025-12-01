/**
 * Partner Dashboard API - Mark ROI as Stored on PracticeQ
 * Update affiliation to indicate ROI is stored in PracticeQ system
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'
import { isAdminEmail } from '@/lib/admin-auth'

/**
 * POST - Mark ROI as stored on PracticeQ
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { patientId: string } }
) {
  try {
    // Get partner_user_id from query string (for admin impersonation)
    const { searchParams } = new URL(request.url)
    const partnerUserId = searchParams.get('partner_user_id')

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

    // SECURITY: If partner_user_id is provided, verify the requester is an admin
    if (partnerUserId) {
      const isAdmin = await isAdminEmail(session.user.email || '')
      if (!isAdmin) {
        console.warn('⚠️ Non-admin attempted to use partner_user_id parameter:', session.user.email)
        return NextResponse.json(
          { success: false, error: 'Admin access required for impersonation' },
          { status: 403 }
        )
      }
    }

    // Get partner user record
    let partnerUserQuery = supabaseAdmin
      .from('partner_users')
      .select('id, organization_id, role')
      .eq('is_active', true)

    if (partnerUserId) {
      // Admin is impersonating - use provided partner_user_id
      partnerUserQuery = partnerUserQuery.eq('id', partnerUserId)
    } else {
      // Regular partner user - lookup by auth_user_id
      partnerUserQuery = partnerUserQuery.eq('auth_user_id', session.user.id)
    }

    const { data: partnerUser, error: userError } = await partnerUserQuery.single()

    if (userError || !partnerUser) {
      return NextResponse.json(
        { success: false, error: 'Partner user not found' },
        { status: 404 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { affiliation_id, expiration_date } = body

    if (!affiliation_id) {
      return NextResponse.json(
        { success: false, error: 'Affiliation ID required' },
        { status: 400 }
      )
    }

    // Verify affiliation belongs to partner's organization
    const { data: affiliation, error: affiliationError } = await supabaseAdmin
      .from('patient_organization_affiliations')
      .select('id, patient_id, organization_id')
      .eq('id', affiliation_id)
      .eq('patient_id', params.patientId)
      .eq('organization_id', partnerUser.organization_id)
      .eq('status', 'active')
      .single()

    if (affiliationError || !affiliation) {
      return NextResponse.json(
        { success: false, error: 'Patient affiliation not found' },
        { status: 404 }
      )
    }

    // Update affiliation with ROI info (stored on PracticeQ)
    const { error: updateError } = await supabaseAdmin
      .from('patient_organization_affiliations')
      .update({
        consent_on_file: true,
        consent_expires_on: expiration_date || null,
        roi_file_url: null, // No file uploaded to our system
        roi_storage_location: 'practiceq',
        updated_at: new Date().toISOString()
      })
      .eq('id', affiliation_id)

    if (updateError) {
      console.error('Error updating affiliation:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update ROI status' },
        { status: 500 }
      )
    }

    // Create activity log
    await supabaseAdmin
      .from('patient_activity_log')
      .insert({
        patient_id: params.patientId,
        organization_id: partnerUser.organization_id,
        activity_type: 'roi_granted',
        title: 'ROI marked as stored on PracticeQ',
        description: expiration_date
          ? `ROI marked by ${partnerUser.id} as stored on PracticeQ, expires ${expiration_date}`
          : `ROI marked by ${partnerUser.id} as stored on PracticeQ (no expiration)`,
        metadata: {
          marked_by: partnerUser.id,
          expiration_date: expiration_date || null,
          storage_location: 'practiceq'
        },
        actor_type: 'partner_user',
        actor_id: partnerUser.id,
        visible_to_partner: true,
        visible_to_patient: false
      })

    return NextResponse.json({
      success: true,
      data: {
        storage_location: 'practiceq',
        expiration_date: expiration_date || null,
        message: 'ROI marked as stored on PracticeQ successfully'
      }
    })

  } catch (error: any) {
    console.error('❌ Error marking ROI as PracticeQ:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to mark ROI as stored on PracticeQ', details: error.message },
      { status: 500 }
    )
  }
}
