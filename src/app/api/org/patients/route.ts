// Organization Patients API - Read + limited update of demographics/insurance
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET - Fetch patients affiliated with organization
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
    const search = searchParams.get('search') // Name or MRN search
    const status = searchParams.get('status') // active, inactive
    const providerId = searchParams.get('provider_id') // Filter by primary provider
    const sortBy = searchParams.get('sort_by') || 'last_name' // last_name, first_name, created_at
    const sortOrder = searchParams.get('sort_order') || 'asc' // asc, desc

    console.log('👥 Fetching organization patients:', { 
      organizationId: partnerUser.organization_id,
      page, 
      perPage,
      search,
      status,
      providerId,
      sortBy,
      sortOrder
    })

    // Build patients query with affiliations
    let query = supabaseAdmin
      .from('patients')
      .select(`
        id,
        first_name,
        last_name,
        email,
        phone,
        date_of_birth,
        gender,
        mrn,
        insurance_primary,
        insurance_secondary,
        address,
        primary_provider_id,
        status,
        created_at,
        updated_at,
        patient_affiliations!inner(
          id,
          organization_id,
          status,
          start_date,
          end_date,
          roi_contacts,
          notes,
          created_at as affiliation_created_at
        ),
        providers(
          id,
          first_name,
          last_name,
          title
        )
      `, { count: 'exact' })
      .eq('patient_affiliations.organization_id', partnerUser.organization_id)

    // Apply filters
    if (status) {
      if (status === 'active') {
        query = query
          .eq('patient_affiliations.status', 'active')
          .eq('status', 'active')
      } else if (status === 'inactive') {
        query = query.or('patient_affiliations.status.eq.inactive,status.eq.inactive')
      }
    } else {
      // Default to active affiliations only
      query = query.eq('patient_affiliations.status', 'active')
    }

    if (providerId) {
      query = query.eq('primary_provider_id', providerId)
    }

    // Apply search filter
    if (search) {
      query = query.or(`
        first_name.ilike.%${search}%,
        last_name.ilike.%${search}%,
        email.ilike.%${search}%,
        mrn.ilike.%${search}%
      `)
    }

    // Apply sorting
    const validSortFields = ['last_name', 'first_name', 'created_at', 'date_of_birth']
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'last_name'
    const ascending = sortOrder === 'asc'
    
    query = query.order(sortField, { ascending })

    // Apply pagination
    query = query.range(offset, offset + perPage - 1)

    const { data: patients, error, count } = await query

    if (error) {
      console.error('❌ Error fetching patients:', error)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to fetch patients',
          details: error.message
        },
        { status: 500 }
      )
    }

    // Process patients for display
    const processedPatients = (patients || []).map(patient => {
      const affiliation = patient.patient_affiliations[0] // Should only be one due to filter
      
      return {
        id: patient.id,
        personal_info: {
          first_name: patient.first_name,
          last_name: patient.last_name,
          full_name: `${patient.first_name} ${patient.last_name}`,
          initials: `${patient.first_name?.charAt(0) || ''}${patient.last_name?.charAt(0) || ''}`.toUpperCase(),
          email: patient.email,
          phone: patient.phone,
          date_of_birth: patient.date_of_birth,
          age: patient.date_of_birth ? calculateAge(patient.date_of_birth) : null,
          gender: patient.gender,
          mrn: patient.mrn
        },
        insurance: {
          primary: patient.insurance_primary,
          secondary: patient.insurance_secondary
        },
        address: patient.address,
        primary_provider: patient.providers ? {
          id: patient.providers.id,
          name: `Dr. ${patient.providers.first_name} ${patient.providers.last_name}`,
          title: patient.providers.title
        } : null,
        affiliation: {
          id: affiliation.id,
          status: affiliation.status,
          start_date: affiliation.start_date,
          end_date: affiliation.end_date,
          roi_contacts: affiliation.roi_contacts,
          notes: affiliation.notes,
          affiliated_since: affiliation.affiliation_created_at
        },
        status: patient.status,
        can_update_demographics: canUpdateDemographics(partnerUser.role),
        can_update_insurance: canUpdateInsurance(partnerUser.role),
        created_at: patient.created_at,
        updated_at: patient.updated_at
      }
    })

    const totalPages = Math.ceil((count || 0) / perPage)

    // Log access for audit
    await supabaseAdmin
      .from('scheduler_audit_logs')
      .insert({
        action: 'org_patients_viewed',
        resource_type: 'patients',
        resource_id: partnerUser.organization_id,
        details: {
          accessed_by: {
            partner_user_id: partnerUserId,
            name: `${partnerUser.first_name} ${partnerUser.last_name}`,
            role: partnerUser.role
          },
          filters: { search, status, providerId, sortBy, sortOrder },
          page,
          per_page: perPage,
          total_results: count
        }
      })

    console.log('✅ Patients fetched:', {
      total: count,
      returned: processedPatients.length,
      organization_id: partnerUser.organization_id
    })

    return NextResponse.json({
      success: true,
      data: {
        patients: processedPatients,
        pagination: {
          page,
          per_page: perPage,
          total: count || 0,
          total_pages: totalPages,
          has_next: page < totalPages,
          has_prev: page > 1
        },
        filters: {
          applied: { search, status, providerId, sortBy, sortOrder },
          available_providers: await getAvailableProviders(partnerUser.organization_id),
          available_statuses: ['active', 'inactive']
        },
        permissions: {
          can_update_demographics: canUpdateDemographics(partnerUser.role),
          can_update_insurance: canUpdateInsurance(partnerUser.role),
          can_manage_affiliations: canManageAffiliations(partnerUser.role)
        }
      }
    })

  } catch (error: any) {
    console.error('❌ Organization patients fetch error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch organization patients',
        details: error.message
      },
      { status: 500 }
    )
  }
}

