// Organizations API - List and Create Organizations
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { CreateOrganizationRequest } from '@/types/partner-types'

// GET - List organizations with filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Pagination
    const page = parseInt(searchParams.get('page') || '1')
    const perPage = Math.min(parseInt(searchParams.get('per_page') || '20'), 100)
    const offset = (page - 1) * perPage
    
    // Filters
    const status = searchParams.get('status') // active, inactive, suspended
    const type = searchParams.get('type') // healthcare_partner, treatment_center, etc.
    const search = searchParams.get('search') // search in name
    const includeStats = searchParams.get('include_stats') === 'true'
    
    console.log('🏢 Fetching organizations:', { page, perPage, status, type, search })

    // Build base query
    let query = supabaseAdmin
      .from('organizations')
      .select(`
        *
      `, { count: 'exact' })

    // Apply filters
    if (status) {
      query = query.eq('status', status)
    }
    if (type) {
      query = query.eq('type', type)
    }
    if (search) {
      query = query.ilike('name', `%${search}%`)
    }
    
    // Apply pagination and ordering
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + perPage - 1)

    const { data: organizations, error, count } = await query

    if (error) {
      console.error('❌ Error fetching organizations:', error)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to fetch organizations',
          details: error.message
        },
        { status: 500 }
      )
    }

    // Optionally include statistics
    let organizationsWithStats = organizations
    if (includeStats && organizations) {
      organizationsWithStats = await Promise.all(
        organizations.map(async (org) => {
          // Get partner counts
          const { count: partnersCount } = await supabaseAdmin
            .from('partners')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', org.id)

          // Get active partner users count
          const { count: usersCount } = await supabaseAdmin
            .from('partner_users')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', org.id)
            .eq('status', 'active')

          // Get active patient affiliations count
          const { count: patientsCount } = await supabaseAdmin
            .from('patient_organization_affiliations')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', org.id)
            .eq('status', 'active')

          return {
            ...org,
            stats: {
              partners_count: partnersCount || 0,
              active_users_count: usersCount || 0,
              active_patients_count: patientsCount || 0
            }
          }
        })
      )
    }

    const totalPages = Math.ceil((count || 0) / perPage)

    return NextResponse.json({
      success: true,
      data: organizationsWithStats || [],
      pagination: {
        page,
        per_page: perPage,
        total: count || 0,
        total_pages: totalPages
      }
    })

  } catch (error: any) {
    console.error('❌ Organizations fetch error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch organizations',
        details: error.message
      },
      { status: 500 }
    )
  }
}

// POST - Create new organization
export async function POST(request: NextRequest) {
  try {
    const body: CreateOrganizationRequest = await request.json()
    
    const {
      name,
      slug,
      type = 'healthcare_partner',
      primary_contact_email,
      primary_contact_phone,
      primary_contact_name,
      address_line_1,
      address_line_2,
      city,
      state,
      zip_code,
      allowed_domains
    } = body

    if (!name || !slug) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Organization name and slug are required' 
        },
        { status: 400 }
      )
    }

    // Validate slug format (lowercase, letters, numbers, hyphens only)
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Slug must contain only lowercase letters, numbers, and hyphens' 
        },
        { status: 400 }
      )
    }

    // Validate type
    const validTypes = ['healthcare_partner', 'treatment_center', 'rehabilitation', 'mental_health', 'substance_abuse', 'other']
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Invalid type. Must be one of: ${validTypes.join(', ')}` 
        },
        { status: 400 }
      )
    }

    console.log('🏢 Creating new organization:', { name, slug, type })

    // Check if slug already exists
    const { data: existingOrg } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('slug', slug)
      .single()

    if (existingOrg) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'An organization with this slug already exists' 
        },
        { status: 409 }
      )
    }

    // Create organization record
    const organizationData: any = {
      name: name.trim(),
      slug: slug.toLowerCase(),
      type,
      status: 'active',
      primary_contact_email: primary_contact_email?.toLowerCase() || null,
      primary_contact_phone: primary_contact_phone || null,
      primary_contact_name: primary_contact_name || null,
      address_line_1: address_line_1 || null,
      address_line_2: address_line_2 || null,
      city: city || null,
      state: state || null,
      zip_code: zip_code || null,
      allowed_domains: allowed_domains || []
    }

    const { data: organization, error: organizationError } = await supabaseAdmin
      .from('organizations')
      .insert(organizationData)
      .select()
      .single()

    if (organizationError) {
      console.error('❌ Failed to create organization:', organizationError)
      
      if (organizationError.code === '23505') { // Unique constraint violation
        return NextResponse.json(
          { 
            success: false, 
            error: 'An organization with this slug already exists' 
          },
          { status: 409 }
        )
      }
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to create organization',
          details: organizationError.message
        },
        { status: 500 }
      )
    }

    // Log creation for audit
    await supabaseAdmin
      .from('scheduler_audit_logs')
      .insert({
        action: 'organization_created',
        resource_type: 'organization',
        resource_id: organization.id,
        details: {
          organization_name: organization.name,
          slug: organization.slug,
          type: organization.type,
          status: organization.status
        }
      })

    console.log('✅ Organization created successfully:', {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      type: organization.type
    })

    return NextResponse.json({
      success: true,
      data: organization,
      message: 'Organization created successfully'
    })

  } catch (error: any) {
    console.error('❌ Organization creation error:', error)
    
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