/**
 * Partner Dashboard API - ROI Document Upload
 * Upload and manage Release of Information documents
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'
import { isAdminEmail } from '@/lib/admin-auth'

/**
 * Helper function to get partner user from auth - supports admin impersonation
 */
async function getPartnerUserFromAuth(request: NextRequest) {
  // Get partner_user_id from query string (for admin impersonation)
  const { searchParams } = new URL(request.url)
  const partnerUserId = searchParams.get('partner_user_id')

  // Get authenticated user
  const cookieStore = await cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()

  if (sessionError || !session) {
    throw new Error('Authentication required')
  }

  // SECURITY: If partner_user_id is provided, verify the requester is an admin
  if (partnerUserId) {
    const isAdmin = await isAdminEmail(session.user.email || '')
    if (!isAdmin) {
      console.warn('⚠️ Non-admin attempted to use partner_user_id parameter:', session.user.email)
      throw new Error('Admin access required for impersonation')
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
    throw new Error('Partner user not found')
  }

  return partnerUser
}

/**
 * GET - Get signed URL for viewing ROI document
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { patientId: string } }
) {
  try {
    const partnerUser = await getPartnerUserFromAuth(request)

    // Get affiliation
    const { data: affiliation, error: affiliationError } = await supabaseAdmin
      .from('patient_organization_affiliations')
      .select('id, roi_file_url')
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

    if (!affiliation.roi_file_url) {
      return NextResponse.json(
        { success: false, error: 'No ROI document found' },
        { status: 404 }
      )
    }

    // Extract file path from URL
    const filePath = affiliation.roi_file_url.split('/roi-documents/').pop()

    if (!filePath) {
      return NextResponse.json(
        { success: false, error: 'Invalid file URL' },
        { status: 400 }
      )
    }

    // Generate signed URL (valid for 1 hour)
    const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
      .from('roi-documents')
      .createSignedUrl(filePath, 3600) // 1 hour expiry

    if (signedUrlError || !signedUrlData) {
      console.error('Error creating signed URL:', signedUrlError)
      return NextResponse.json(
        { success: false, error: 'Failed to generate document URL' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        signedUrl: signedUrlData.signedUrl,
        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString()
      }
    })

  } catch (error: any) {
    console.error('❌ Error getting ROI document:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get ROI document', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST - Upload ROI document
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

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const affiliationId = formData.get('affiliation_id') as string
    const expirationDate = formData.get('expiration_date') as string | null

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { success: false, error: 'Only PDF files are allowed' },
        { status: 400 }
      )
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: 'File size must be less than 10MB' },
        { status: 400 }
      )
    }

    // Verify affiliation belongs to partner's organization
    const { data: affiliation, error: affiliationError } = await supabaseAdmin
      .from('patient_organization_affiliations')
      .select('id, patient_id, organization_id')
      .eq('id', affiliationId)
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

    // Convert file to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Generate file path: {org_id}/{patient_id}/roi-{timestamp}.pdf
    const timestamp = Date.now()
    const filePath = `${partnerUser.organization_id}/${params.patientId}/roi-${timestamp}.pdf`

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('roi-documents')
      .upload(filePath, buffer, {
        contentType: 'application/pdf',
        upsert: false
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return NextResponse.json(
        { success: false, error: 'Failed to upload file to storage', details: uploadError.message },
        { status: 500 }
      )
    }

    // Get public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('roi-documents')
      .getPublicUrl(filePath)

    // Update affiliation with ROI info
    const { error: updateError } = await supabaseAdmin
      .from('patient_organization_affiliations')
      .update({
        consent_on_file: true,
        consent_expires_on: expirationDate || null,
        roi_file_url: publicUrl,
        roi_storage_location: 'uploaded',
        updated_at: new Date().toISOString()
      })
      .eq('id', affiliationId)

    if (updateError) {
      console.error('Error updating affiliation:', updateError)
      // Try to delete uploaded file if DB update fails
      await supabaseAdmin.storage.from('roi-documents').remove([filePath])

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
        title: 'ROI document uploaded',
        description: expirationDate
          ? `ROI uploaded by ${partnerUser.id}, expires ${expirationDate}`
          : `ROI uploaded by ${partnerUser.id} (no expiration)`,
        metadata: {
          uploaded_by: partnerUser.id,
          expiration_date: expirationDate || null,
          file_path: filePath
        },
        actor_type: 'partner_user',
        actor_id: partnerUser.id,
        visible_to_partner: true,
        visible_to_patient: false
      })

    return NextResponse.json({
      success: true,
      data: {
        file_url: publicUrl,
        expiration_date: expirationDate || null,
        message: 'ROI document uploaded successfully'
      }
    })

  } catch (error: any) {
    console.error('❌ Error uploading ROI:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to upload ROI document', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Remove ROI document
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { patientId: string } }
) {
  try {
    const partnerUser = await getPartnerUserFromAuth(request)

    // Get affiliation
    const { data: affiliation, error: affiliationError } = await supabaseAdmin
      .from('patient_organization_affiliations')
      .select('id, roi_file_url')
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

    // Extract file path from URL
    const filePath = affiliation.roi_file_url?.split('/roi-documents/').pop()

    // Delete from storage if exists
    if (filePath) {
      await supabaseAdmin.storage.from('roi-documents').remove([filePath])
    }

    // Update affiliation
    const { error: updateError } = await supabaseAdmin
      .from('patient_organization_affiliations')
      .update({
        consent_on_file: false,
        consent_expires_on: null,
        roi_file_url: null,
        roi_storage_location: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', affiliation.id)

    if (updateError) {
      return NextResponse.json(
        { success: false, error: 'Failed to remove ROI' },
        { status: 500 }
      )
    }

    // Create activity log
    await supabaseAdmin
      .from('patient_activity_log')
      .insert({
        patient_id: params.patientId,
        organization_id: partnerUser.organization_id,
        activity_type: 'roi_expired',
        title: 'ROI document removed',
        description: `ROI removed by ${partnerUser.id}`,
        metadata: {
          removed_by: partnerUser.id
        },
        actor_type: 'partner_user',
        actor_id: partnerUser.id,
        visible_to_partner: true,
        visible_to_patient: false
      })

    return NextResponse.json({
      success: true,
      message: 'ROI document removed successfully'
    })

  } catch (error: any) {
    console.error('❌ Error removing ROI:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to remove ROI document', details: error.message },
      { status: 500 }
    )
  }
}