// PUT - Update patient demographics/insurance (limited)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { patient_id, updates } = body
    
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

    // Get partner user's organization and role
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

    // Verify patient is affiliated with organization
    const { data: affiliation, error: affiliationError } = await supabaseAdmin
      .from('patient_organization_affiliations')
      .select('id, status')
      .eq('patient_id', patient_id)
      .eq('organization_id', partnerUser.organization_id)
      .eq('status', 'active')
      .single()

    if (affiliationError || !affiliation) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Patient not affiliated with your organization or affiliation inactive' 
        },
        { status: 403 }
      )
    }

    // Get current patient data
    const { data: currentPatient, error: patientError } = await supabaseAdmin
      .from('patients')
      .select('*')
      .eq('id', patient_id)
      .single()

    if (patientError || !currentPatient) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Patient not found' 
        },
        { status: 404 }
      )
    }

    // Validate and filter allowed updates based on role
    const allowedUpdates: any = {}
    const changeLog: any = {}

    if (canUpdateDemographics(partnerUser.role)) {
      const allowedDemographicFields = ['phone', 'address', 'email']
      
      for (const field of allowedDemographicFields) {
        if (updates[field] !== undefined && updates[field] !== currentPatient[field]) {
          allowedUpdates[field] = updates[field]
          changeLog[field] = {
            from: currentPatient[field],
            to: updates[field]
          }
        }
      }
    }

    if (canUpdateInsurance(partnerUser.role)) {
      if (updates.insurance_primary && JSON.stringify(updates.insurance_primary) !== JSON.stringify(currentPatient.insurance_primary)) {
        allowedUpdates.insurance_primary = updates.insurance_primary
        changeLog.insurance_primary = {
          from: currentPatient.insurance_primary,
          to: updates.insurance_primary
        }
      }
      
      if (updates.insurance_secondary && JSON.stringify(updates.insurance_secondary) !== JSON.stringify(currentPatient.insurance_secondary)) {
        allowedUpdates.insurance_secondary = updates.insurance_secondary
        changeLog.insurance_secondary = {
          from: currentPatient.insurance_secondary,
          to: updates.insurance_secondary
        }
      }
    }

    if (Object.keys(allowedUpdates).length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'No valid updates provided or no changes detected' 
        },
        { status: 400 }
      )
    }

    // Update patient record
    allowedUpdates.updated_at = new Date().toISOString()
    
    const { data: updatedPatient, error: updateError } = await supabaseAdmin
      .from('patients')
      .update(allowedUpdates)
      .eq('id', patient_id)
      .select()
      .single()

    if (updateError) {
      console.error('❌ Patient update failed:', updateError)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to update patient',
          details: updateError.message
        },
        { status: 500 }
      )
    }

    // Create audit log
    await supabaseAdmin
      .from('scheduler_audit_logs')
      .insert({
        action: 'patient_updated',
        resource_type: 'patient',
        resource_id: patient_id,
        details: {
          updated_by: {
            partner_user_id: partnerUserId,
            name: `${partnerUser.first_name} ${partnerUser.last_name}`,
            email: partnerUser.email,
            role: partnerUser.role,
            organization_id: partnerUser.organization_id
          },
          patient_name: `${currentPatient.first_name} ${currentPatient.last_name}`,
          changes: changeLog,
          fields_updated: Object.keys(changeLog)
        }
      })

    console.log('✅ Patient updated:', {
      patient_id,
      updated_fields: Object.keys(changeLog),
      updated_by: partnerUser.email
    })

    return NextResponse.json({
      success: true,
      data: {
        patient: updatedPatient,
        changes_made: changeLog
      },
      message: 'Patient information updated successfully'
    })

  } catch (error: any) {
    console.error('❌ Patient update error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to update patient',
        details: error.message
      },
      { status: 500 }
    )
  }
}

// Helper functions
function calculateAge(dateOfBirth: string): number {
  const today = new Date()
  const birthDate = new Date(dateOfBirth)
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }
  
  return age
}

function canUpdateDemographics(role: string): boolean {
  return ['partner_admin', 'partner_case_manager'].includes(role)
}

function canUpdateInsurance(role: string): boolean {
  return ['partner_admin', 'partner_case_manager'].includes(role)
}

function canManageAffiliations(role: string): boolean {
  return role === 'partner_admin'
}

async function getAvailableProviders(organizationId: string) {
  try {
    const { data: providers } = await supabaseAdmin
      .from('providers')
      .select('id, first_name, last_name, title')
      .in('id', 
        supabaseAdmin
          .from('patients')
          .select('primary_provider_id')
          .in('id',
            supabaseAdmin
              .from('patient_organization_affiliations')
              .select('patient_id')
              .eq('organization_id', organizationId)
              .eq('status', 'active')
          )
      )
      .limit(20)

    return (providers || []).map(p => ({
      id: p.id,
      name: `Dr. ${p.first_name} ${p.last_name}`,
      title: p.title
    }))
  } catch (error) {
    console.warn('Could not fetch available providers:', error)
    return []
  }
}