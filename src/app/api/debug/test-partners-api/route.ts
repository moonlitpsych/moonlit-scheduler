// Debug API to test the updated partners API directly
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Testing partners API logic directly...')

    // Get query parameters for filtering/pagination
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const perPage = parseInt(searchParams.get('per_page') || '5')
    const search = searchParams.get('search') || ''

    console.log('🔍 Admin fetching partners:', { page, perPage, search })

    // Query partner_contacts table for individual partner contacts (172 records)
    let query = supabaseAdmin
      .from('partner_contacts')
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

    // Apply filters (adapted for partner_contacts table)
    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,title.ilike.%${search}%`)
    }

    // Get total count for pagination (simpler approach)  
    const { data: allContacts, error: countError } = await supabaseAdmin
      .from('partner_contacts')
      .select('id')
    
    const totalCount = allContacts?.length || 0
    console.log('🔢 Debug Count query results:', { totalCount, countError, allContactsLength: allContacts?.length })

    // Get paginated results
    const offset = (page - 1) * perPage
    const { data: partnerContacts, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + perPage - 1)

    if (error) {
      console.error('❌ Error fetching partners:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch partners', details: error },
        { status: 500 }
      )
    }

    // Transform partner_contacts data to look like partners for frontend compatibility
    const transformedPartners = (partnerContacts || []).map(contact => ({
      id: contact.id,
      name: `${contact.first_name} ${contact.last_name}`.trim(),
      contact_email: contact.email,
      contact_phone: contact.phone,
      contact_person: `${contact.first_name} ${contact.last_name}`.trim(),
      title: contact.title,
      stage: 'active', // Default stage
      status: contact.is_primary ? 'primary' : 'contact',
      notes: contact.notes,
      first_contact_date: contact.created_at?.split('T')[0],
      last_contact_date: contact.updated_at?.split('T')[0],
      created_at: contact.created_at,
      updated_at: contact.updated_at,
      // Add partner_contacts specific fields
      partner_id: contact.partner_id,
      organization_id: contact.organization_id,
      is_primary: contact.is_primary
    }))

    console.log(`✅ Found ${partnerContacts?.length || 0} partner contacts (${totalCount} total)`)

    return NextResponse.json({
      success: true,
      message: 'Partners API test - bypassing admin auth',
      data: transformedPartners,
      pagination: {
        page,
        per_page: perPage,
        total: totalCount,
        total_pages: Math.ceil(totalCount / perPage)
      },
      debug: {
        query_table: 'partner_contacts',
        total_contacts: totalCount,
        sample_names: partnerContacts?.slice(0, 3).map(c => `${c.first_name} ${c.last_name}`)
      }
    })

  } catch (error: any) {
    console.error('❌ Debug partners API test error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to test partners API',
        details: error.message
      },
      { status: 500 }
    )
  }
}