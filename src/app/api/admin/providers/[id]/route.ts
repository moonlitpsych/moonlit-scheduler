// Admin API for individual provider operations (GET, UPDATE, DELETE)
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { validateProviderData, sanitizeProviderData, validateStatusTransition } from '@/lib/services/providerValidation'
import { checkProfileCompletion } from '@/lib/utils/profileCompletion'
import { Database } from '@/types/database'

type ProviderUpdate = Database['public']['Tables']['providers']['Update']

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: providerId } = await params

    console.log(`🔍 Fetching provider: ${providerId}`)

    // Fetch provider with all fields
    const { data: provider, error } = await supabaseAdmin
      .from('providers')
      .select('*')
      .eq('id', providerId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Provider not found' },
          { status: 404 }
        )
      }
      console.error('❌ Error fetching provider:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch provider', details: error },
        { status: 500 }
      )
    }

    // Fetch related data
    const [appointmentCount, licenseCount, contractCount] = await Promise.all([
      // Count appointments
      supabaseAdmin
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('provider_id', providerId),

      // Count licenses
      supabaseAdmin
        .from('provider_licenses')
        .select('id', { count: 'exact', head: true })
        .eq('provider_id', providerId),

      // Count contracts
      supabaseAdmin
        .from('provider_payer_networks')
        .select('id', { count: 'exact', head: true })
        .eq('provider_id', providerId)
    ])

    // Fetch auth user metadata if provider has auth account
    let authMetadata = null
    if (provider.auth_user_id) {
      try {
        const { data: authData } = await supabaseAdmin.auth.admin.listUsers()
        const authUser = authData?.users?.find(u => u.id === provider.auth_user_id)

        if (authUser) {
          authMetadata = {
            email_confirmed: authUser.email_confirmed_at !== null,
            last_sign_in_at: authUser.last_sign_in_at,
            created_at: authUser.created_at,
            user_metadata: authUser.user_metadata
          }
        }
      } catch (authError) {
        console.error('⚠️ Error fetching auth metadata (continuing without it):', authError)
      }
    }

    console.log(`✅ Provider fetched: ${provider.first_name} ${provider.last_name}`)

    return NextResponse.json({
      success: true,
      data: {
        ...provider,
        auth_metadata: authMetadata,
        _stats: {
          appointmentCount: appointmentCount.count || 0,
          licenseCount: licenseCount.count || 0,
          contractCount: contractCount.count || 0
        }
      }
    })

  } catch (error: any) {
    console.error('❌ Error in GET provider:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch provider',
        details: error.message
      },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: providerId } = await params
    const body = await request.json()

    console.log(`✏️ Updating provider: ${providerId}`)

    // Fetch existing provider to check status transitions
    const { data: existingProvider, error: fetchError } = await supabaseAdmin
      .from('providers')
      .select('is_active, is_bookable')
      .eq('id', providerId)
      .single()

    if (fetchError || !existingProvider) {
      return NextResponse.json(
        { success: false, error: 'Provider not found' },
        { status: 404 }
      )
    }

    // Validate provider data
    const validation = await validateProviderData(body, true, providerId)
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

    // Validate status transitions if status fields are being updated
    if (body.is_active !== undefined || body.is_bookable !== undefined) {
      const statusValidation = validateStatusTransition(
        {
          is_active: existingProvider.is_active || false,
          is_bookable: existingProvider.is_bookable || false
        },
        {
          is_active: body.is_active,
          is_bookable: body.is_bookable
        }
      )

      if (!statusValidation.valid) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid status transition',
            validationErrors: statusValidation.errors
          },
          { status: 400 }
        )
      }
    }

    // Sanitize data
    const sanitized = sanitizeProviderData(body) as ProviderUpdate

    // Update modified date
    const updateData = {
      ...sanitized,
      modified_date: new Date().toISOString()
    }

    // Update provider
    const { data: updatedProvider, error: updateError } = await supabaseAdmin
      .from('providers')
      .update(updateData)
      .eq('id', providerId)
      .select()
      .single()

    if (updateError) {
      console.error('❌ Error updating provider:', updateError)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to update provider',
          details: updateError.message
        },
        { status: 500 }
      )
    }

    // Auto-check profile completion status after update
    try {
      const completionCheck = checkProfileCompletion(updatedProvider)
      const shouldBeComplete = completionCheck.isComplete
      const currentStatus = updatedProvider.profile_completed || false

      // Update profile_completed if status changed
      if (currentStatus !== shouldBeComplete) {
        await supabaseAdmin
          .from('providers')
          .update({ profile_completed: shouldBeComplete })
          .eq('id', providerId)

        updatedProvider.profile_completed = shouldBeComplete
        console.log(`🔄 Auto-updated profile_completed to ${shouldBeComplete} for ${updatedProvider.email}`)
      }
    } catch (autoCompleteError) {
      // Don't fail the update if auto-completion check fails
      console.error('⚠️ Auto-completion check failed (continuing):', autoCompleteError)
    }

    console.log(`✅ Provider updated: ${updatedProvider.first_name} ${updatedProvider.last_name}`)

    return NextResponse.json({
      success: true,
      data: updatedProvider,
      message: 'Provider updated successfully'
    })

  } catch (error: any) {
    console.error('❌ Error in PUT provider:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update provider',
        details: error.message
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: providerId } = await params

    console.log(`🗑️ Archiving provider: ${providerId}`)

    // Check if provider has future appointments
    const { data: futureAppointments, error: apptError } = await supabaseAdmin
      .from('appointments')
      .select('id')
      .eq('provider_id', providerId)
      .gte('start_time', new Date().toISOString())
      .limit(1)

    if (apptError) {
      console.error('❌ Error checking appointments:', apptError)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to check provider appointments',
          details: apptError.message
        },
        { status: 500 }
      )
    }

    if (futureAppointments && futureAppointments.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot archive provider with future appointments',
          details: 'Please cancel or reassign future appointments before archiving this provider'
        },
        { status: 400 }
      )
    }

    // Soft delete by setting is_active = false
    const { data: archivedProvider, error: deleteError } = await supabaseAdmin
      .from('providers')
      .update({
        is_active: false,
        is_bookable: false,
        list_on_provider_page: false,
        modified_date: new Date().toISOString()
      })
      .eq('id', providerId)
      .select()
      .single()

    if (deleteError) {
      console.error('❌ Error archiving provider:', deleteError)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to archive provider',
          details: deleteError.message
        },
        { status: 500 }
      )
    }

    console.log(`✅ Provider archived: ${archivedProvider.first_name} ${archivedProvider.last_name}`)

    return NextResponse.json({
      success: true,
      message: 'Provider archived successfully',
      data: archivedProvider
    })

  } catch (error: any) {
    console.error('❌ Error in DELETE provider:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to archive provider',
        details: error.message
      },
      { status: 500 }
    )
  }
}
