// Referral Network Organization Relationships API
// Manages payers, care types, and specialties for a single organization

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isAdminEmail } from '@/lib/admin-auth'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

async function verifyAdminAccess() {
  try {
    const supabase = createServerComponentClient({ cookies })
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user || !isAdminEmail(user.email || '')) {
      return { authorized: false, user: null }
    }

    return { authorized: true, user }
  } catch (error) {
    console.error('Admin verification error:', error)
    return { authorized: false, user: null }
  }
}

// GET - Get all relationships for an organization
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { authorized } = await verifyAdminAccess()
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    const { id: orgId } = await params

    // Fetch all relationships in parallel
    const [payersResult, careTypesResult, specialtiesResult] = await Promise.all([
      supabaseAdmin
        .from('organization_accepted_payers')
        .select(`
          id,
          payer_id,
          verification_date,
          verified_by,
          notes,
          is_active,
          payers (id, name)
        `)
        .eq('organization_id', orgId)
        .eq('is_active', true),
      supabaseAdmin
        .from('organization_care_types')
        .select(`
          id,
          care_type_id,
          notes,
          is_active,
          referral_care_types (id, name, display_name)
        `)
        .eq('organization_id', orgId)
        .eq('is_active', true),
      supabaseAdmin
        .from('organization_specialties')
        .select(`
          id,
          specialty_tag_id,
          notes,
          is_active,
          referral_specialty_tags (id, name, display_name, tag_category)
        `)
        .eq('organization_id', orgId)
        .eq('is_active', true)
    ])

    return NextResponse.json({
      success: true,
      accepted_payers: payersResult.data || [],
      care_types: careTypesResult.data || [],
      specialties: specialtiesResult.data || []
    })
  } catch (error) {
    console.error('Error fetching organization relationships:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Update all relationships for an organization
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { authorized, user } = await verifyAdminAccess()
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    const { id: orgId } = await params
    const body = await request.json()
    const { payer_ids, care_type_ids, specialty_tag_ids } = body

    // Update payers if provided
    if (payer_ids !== undefined) {
      // Soft delete existing
      await supabaseAdmin
        .from('organization_accepted_payers')
        .update({ is_active: false })
        .eq('organization_id', orgId)

      // Insert new ones
      if (payer_ids.length > 0) {
        const payerInserts = payer_ids.map((payerId: string) => ({
          organization_id: orgId,
          payer_id: payerId,
          verified_by: user?.email,
          verification_date: new Date().toISOString().split('T')[0],
          is_active: true
        }))

        await supabaseAdmin
          .from('organization_accepted_payers')
          .upsert(payerInserts, {
            onConflict: 'organization_id,payer_id',
            ignoreDuplicates: false
          })
      }
    }

    // Update care types if provided
    if (care_type_ids !== undefined) {
      // Soft delete existing
      await supabaseAdmin
        .from('organization_care_types')
        .update({ is_active: false })
        .eq('organization_id', orgId)

      // Insert new ones
      if (care_type_ids.length > 0) {
        const careTypeInserts = care_type_ids.map((careTypeId: string) => ({
          organization_id: orgId,
          care_type_id: careTypeId,
          is_active: true
        }))

        await supabaseAdmin
          .from('organization_care_types')
          .upsert(careTypeInserts, {
            onConflict: 'organization_id,care_type_id',
            ignoreDuplicates: false
          })
      }
    }

    // Update specialties if provided
    if (specialty_tag_ids !== undefined) {
      // Soft delete existing
      await supabaseAdmin
        .from('organization_specialties')
        .update({ is_active: false })
        .eq('organization_id', orgId)

      // Insert new ones
      if (specialty_tag_ids.length > 0) {
        const specialtyInserts = specialty_tag_ids.map((tagId: string) => ({
          organization_id: orgId,
          specialty_tag_id: tagId,
          is_active: true
        }))

        await supabaseAdmin
          .from('organization_specialties')
          .upsert(specialtyInserts, {
            onConflict: 'organization_id,specialty_tag_id',
            ignoreDuplicates: false
          })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating organization relationships:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
