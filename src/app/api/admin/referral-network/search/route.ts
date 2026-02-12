// Referral Network Search API
// POST /api/admin/referral-network/search - Search for matching organizations

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isAdminEmail } from '@/lib/admin-auth'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import type { ReferralSearchCriteria, ReferralSearchResult, ReferralOrganization } from '@/types/referral-network'

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

// POST - Search for organizations matching criteria
export async function POST(request: NextRequest) {
  try {
    // Verify admin access
    const { authorized } = await verifyAdminAccess()
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { payer_id, care_type_ids, specialty_tag_ids } = body as ReferralSearchCriteria

    // Validate required fields
    if (!payer_id) {
      return NextResponse.json(
        { success: false, error: 'payer_id is required' },
        { status: 400 }
      )
    }

    if (!care_type_ids || care_type_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one care_type_id is required' },
        { status: 400 }
      )
    }

    console.log('🔍 Searching referral organizations:', { payer_id, care_type_ids, specialty_tag_ids })

    // Get payer name for the response
    const { data: payer } = await supabaseAdmin
      .from('payers')
      .select('name')
      .eq('id', payer_id)
      .single()

    // Get care type names for the response
    const { data: careTypes } = await supabaseAdmin
      .from('referral_care_types')
      .select('id, display_name')
      .in('id', care_type_ids)

    // Get specialty tag names if provided
    let specialtyTagNames: string[] = []
    if (specialty_tag_ids && specialty_tag_ids.length > 0) {
      const { data: specialtyTags } = await supabaseAdmin
        .from('referral_specialty_tags')
        .select('id, display_name')
        .in('id', specialty_tag_ids)
      specialtyTagNames = specialtyTags?.map(t => t.display_name) || []
    }

    // Step 1: Find organizations that accept this payer
    const { data: payerOrgs } = await supabaseAdmin
      .from('organization_accepted_payers')
      .select('organization_id')
      .eq('payer_id', payer_id)
      .eq('is_active', true)

    const payerOrgIds = payerOrgs?.map(p => p.organization_id) || []

    if (payerOrgIds.length === 0) {
      return NextResponse.json({
        organizations: [],
        total_count: 0,
        search_criteria: { payer_id, care_type_ids, specialty_tag_ids },
        payer_name: payer?.name || 'Unknown',
        care_type_names: careTypes?.map(c => c.display_name) || [],
        specialty_tag_names: specialtyTagNames
      } as ReferralSearchResult)
    }

    // Step 2: Filter by care types
    const { data: careTypeOrgs } = await supabaseAdmin
      .from('organization_care_types')
      .select('organization_id')
      .in('organization_id', payerOrgIds)
      .in('care_type_id', care_type_ids)
      .eq('is_active', true)

    const careTypeOrgIds = [...new Set(careTypeOrgs?.map(c => c.organization_id) || [])]

    if (careTypeOrgIds.length === 0) {
      return NextResponse.json({
        organizations: [],
        total_count: 0,
        search_criteria: { payer_id, care_type_ids, specialty_tag_ids },
        payer_name: payer?.name || 'Unknown',
        care_type_names: careTypes?.map(c => c.display_name) || [],
        specialty_tag_names: specialtyTagNames
      } as ReferralSearchResult)
    }

    // Step 3: Optionally filter by specialty tags
    let finalOrgIds = careTypeOrgIds
    if (specialty_tag_ids && specialty_tag_ids.length > 0) {
      const { data: specialtyOrgs } = await supabaseAdmin
        .from('organization_specialties')
        .select('organization_id')
        .in('organization_id', careTypeOrgIds)
        .in('specialty_tag_id', specialty_tag_ids)
        .eq('is_active', true)

      finalOrgIds = [...new Set(specialtyOrgs?.map(s => s.organization_id) || [])]
    }

    if (finalOrgIds.length === 0) {
      return NextResponse.json({
        organizations: [],
        total_count: 0,
        search_criteria: { payer_id, care_type_ids, specialty_tag_ids },
        payer_name: payer?.name || 'Unknown',
        care_type_names: careTypes?.map(c => c.display_name) || [],
        specialty_tag_names: specialtyTagNames
      } as ReferralSearchResult)
    }

    // Step 4: Fetch full organization data
    const { data: organizations, error: orgsError } = await supabaseAdmin
      .from('organizations')
      .select(`
        id,
        name,
        type,
        status,
        address,
        city,
        state,
        postal_code,
        phone,
        email,
        is_referral_destination,
        referral_notes,
        hours_of_operation,
        website,
        fax,
        service_area,
        created_at,
        updated_at
      `)
      .in('id', finalOrgIds)
      .eq('status', 'active')
      .eq('is_referral_destination', true)
      .order('name', { ascending: true })

    if (orgsError) {
      console.error('Error fetching organizations:', orgsError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch organizations' },
        { status: 500 }
      )
    }

    // Enrich with care types and specialties for each org
    const enrichedOrgs: ReferralOrganization[] = await Promise.all(
      (organizations || []).map(async (org) => {
        // Get care types for this org
        const { data: orgCareTypes } = await supabaseAdmin
          .from('organization_care_types')
          .select(`
            id,
            care_type_id,
            notes,
            is_active,
            referral_care_types (
              id,
              name,
              display_name
            )
          `)
          .eq('organization_id', org.id)
          .eq('is_active', true)

        // Get specialties for this org
        const { data: orgSpecialties } = await supabaseAdmin
          .from('organization_specialties')
          .select(`
            id,
            specialty_tag_id,
            notes,
            is_active,
            referral_specialty_tags (
              id,
              name,
              display_name,
              tag_category
            )
          `)
          .eq('organization_id', org.id)
          .eq('is_active', true)

        return {
          ...org,
          care_types: orgCareTypes?.map(ct => ({
            id: ct.id,
            organization_id: org.id,
            care_type_id: ct.care_type_id,
            notes: ct.notes,
            is_active: ct.is_active,
            care_type: ct.referral_care_types as any
          })) || [],
          specialties: orgSpecialties?.map(s => ({
            id: s.id,
            organization_id: org.id,
            specialty_tag_id: s.specialty_tag_id,
            notes: s.notes,
            is_active: s.is_active,
            specialty_tag: s.referral_specialty_tags as any
          })) || []
        } as ReferralOrganization
      })
    )

    console.log(`✅ Found ${enrichedOrgs.length} matching organizations`)

    const response: ReferralSearchResult = {
      organizations: enrichedOrgs,
      total_count: enrichedOrgs.length,
      search_criteria: { payer_id, care_type_ids, specialty_tag_ids },
      payer_name: payer?.name || 'Unknown',
      care_type_names: careTypes?.map(c => c.display_name) || [],
      specialty_tag_names: specialtyTagNames
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Search API error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
