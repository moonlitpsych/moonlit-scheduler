// Organization Patient Affiliations API - Create/update end_date/ROI
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET - List patient affiliations for organization
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Get partner user ID from headers
    const partnerUserId = request.headers.get('x-partner-user-id')
    
    if (!partnerUserId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Partner user authentication required' 
        },
        { status: 401 }
      )
    }

    // Get partner user's organization
    const { data: partnerUser, error: userError } = await supabaseAdmin
      .from('partner_users')
      .select('organization_id, role, first_name, last_name')
      .eq('id', partnerUserId)
      .eq('status', 'active')
      .single()

    if (userError || !partnerUser?.organization_id) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Partner user or organization not found' 
        },
        { status: 404 }
      )
    }

    // Parse query parameters
    const page = parseInt(searchParams.get('page') || '1')
    const perPage = Math.min(parseInt(searchParams.get('per_page') || '20'), 100)
    const offset = (page - 1) * perPage
    const status = searchParams.get('status') || 'active' // active, inactive, all
    const search = searchParams.get('search') // Patient name search
    const needsRoi = searchParams.get('needs_roi') // true/false - filter patients needing ROI updates

    console.log('🔗 Fetching patient affiliations:', { 
      organizationId: partnerUser.organization_id,
      page, 
      perPage,
      status,
      search,
      needsRoi
    })

    // Build affiliations query
    let query = supabaseAdmin
      .from('patient_organization_affiliations')
      .select(`
        id,
        patient_id,
        organization_id,
        status,
        start_date,
        end_date,
        roi_contacts,
        notes,
        created_at,
        updated_at,
        created_by,
        patients(
          id,
          first_name,
          last_name,
          email,
          phone,
          date_of_birth,
          primary_provider_id,
          providers(
            id,
            first_name,
            last_name,
            title
          )
        )
      `, { count: 'exact' })
      .eq('organization_id', partnerUser.organization_id)

    // Apply status filter
    if (status !== 'all') {
      query = query.eq('status', status)
    }

    // Apply ROI filter
    if (needsRoi === 'true') {
      query = query.or('roi_contacts.is.null,roi_contacts.eq.{}')
    } else if (needsRoi === 'false') {
      query = query.not('roi_contacts', 'is', null).not('roi_contacts', 'eq', {})
    }

    // Apply search filter
    if (search) {
      query = query.or(`
        patients.first_name.ilike.%${search}%,
        patients.last_name.ilike.%${search}%,
        patients.email.ilike.%${search}%
      `)
    }

    // Apply pagination and ordering
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + perPage - 1)

    const { data: affiliations, error, count } = await query

    if (error) {
      console.error('❌ Error fetching affiliations:', error)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to fetch patient affiliations',
          details: error.message
        },
        { status: 500 }
      )
    }

    // Process affiliations for display
    const processedAffiliations = (affiliations || []).map(affiliation => ({
      id: affiliation.id,
      patient: {
        id: affiliation.patients.id,
        name: `${affiliation.patients.first_name} ${affiliation.patients.last_name}`,
        first_name: affiliation.patients.first_name,
        last_name: affiliation.patients.last_name,
        email: affiliation.patients.email,
        phone: affiliation.patients.phone,
        date_of_birth: affiliation.patients.date_of_birth,
        primary_provider: affiliation.patients.providers ? {
          id: affiliation.patients.providers.id,
          name: `Dr. ${affiliation.patients.providers.first_name} ${affiliation.patients.providers.last_name}`,
          title: affiliation.patients.providers.title
        } : null
      },
      affiliation_details: {
        status: affiliation.status,
        start_date: affiliation.start_date,
        end_date: affiliation.end_date,
        is_active: affiliation.status === 'active' && (!affiliation.end_date || new Date(affiliation.end_date) > new Date()),
        days_affiliated: affiliation.start_date ? 
          Math.floor((new Date().getTime() - new Date(affiliation.start_date).getTime()) / (1000 * 60 * 60 * 24)) : 
          null
      },
      roi_info: {
        has_roi_contacts: affiliation.roi_contacts && Object.keys(affiliation.roi_contacts).length > 0,
        roi_contacts: affiliation.roi_contacts || {},
        needs_roi_update: !affiliation.roi_contacts || Object.keys(affiliation.roi_contacts).length === 0
      },
      notes: affiliation.notes,
      created_at: affiliation.created_at,
      updated_at: affiliation.updated_at,
      can_update: canUpdateAffiliation(partnerUser.role),
      can_end: canEndAffiliation(partnerUser.role) && affiliation.status === 'active'
    }))

    const totalPages = Math.ceil((count || 0) / perPage)

    // Log access for audit
    await supabaseAdmin
      .from('scheduler_audit_logs')
      .insert({
        action: 'org_affiliations_viewed',
        resource_type: 'patient_affiliations',
        resource_id: partnerUser.organization_id,
        details: {
          accessed_by: {
            partner_user_id: partnerUserId,
            name: `${partnerUser.first_name} ${partnerUser.last_name}`,
            role: partnerUser.role
          },
          filters: { status, search, needsRoi },
          page,
          per_page: perPage,
          total_results: count
        }
      })

    console.log('✅ Affiliations fetched:', {
      total: count,
      returned: processedAffiliations.length,
      organization_id: partnerUser.organization_id
    })

    return NextResponse.json({
      success: true,
      data: {
        affiliations: processedAffiliations,
        pagination: {
          page,
          per_page: perPage,
          total: count || 0,
          total_pages: totalPages,
          has_next: page < totalPages,
          has_prev: page > 1
        },
        filters: {
          applied: { status, search, needsRoi },
          available_statuses: ['active', 'inactive', 'all']
        },
        summary: {
          total_affiliations: count || 0,
          needing_roi_update: processedAffiliations.filter(a => a.roi_info.needs_roi_update).length,
          active_affiliations: processedAffiliations.filter(a => a.affiliation_details.is_active).length
        }
      }
    })

  } catch (error: any) {
    console.error('❌ Affiliations fetch error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch patient affiliations',
        details: error.message
      },
      { status: 500 }
    )
  }
}

