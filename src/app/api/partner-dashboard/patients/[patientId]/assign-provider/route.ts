/**
 * Partner Dashboard API - Assign Primary Provider to Patient
 * Allows admins to manually assign or change a patient's primary provider
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * POST - Assign primary provider to patient
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { patientId: string } }
) {
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

    // Get partner user
    const { data: partnerUser, error: userError } = await supabaseAdmin
      .from('partner_users')
      .select('id, organization_id, role')
      .eq('auth_user_id', session.user.id)
      .eq('is_active', true)
      .single()

    if (userError || !partnerUser) {
      return NextResponse.json(
        { success: false, error: 'Partner user not found' },
        { status: 404 }
      )
    }

    // Only admins and case managers can assign providers
    if (!['partner_admin', 'partner_case_manager'].includes(partnerUser.role)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { provider_id } = body

    if (!provider_id) {
      return NextResponse.json(
        { success: false, error: 'Provider ID required' },
        { status: 400 }
      )
    }

    // Verify patient belongs to partner's organization
    const { data: affiliation, error: affiliationError } = await supabaseAdmin
      .from('patient_organization_affiliations')
      .select('id')
      .eq('patient_id', params.patientId)
      .eq('organization_id', partnerUser.organization_id)
      .eq('status', 'active')
      .single()

    if (affiliationError || !affiliation) {
      return NextResponse.json(
        { success: false, error: 'Patient not found or not affiliated with your organization' },
        { status: 404 }
      )
    }

    // Verify provider exists and is active
    const { data: provider, error: providerError } = await supabaseAdmin
      .from('providers')
      .select('id, first_name, last_name, is_active')
      .eq('id', provider_id)
      .single()

    if (providerError || !provider) {
      return NextResponse.json(
        { success: false, error: 'Provider not found' },
        { status: 404 }
      )
    }

    if (!provider.is_active) {
      return NextResponse.json(
        { success: false, error: 'Cannot assign inactive provider' },
        { status: 400 }
      )
    }

    // Get current primary provider for logging
    const { data: currentPatient } = await supabaseAdmin
      .from('patients')
      .select('primary_provider_id, providers:primary_provider_id(first_name, last_name)')
      .eq('id', params.patientId)
      .single()

    const oldProviderId = currentPatient?.primary_provider_id
    const oldProviderName = currentPatient?.providers
      ? `Dr. ${currentPatient.providers.first_name} ${currentPatient.providers.last_name}`
      : 'None'

    // Update patient's primary provider
    const { error: updateError } = await supabaseAdmin
      .from('patients')
      .update({
        primary_provider_id: provider_id,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.patientId)

    if (updateError) {
      console.error('Error updating primary provider:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to assign provider' },
        { status: 500 }
      )
    }

    // Create activity log
    await supabaseAdmin
      .from('patient_activity_log')
      .insert({
        patient_id: params.patientId,
        organization_id: partnerUser.organization_id,
        activity_type: 'provider_assigned',
        title: 'Primary provider assigned',
        description: oldProviderId
          ? `Primary provider changed from ${oldProviderName} to Dr. ${provider.first_name} ${provider.last_name} by ${partnerUser.id}`
          : `Primary provider set to Dr. ${provider.first_name} ${provider.last_name} by ${partnerUser.id}`,
        metadata: {
          assigned_by: partnerUser.id,
          old_provider_id: oldProviderId,
          new_provider_id: provider_id,
          provider_name: `Dr. ${provider.first_name} ${provider.last_name}`
        },
        actor_type: 'partner_user',
        actor_id: partnerUser.id,
        visible_to_partner: true,
        visible_to_patient: false
      })

    return NextResponse.json({
      success: true,
      data: {
        patient_id: params.patientId,
        provider_id: provider_id,
        provider_name: `Dr. ${provider.first_name} ${provider.last_name}`,
        message: 'Primary provider assigned successfully'
      }
    })

  } catch (error: any) {
    console.error('❌ Error assigning provider:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to assign provider', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Remove primary provider assignment
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { patientId: string } }
) {
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

    // Get partner user
    const { data: partnerUser, error: userError } = await supabaseAdmin
      .from('partner_users')
      .select('id, organization_id, role')
      .eq('auth_user_id', session.user.id)
      .eq('is_active', true)
      .single()

    if (userError || !partnerUser) {
      return NextResponse.json(
        { success: false, error: 'Partner user not found' },
        { status: 404 }
      )
    }

    // Only admins can remove provider assignments
    if (partnerUser.role !== 'partner_admin') {
      return NextResponse.json(
        { success: false, error: 'Only admins can remove provider assignments' },
        { status: 403 }
      )
    }

    // Update patient to remove primary provider
    const { error: updateError } = await supabaseAdmin
      .from('patients')
      .update({
        primary_provider_id: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.patientId)

    if (updateError) {
      return NextResponse.json(
        { success: false, error: 'Failed to remove provider assignment' },
        { status: 500 }
      )
    }

    // Create activity log
    await supabaseAdmin
      .from('patient_activity_log')
      .insert({
        patient_id: params.patientId,
        organization_id: partnerUser.organization_id,
        activity_type: 'provider_removed',
        title: 'Primary provider removed',
        description: `Primary provider assignment removed by ${partnerUser.id}`,
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
      message: 'Primary provider assignment removed successfully'
    })

  } catch (error: any) {
    console.error('❌ Error removing provider:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to remove provider assignment', details: error.message },
      { status: 500 }
    )
  }
}
