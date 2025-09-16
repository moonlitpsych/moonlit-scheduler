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
    const cookieStore = await cookies()
    const supabase = createServerComponentClient({ cookies: () => cookieStore })
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

    // Query contacts table for individual partner contacts (172 records)
    let query = supabaseAdmin
      .from('contacts')
      .select(`
        id,
        first_name,
        last_name,
        title,
        email,
        phone,
        is_primary,
        notes,
        partner_id,
        organization_id,
        created_at,
        updated_at
      `)

    // Apply filters (adapted for contacts table)
    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,title.ilike.%${search}%`)
    }
    
    if (status) {
      query = query.eq('is_primary', status === 'primary')
    }
    
    if (stage) {
      // Could filter by title or notes containing stage info
      query = query.ilike('title', `%${stage}%`)
    }

    // Get total count for pagination (simpler approach)
    const { data: allContacts, error: countError } = await supabaseAdmin
      .from('contacts')
      .select('id')
    
    const totalCount = allContacts?.length || 0
    console.log('🔢 Count query results:', { totalCount, countError, allContactsLength: allContacts?.length })

    // Get paginated results
    const offset = (page - 1) * perPage
    const { data: contacts, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + perPage - 1)

    if (error) {
      console.error('❌ Error fetching partners:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch partners' },
        { status: 500 }
      )
    }

    // Transform contacts data to look like partners for frontend compatibility
    const transformedPartners = (contacts || []).map(contact => {
      // Determine stage based on contact data and notes
      let stage = 'lead' // Default to lead
      
      if (contact.notes) {
        const notes = contact.notes.toLowerCase()
        if (notes.includes('responded') || notes.includes('thank you') || contact.email) {
          stage = 'qualified'
        }
        if (notes.includes('full patient panel')) {
          stage = 'live'
        }
      } else if (contact.email && contact.phone) {
        stage = 'qualified' // Has both email and phone
      } else if (contact.email || contact.phone) {
        stage = 'lead' // Has some contact info
      }

      return {
        id: contact.id,
        name: `${contact.first_name} ${contact.last_name}`.trim(),
        contact_email: contact.email,
        contact_phone: contact.phone,
        contact_person: `${contact.first_name} ${contact.last_name}`.trim(),
        title: contact.title,
        stage,
        status: contact.is_primary ? 'active' : 'prospect',
        source: null,
        specialties: [contact.title].filter(Boolean), // Use title as specialty
        insurance_types: [],
        monthly_referral_capacity: null,
        notes: contact.notes,
        website: null,
        linkedin_url: null,
        first_contact_date: contact.created_at?.split('T')[0],
        last_contact_date: contact.updated_at?.split('T')[0],
        contract_signed_date: null,
        go_live_date: null,
        created_by: 'system',
        assigned_to: 'admin',
        created_at: contact.created_at,
        updated_at: contact.updated_at,
        organization_name: null, // Could join with organizations table if needed
        organization_type: null,
        organization_status: null,
        location: null,
        // Add contacts specific fields
        partner_id: contact.partner_id,
        organization_id: contact.organization_id,
        is_primary: contact.is_primary
      }
    })

    console.log(`✅ Found ${contacts?.length || 0} contacts (${totalCount} total)`)

    return NextResponse.json({
      success: true,
      data: transformedPartners,
      pagination: {
        page,
        per_page: perPage,
        total: totalCount,
        total_pages: Math.ceil(totalCount / perPage)
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

    // For now, return a message that partner creation requires a separate partners table
    // This is a placeholder until the proper partners table is created
    return NextResponse.json(
      { 
        success: false, 
        error: 'Partner creation not available - partners table needs to be created in database',
        message: 'Currently showing organizations as partners. To create actual partners, a partners table is required.'
      },
      { status: 501 }
    )

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