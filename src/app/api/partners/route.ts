// Partners CRM API - List and Create Partners
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { CreatePartnerRequest, Partner } from '@/types/partner-types'

// GET - List partners with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Pagination
    const page = parseInt(searchParams.get('page') || '1')
    const perPage = Math.min(parseInt(searchParams.get('per_page') || '20'), 100)
    const offset = (page - 1) * perPage
    
    // Filters
    const status = searchParams.get('status') // prospect, active, paused, terminated
    const stage = searchParams.get('stage') // lead, qualified, contract_sent, live, dormant
    const organizationId = searchParams.get('organization_id')
    const assignedTo = searchParams.get('assigned_to')
    const search = searchParams.get('search') // search in name, contact_email, contact_person
    const hasOrganization = searchParams.get('has_organization') // true/false
    
    console.log('📋 Fetching partners:', { 
      page, 
      perPage, 
      status, 
      stage, 
      organizationId, 
      search 
    })

    // Build query  
    let query = supabaseAdmin
      .from('partners')
      .select(`*`, { count: 'exact' })

    // Apply filters
    if (status) {
      query = query.eq('status', status)
    }
    if (stage) {
      query = query.eq('stage', stage)
    }
    if (organizationId) {
      query = query.eq('organization_id', organizationId)
    }
    if (assignedTo) {
      query = query.eq('assigned_to', assignedTo)
    }
    if (hasOrganization === 'true') {
      query = query.not('organization_id', 'is', null)
    } else if (hasOrganization === 'false') {
      query = query.is('organization_id', null)
    }
    
    // Search functionality
    if (search) {
      query = query.or(`name.ilike.%${search}%,contact_email.ilike.%${search}%,contact_person.ilike.%${search}%`)
    }
    
    // Apply pagination and ordering
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + perPage - 1)

    const { data: partners, error, count } = await query

    if (error) {
      console.error('❌ Error fetching partners:', error)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to fetch partners',
          details: error.message
        },
        { status: 500 }
      )
    }

    const totalPages = Math.ceil((count || 0) / perPage)

    return NextResponse.json({
      success: true,
      data: partners || [],
      pagination: {
        page,
        per_page: perPage,
        total: count || 0,
        total_pages: totalPages
      }
    })

  } catch (error: any) {
    console.error('❌ Partners fetch error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch partners',
        details: error.message
      },
      { status: 500 }
    )
  }
}

// POST - Create new partner
export async function POST(request: NextRequest) {
  try {
    const body: CreatePartnerRequest = await request.json()
    
    const {
      name,
      organization_id,
      contact_email,
      contact_phone,
      contact_person,
      title,
      stage = 'lead',
      status = 'prospect',
      source,
      specialties,
      insurance_types,
      monthly_referral_capacity,
      notes,
      website,
      linkedin_url,
      first_contact_date
    } = body

    if (!name) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Partner name is required' 
        },
        { status: 400 }
      )
    }

    // Validate stage and status
    const validStages = ['lead', 'qualified', 'contract_sent', 'live', 'dormant']
    const validStatuses = ['prospect', 'active', 'paused', 'terminated']
    
    if (!validStages.includes(stage)) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Invalid stage. Must be one of: ${validStages.join(', ')}` 
        },
        { status: 400 }
      )
    }
    
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
        },
        { status: 400 }
      )
    }

    console.log('✨ Creating new partner:', { name, stage, status, organization_id })

    // If organization_id provided, verify it exists
    if (organization_id) {
      const { data: org, error: orgError } = await supabaseAdmin
        .from('organizations')
        .select('id, name')
        .eq('id', organization_id)
        .single()

      if (orgError || !org) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Organization not found' 
          },
          { status: 404 }
        )
      }
    }

    // Create partner record
    const partnerData: any = {
      name: name.trim(),
      organization_id: organization_id || null,
      contact_email: contact_email?.toLowerCase() || null,
      contact_phone: contact_phone || null,
      contact_person: contact_person || null,
      title: title || null,
      stage,
      status,
      source: source || null,
      specialties: specialties || [],
      insurance_types: insurance_types || [],
      monthly_referral_capacity: monthly_referral_capacity || 0,
      notes: notes || null,
      website: website || null,
      linkedin_url: linkedin_url || null,
      first_contact_date: first_contact_date || new Date().toISOString().split('T')[0],
      last_contact_date: new Date().toISOString().split('T')[0]
    }

    const { data: partner, error: partnerError } = await supabaseAdmin
      .from('partners')
      .insert(partnerData)
      .select(`*`)
      .single()

    if (partnerError) {
      console.error('❌ Failed to create partner:', partnerError)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to create partner',
          details: partnerError.message
        },
        { status: 500 }
      )
    }

    // Log creation for audit
    await supabaseAdmin
      .from('scheduler_audit_logs')
      .insert({
        action: 'partner_created',
        resource_type: 'partner',
        resource_id: partner.id,
        details: {
          partner_name: partner.name,
          stage: partner.stage,
          status: partner.status,
          organization_id: partner.organization_id
        }
      })

    console.log('✅ Partner created successfully:', {
      id: partner.id,
      name: partner.name,
      stage: partner.stage,
      status: partner.status
    })

    return NextResponse.json({
      success: true,
      data: partner,
      message: 'Partner created successfully'
    })

  } catch (error: any) {
    console.error('❌ Partner creation error:', error)
    
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