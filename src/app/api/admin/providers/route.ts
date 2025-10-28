// Admin API endpoint for provider management (CRUD operations)
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { validateProviderData, sanitizeProviderData } from '@/lib/services/providerValidation'
import { checkProfileCompletion } from '@/lib/utils/profileCompletion'
import { Database } from '@/types/database'

type ProviderInsert = Database['public']['Tables']['providers']['Insert']

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Query parameters
    const search = searchParams.get('search')
    const status = searchParams.get('status') // 'active', 'inactive', 'all'
    const bookable = searchParams.get('bookable') // 'true', 'false', 'all'
    const listed = searchParams.get('listed') // 'true', 'false', 'all'
    const role = searchParams.get('role')
    const sortBy = searchParams.get('sortBy') || 'last_name'
    const sortOrder = searchParams.get('sortOrder') || 'asc'
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    console.log('🔍 Admin fetching providers with filters:', { search, status, bookable, listed, role, sortBy, sortOrder })

    // Build query
    let query = supabaseAdmin
      .from('providers')
      .select('id, first_name, last_name, email, phone_number, auth_user_id, is_active, is_bookable, list_on_provider_page, accepts_new_patients, role, title, provider_type, npi, profile_image_url, created_date, profile_completed, telehealth_enabled, languages_spoken, med_school_org, med_school_grad_year, residency_org', { count: 'exact' })

    // Apply filters
    if (status === 'active') {
      query = query.eq('is_active', true)
    } else if (status === 'inactive') {
      query = query.eq('is_active', false)
    }
    // 'all' or undefined = no filter

    if (bookable === 'true') {
      query = query.eq('is_bookable', true)
    } else if (bookable === 'false') {
      query = query.eq('is_bookable', false)
    }

    if (listed === 'true') {
      query = query.eq('list_on_provider_page', true)
    } else if (listed === 'false') {
      query = query.eq('list_on_provider_page', false)
    }

    if (role && role !== 'all') {
      query = query.eq('role', role)
    }

    // Search by name, email, or NPI
    if (search && search.trim() !== '') {
      const searchTerm = search.trim()
      query = query.or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,npi.ilike.%${searchTerm}%`)
    }

    // Sort
    query = query.order(sortBy, { ascending: sortOrder === 'asc' })

    // Pagination
    query = query.range(offset, offset + limit - 1)

    const { data: providers, error, count } = await query

    if (error) {
      console.error('❌ Error fetching providers:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch providers', details: error },
        { status: 500 }
      )
    }

    console.log(`✅ Found ${count || 0} total providers, returning ${providers?.length || 0}`)

    // Fetch auth user metadata for providers with auth accounts
    let providersWithAuthData = providers || []

    if (providers && providers.length > 0) {
      const providerAuthIds = providers
        .filter(p => p.auth_user_id)
        .map(p => p.auth_user_id)

      if (providerAuthIds.length > 0) {
        try {
          // Fetch all auth users
          const { data: authData } = await supabaseAdmin.auth.admin.listUsers()
          const authUsers = authData?.users || []

          // Create a map of auth_user_id -> auth user metadata
          const authUserMap = new Map(
            authUsers.map(user => [user.id, {
              email_confirmed: user.email_confirmed_at !== null,
              last_sign_in_at: user.last_sign_in_at,
              created_at: user.created_at,
              user_metadata: user.user_metadata
            }])
          )

          // Add auth metadata to each provider
          providersWithAuthData = providers.map(provider => ({
            ...provider,
            auth_metadata: provider.auth_user_id ? authUserMap.get(provider.auth_user_id) : null
          }))
        } catch (authError) {
          console.error('⚠️ Error fetching auth metadata (continuing without it):', authError)
          // Continue without auth metadata rather than failing the whole request
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: providersWithAuthData,
      total: count || 0,
      pagination: {
        limit,
        offset,
        hasMore: (count || 0) > offset + limit
      }
    })

  } catch (error: any) {
    console.error('❌ Error in admin providers GET:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch providers',
        details: error.message
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    console.log('➕ Creating new provider:', body.email)

    // Validate provider data
    const validation = await validateProviderData(body, false)
    if (!validation.valid) {
      console.error('❌ Validation failed:', validation.errors)
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          validationErrors: validation.errors
        },
        { status: 400 }
      )
    }

    // Sanitize data
    const sanitized = sanitizeProviderData(body) as ProviderInsert

    // Set default values for new providers
    const providerData: ProviderInsert = {
      ...sanitized,
      is_active: sanitized.is_active !== undefined ? sanitized.is_active : true,
      is_bookable: sanitized.is_bookable !== undefined ? sanitized.is_bookable : false,
      list_on_provider_page: sanitized.list_on_provider_page !== undefined ? sanitized.list_on_provider_page : false,
      accepts_new_patients: sanitized.accepts_new_patients !== undefined ? sanitized.accepts_new_patients : true,
      telehealth_enabled: sanitized.telehealth_enabled !== undefined ? sanitized.telehealth_enabled : true,
      profile_completed: false,
      created_date: new Date().toISOString()
    }

    // Insert into database
    const { data: provider, error } = await supabaseAdmin
      .from('providers')
      .insert(providerData)
      .select()
      .single()

    if (error) {
      console.error('❌ Error creating provider:', error)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to create provider',
          details: error.message
        },
        { status: 500 }
      )
    }

    // Auto-check profile completion status after creation
    try {
      const completionCheck = checkProfileCompletion(provider)
      if (completionCheck.isComplete) {
        await supabaseAdmin
          .from('providers')
          .update({ profile_completed: true })
          .eq('id', provider.id)

        provider.profile_completed = true
        console.log(`🔄 Auto-marked profile as complete for ${provider.email}`)
      }
    } catch (autoCompleteError) {
      // Don't fail the creation if auto-completion check fails
      console.error('⚠️ Auto-completion check failed (continuing):', autoCompleteError)
    }

    console.log(`✅ Provider created successfully: ${provider.id}`)

    return NextResponse.json({
      success: true,
      data: provider,
      message: 'Provider created successfully'
    }, { status: 201 })

  } catch (error: any) {
    console.error('❌ Error in admin providers POST:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create provider',
        details: error.message
      },
      { status: 500 }
    )
  }
}
