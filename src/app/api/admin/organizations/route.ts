// Admin Organizations API
// GET /api/admin/organizations - List all organizations
// POST /api/admin/organizations - Create new organization

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

// GET - List all organizations for admin management
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

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const perPage = parseInt(searchParams.get('per_page') || '25')
    const search = searchParams.get('search') || ''
    const type = searchParams.get('type') || ''
    const status = searchParams.get('status') || ''
    const sort = searchParams.get('sort') || 'updated_at_desc'

    console.log('🏢 Admin fetching organizations:', { page, perPage, search, type, status, sort })

    // Build query with partner and user counts
    let query = supabaseAdmin
      .from('organizations')
      .select(`
        id,
        name,
        slug,
        type,
        status,
        primary_contact_email,
        primary_contact_phone,
        primary_contact_name,
        address_line_1,
        address_line_2,
        city,
        state,
        zip_code,
        tax_id,
        license_number,
        accreditation_details,
        allowed_domains,
        settings,
        created_at,
        updated_at
      `)

    // Apply filters
    if (search) {
      query = query.or(`name.ilike.%${search}%,primary_contact_email.ilike.%${search}%,city.ilike.%${search}%`)
    }
    
    if (type) {
      query = query.eq('type', type)
    }
    
    if (status) {
      query = query.eq('status', status)
    }

    // Get total count
    const { count } = await query.select('*', { count: 'exact', head: true })

    // Apply sorting
    const [sortField, sortDirection] = sort.split('_')
    const ascending = sortDirection === 'asc'
    
    let sortColumn = 'created_at' // default
    if (sortField === 'updated' || sortField === 'updated_at') {
      sortColumn = 'updated_at'
    } else if (sortField === 'created' || sortField === 'created_at') {
      sortColumn = 'created_at'  
    } else if (sortField === 'name') {
      sortColumn = 'name'
    }
    
    // Get paginated results
    const offset = (page - 1) * perPage
    const { data: organizations, error } = await query
      .order(sortColumn, { ascending })
      .range(offset, offset + perPage - 1)

    if (error) {
      console.error('❌ Error fetching organizations:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch organizations' },
        { status: 500 }
      )
    }

    // Get partner and user counts for each organization
    const organizationsWithCounts = await Promise.all(
      organizations.map(async (org) => {
        // Get partner count
        const { count: partnerCount } = await supabaseAdmin
          .from('partners')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', org.id)

        // Get user count
        const { count: userCount } = await supabaseAdmin
          .from('partner_users')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', org.id)
          .eq('is_active', true)

        // Get recent activity (last partner created or updated)
        const { data: recentPartner } = await supabaseAdmin
          .from('partners')
          .select('updated_at')
          .eq('organization_id', org.id)
          .order('updated_at', { ascending: false })
          .limit(1)
          .single()

        return {
          ...org,
          partner_count: partnerCount || 0,
          user_count: userCount || 0,
          last_activity: recentPartner?.updated_at || org.updated_at,
          location: [org.city, org.state].filter(Boolean).join(', ') || null
        }
      })
    )

    // Handle post-processing sorting for computed fields
    let finalOrganizations = organizationsWithCounts
    if (sortField === 'last' && sortDirection === 'activity') {
      // Handle last_activity_desc
      finalOrganizations = organizationsWithCounts.sort((a, b) => {
        const dateA = new Date(a.last_activity).getTime()
        const dateB = new Date(b.last_activity).getTime()
        return dateB - dateA // desc
      })
    } else if (sortField === 'user' && sortDirection === 'count') {
      // Handle user_count_desc
      finalOrganizations = organizationsWithCounts.sort((a, b) => {
        return (b.user_count || 0) - (a.user_count || 0) // desc
      })
    } else if (sortField === 'partner' && sortDirection === 'count') {
      // Handle partner_count_desc  
      finalOrganizations = organizationsWithCounts.sort((a, b) => {
        return (b.partner_count || 0) - (a.partner_count || 0) // desc
      })
    }

    console.log(`✅ Found ${organizations.length} organizations (${count} total), sorted by ${sort}`)

    return NextResponse.json({
      success: true,
      data: finalOrganizations,
      pagination: {
        page,
        per_page: perPage,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / perPage)
      }
    })

  } catch (error: any) {
    console.error('❌ Admin organizations API error:', error)
    
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

// POST - Create new organization
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
    if (!body.name || !body.slug) {
      return NextResponse.json(
        { success: false, error: 'Organization name and slug are required' },
        { status: 400 }
      )
    }

    console.log('➕ Admin creating new organization:', body.name)

    // Check if slug is unique
    const { data: existingOrg } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('slug', body.slug)
      .single()

    if (existingOrg) {
      return NextResponse.json(
        { success: false, error: 'Organization slug already exists' },
        { status: 400 }
      )
    }

    // Create organization record
    const { data: organization, error } = await supabaseAdmin
      .from('organizations')
      .insert({
        name: body.name,
        slug: body.slug,
        type: body.type || 'treatment_center',
        status: body.status || 'active',
        primary_contact_email: body.primary_contact_email || null,
        primary_contact_phone: body.primary_contact_phone || null,
        primary_contact_name: body.primary_contact_name || null,
        address_line_1: body.address_line_1 || null,
        address_line_2: body.address_line_2 || null,
        city: body.city || null,
        state: body.state || null,
        zip_code: body.zip_code || null,
        tax_id: body.tax_id || null,
        license_number: body.license_number || null,
        accreditation_details: body.accreditation_details || null,
        allowed_domains: body.allowed_domains || [],
        settings: body.settings || {}
      })
      .select()
      .single()

    if (error) {
      console.error('❌ Error creating organization:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to create organization' },
        { status: 500 }
      )
    }

    // Log admin action
    await supabaseAdmin
      .from('scheduler_audit_logs')
      .insert({
        action: 'organization_created',
        resource_type: 'organization',
        resource_id: organization.id,
        performed_by: user?.id || 'admin',
        details: {
          organization_name: organization.name,
          organization_slug: organization.slug,
          admin_email: user?.email,
          ip_address: request.headers.get('x-forwarded-for') || 'unknown'
        }
      })

    console.log('✅ Organization created successfully:', organization.id)

    return NextResponse.json({
      success: true,
      data: {
        ...organization,
        partner_count: 0,
        user_count: 0,
        last_activity: organization.updated_at,
        location: [organization.city, organization.state].filter(Boolean).join(', ') || null
      },
      message: 'Organization created successfully'
    })

  } catch (error: any) {
    console.error('❌ Admin create organization error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to create organization',
        details: error.message
      },
      { status: 500 }
    )
  }
}