// POST - Create new patient affiliation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { patient_id, roi_contacts, notes, start_date } = body
    
    // Get partner user ID from headers
    const partnerUserId = request.headers.get('x-partner-user-id')
    
    if (!partnerUserId || !patient_id) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Partner user authentication and patient ID required' 
        },
        { status: 400 }
      )
    }

    // Get partner user's organization
    const { data: partnerUser, error: userError } = await supabaseAdmin
      .from('partner_users')
      .select('organization_id, role, first_name, last_name, email')
      .eq('id', partnerUserId)
      .eq('status', 'active')
      .single()

    if (userError || !partnerUser?.organization_id) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Partner user or organization not found' 
        },
        { status: 404 }
      )
    }

    // Check permissions
    if (!canCreateAffiliation(partnerUser.role)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Insufficient permissions to create patient affiliations' 
        },
        { status: 403 }
      )
    }

    // Verify patient exists
    const { data: patient, error: patientError } = await supabaseAdmin
      .from('patients')
      .select('id, first_name, last_name, email')
      .eq('id', patient_id)
      .single()

    if (patientError || !patient) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Patient not found' 
        },
        { status: 404 }
      )
    }

    // Check if affiliation already exists
    const { data: existingAffiliation } = await supabaseAdmin
      .from('patient_organization_affiliations')
      .select('id, status')
      .eq('patient_id', patient_id)
      .eq('organization_id', partnerUser.organization_id)
      .single()

    if (existingAffiliation) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Patient is already affiliated with this organization',
          details: `Existing affiliation status: ${existingAffiliation.status}`
        },
        { status: 409 }
      )
    }

    // Create new affiliation
    const affiliationData = {
      patient_id,
      organization_id: partnerUser.organization_id,
      status: 'active',
      start_date: start_date || new Date().toISOString().split('T')[0],
      roi_contacts: roi_contacts || {},
      notes: notes || null,
      created_by: partnerUserId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { data: newAffiliation, error: createError } = await supabaseAdmin
      .from('patient_organization_affiliations')
      .insert(affiliationData)
      .select(`
        *,
        patients(
          id,
          first_name,
          last_name,
          email,
          phone
        )
      `)
      .single()

    if (createError) {
      console.error('❌ Affiliation creation failed:', createError)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to create patient affiliation',
          details: createError.message
        },
        { status: 500 }
      )
    }

    // Create audit log
    await supabaseAdmin
      .from('scheduler_audit_logs')
      .insert({
        action: 'patient_affiliation_created',
        resource_type: 'patient_affiliation',
        resource_id: newAffiliation.id,
        details: {
          created_by: {
            partner_user_id: partnerUserId,
            name: `${partnerUser.first_name} ${partnerUser.last_name}`,
            email: partnerUser.email,
            role: partnerUser.role
          },
          patient: {
            id: patient_id,
            name: `${patient.first_name} ${patient.last_name}`,
            email: patient.email
          },
          organization_id: partnerUser.organization_id,
          roi_contacts_provided: roi_contacts && Object.keys(roi_contacts).length > 0,
          start_date: affiliationData.start_date
        }
      })

    console.log('✅ Patient affiliation created:', {
      affiliation_id: newAffiliation.id,
      patient_id,
      organization_id: partnerUser.organization_id,
      created_by: partnerUser.email
    })

    return NextResponse.json({
      success: true,
      data: {
        affiliation: newAffiliation
      },
      message: 'Patient affiliation created successfully'
    })

  } catch (error: any) {
    console.error('❌ Affiliation creation error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to create patient affiliation',
        details: error.message
      },
      { status: 500 }
    )
  }
}

