// Admin Partner CRM API
// GET /api/admin/partners - List all partners with organization details
// POST /api/admin/partners - Create new partner

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

// GET - List all partners for admin CRM
export async function GET(request: NextRequest) {
  try {
    // Verify admin access
    const { authorized, user } = await verifyAdminAccess()
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Get query parameters for filtering/pagination
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const perPage = parseInt(searchParams.get('per_page') || '25')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const stage = searchParams.get('stage') || ''

    console.log('🔍 Admin fetching partners:', { page, perPage, search, status, stage })

    // Build query
    let query = supabaseAdmin
      .from('partners')
      .select(`
        id,
        organization_id,
        name,
        contact_email,
        contact_phone,
        contact_person,
        title,
        stage,
        status,
        source,
        specialties,
        insurance_types,
        monthly_referral_capacity,
        notes,
        website,
        linkedin_url,
        first_contact_date,
        last_contact_date,
        contract_signed_date,
        go_live_date,
        created_by,
        assigned_to,
        created_at,
        updated_at,
        organization:organizations(
          id,
          name,
          slug,
          type,
          status,
          primary_contact_email,
          primary_contact_phone,
          city,
          state
        )
      `)

    // Apply filters
    if (search) {
      query = query.or(`name.ilike.%${search}%,contact_email.ilike.%${search}%,contact_person.ilike.%${search}%`)
    }
    
    if (status) {
      query = query.eq('status', status)
    }
    
    if (stage) {
      query = query.eq('stage', stage)
    }

    // Get total count for pagination
    const { count } = await query.select('*', { count: 'exact', head: true })

    // Get paginated results
    const offset = (page - 1) * perPage
    const { data: partners, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + perPage - 1)

    if (error) {
      console.error('❌ Error fetching partners:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch partners' },
        { status: 500 }
      )
    }

    // Transform data for frontend
    const transformedPartners = partners.map(partner => ({
      ...partner,
      organization_name: partner.organization?.name || 'No Organization',
      organization_type: partner.organization?.type || null,
      organization_status: partner.organization?.status || null,
      location: partner.organization ? 
        [partner.organization.city, partner.organization.state].filter(Boolean).join(', ') : 
        null
    }))

    console.log(`✅ Found ${partners.length} partners (${count} total)`)

    return NextResponse.json({
      success: true,
      data: transformedPartners,
      pagination: {
        page,
        per_page: perPage,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / perPage)
      }
    })

  } catch (error: any) {
    console.error('❌ Admin partners API error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        details: error.message
      },
      { status: 500 }
    )
  }
}

// POST - Create new partner
export async function POST(request: NextRequest) {
  try {
    // Verify admin access
    const { authorized, user } = await verifyAdminAccess()
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    
    // Validate required fields
    if (!body.name) {
      return NextResponse.json(
        { success: false, error: 'Partner name is required' },
        { status: 400 }
      )
    }

    console.log('➕ Admin creating new partner:', body.name)

    // Create partner record
    const { data: partner, error } = await supabaseAdmin
      .from('partners')
      .insert({
        name: body.name,
        organization_id: body.organization_id || null,
        contact_email: body.contact_email || null,
        contact_phone: body.contact_phone || null,
        contact_person: body.contact_person || null,
        title: body.title || null,
        stage: body.stage || 'lead',
        status: body.status || 'prospect',
        source: body.source || null,
        specialties: body.specialties || [],
        insurance_types: body.insurance_types || [],
        monthly_referral_capacity: body.monthly_referral_capacity || null,
        notes: body.notes || null,
        website: body.website || null,
        linkedin_url: body.linkedin_url || null,
        first_contact_date: body.first_contact_date || new Date().toISOString().split('T')[0],
        created_by: user?.id || 'admin',
        assigned_to: body.assigned_to || user?.id || 'admin'
      })
      .select(`
        *,
        organization:organizations(
          id,
          name,
          slug,
          type,
          status
        )
      `)
      .single()

    if (error) {
      console.error('❌ Error creating partner:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to create partner' },
        { status: 500 }
      )
    }

    // Log admin action
    await supabaseAdmin
      .from('scheduler_audit_logs')
      .insert({
        action: 'partner_created',
        resource_type: 'partner',
        resource_id: partner.id,
        performed_by: user?.id || 'admin',
        details: {
          partner_name: partner.name,
          admin_email: user?.email,
          ip_address: request.headers.get('x-forwarded-for') || 'unknown'
        }
      })

    console.log('✅ Partner created successfully:', partner.id)

    return NextResponse.json({
      success: true,
      data: partner,
      message: 'Partner created successfully'
    })

  } catch (error: any) {
    console.error('❌ Admin create partner error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to create partner',
        details: error.message
      },
      { status: 500 }
    )
  }
}