// PUT - Update affiliation (end date, ROI contacts, notes)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { affiliation_id, roi_contacts, notes, end_date, status } = body
    
    // Get partner user ID from headers
    const partnerUserId = request.headers.get('x-partner-user-id')
    
    if (!partnerUserId || !affiliation_id) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Partner user authentication and affiliation ID required' 
        },
        { status: 400 }
      )
    }

    // Get partner user's organization
    const { data: partnerUser, error: userError } = await supabaseAdmin
      .from('partner_users')
      .select('organization_id, role, first_name, last_name, email')
      .eq('id', partnerUserId)
      .eq('status', 'active')
      .single()

    if (userError || !partnerUser?.organization_id) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Partner user or organization not found' 
        },
        { status: 404 }
      )
    }

    // Get existing affiliation and verify organization access
    const { data: currentAffiliation, error: affiliationError } = await supabaseAdmin
      .from('patient_organization_affiliations')
      .select(`
        *,
        patients(
          id,
          first_name,
          last_name,
          email
        )
      `)
      .eq('id', affiliation_id)
      .eq('organization_id', partnerUser.organization_id)
      .single()

    if (affiliationError || !currentAffiliation) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Patient affiliation not found or access denied' 
        },
        { status: 404 }
      )
    }

    // Check permissions
    if (!canUpdateAffiliation(partnerUser.role)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Insufficient permissions to update patient affiliations' 
        },
        { status: 403 }
      )
    }

    // Build update object
    const updates: any = { updated_at: new Date().toISOString() }
    const changeLog: any = {}

    if (roi_contacts !== undefined) {
      updates.roi_contacts = roi_contacts
      changeLog.roi_contacts = {
        from: currentAffiliation.roi_contacts,
        to: roi_contacts
      }
    }

    if (notes !== undefined) {
      updates.notes = notes
      changeLog.notes = {
        from: currentAffiliation.notes,
        to: notes
      }
    }

    if (end_date !== undefined) {
      updates.end_date = end_date
      changeLog.end_date = {
        from: currentAffiliation.end_date,
        to: end_date
      }
      
      // If setting end_date, automatically set status to inactive
      if (end_date) {
        updates.status = 'inactive'
        changeLog.status = {
          from: currentAffiliation.status,
          to: 'inactive'
        }
      }
    }

    if (status !== undefined && canEndAffiliation(partnerUser.role)) {
      updates.status = status
      changeLog.status = {
        from: currentAffiliation.status,
        to: status
      }
    }

    if (Object.keys(updates).length === 1) { // Only updated_at
      return NextResponse.json(
        { 
          success: false, 
          error: 'No valid updates provided' 
        },
        { status: 400 }
      )
    }

    // Update affiliation
    const { data: updatedAffiliation, error: updateError } = await supabaseAdmin
      .from('patient_organization_affiliations')
      .update(updates)
      .eq('id', affiliation_id)
      .select(`
        *,
        patients(
          id,
          first_name,
          last_name,
          email
        )
      `)
      .single()

    if (updateError) {
      console.error('❌ Affiliation update failed:', updateError)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to update patient affiliation',
          details: updateError.message
        },
        { status: 500 }
      )
    }

    // Create audit log
    await supabaseAdmin
      .from('scheduler_audit_logs')
      .insert({
        action: 'patient_affiliation_updated',
        resource_type: 'patient_affiliation',
        resource_id: affiliation_id,
        details: {
          updated_by: {
            partner_user_id: partnerUserId,
            name: `${partnerUser.first_name} ${partnerUser.last_name}`,
            email: partnerUser.email,
            role: partnerUser.role
          },
          patient: {
            id: currentAffiliation.patients.id,
            name: `${currentAffiliation.patients.first_name} ${currentAffiliation.patients.last_name}`,
            email: currentAffiliation.patients.email
          },
          changes: changeLog,
          fields_updated: Object.keys(changeLog)
        }
      })

    console.log('✅ Patient affiliation updated:', {
      affiliation_id,
      updated_fields: Object.keys(changeLog),
      updated_by: partnerUser.email
    })

    return NextResponse.json({
      success: true,
      data: {
        affiliation: updatedAffiliation,
        changes_made: changeLog
      },
      message: 'Patient affiliation updated successfully'
    })

  } catch (error: any) {
    console.error('❌ Affiliation update error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to update patient affiliation',
        details: error.message
      },
      { status: 500 }
    )
  }
}

// Helper functions
function canCreateAffiliation(role: string): boolean {
  return ['partner_admin'].includes(role)
}

function canUpdateAffiliation(role: string): boolean {
  return ['partner_admin', 'partner_case_manager'].includes(role)
}

function canEndAffiliation(role: string): boolean {
  return ['partner_admin'].includes(role)
}