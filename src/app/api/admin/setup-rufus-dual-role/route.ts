import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST() {
  try {
    console.log('🚀 Setting up dual role for Dr. Rufus Sweeney...')

    const rufusAuthId = 'ab2e228d-5cb2-47ef-add5-ae7acb9269cc'
    const rufusProviderId = '08fbcd34-cd5f-425c-85bd-1aeeffbe9694'

    // Check if auth user exists
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(rufusAuthId)
    if (authError || !authUser.user) {
      return NextResponse.json({ 
        success: false, 
        error: `Auth user not found: ${authError?.message}` 
      }, { status: 404 })
    }

    console.log(`✅ Found auth user: ${authUser.user.email}`)

    // Check if provider exists
    const { data: provider, error: providerError } = await supabaseAdmin
      .from('providers')
      .select('*')
      .eq('id', rufusProviderId)
      .single()

    if (providerError || !provider) {
      return NextResponse.json({ 
        success: false, 
        error: `Provider not found: ${providerError?.message}` 
      }, { status: 404 })
    }

    console.log(`✅ Found provider: ${provider.first_name} ${provider.last_name}`)

    // Check if provider is linked to auth user
    if (provider.auth_user_id !== rufusAuthId) {
      console.log('🔗 Linking provider to auth user...')
      
      const { error: linkError } = await supabaseAdmin
        .from('providers')
        .update({ auth_user_id: rufusAuthId })
        .eq('id', rufusProviderId)

      if (linkError) {
        return NextResponse.json({ 
          success: false, 
          error: `Failed to link provider: ${linkError.message}` 
        }, { status: 500 })
      }

      console.log('✅ Provider linked to auth user')
    } else {
      console.log('✅ Provider already linked to auth user')
    }

    // Update auth user metadata to include admin role
    const currentMetadata = authUser.user.user_metadata || {}
    
    if (!currentMetadata.roles || !currentMetadata.roles.includes('admin')) {
      const updatedMetadata = {
        ...currentMetadata,
        roles: ['admin', 'provider'], // Both roles
        first_name: provider.first_name,
        last_name: provider.last_name
      }

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        rufusAuthId,
        { user_metadata: updatedMetadata }
      )

      if (updateError) {
        return NextResponse.json({ 
          success: false, 
          error: `Failed to update user metadata: ${updateError.message}` 
        }, { status: 500 })
      }

      console.log('✅ Added admin role to user metadata')
    } else {
      console.log('✅ User already has admin role in metadata')
    }

    // Summary
    const result = {
      success: true,
      message: 'Rufus dual role setup completed successfully',
      details: {
        auth_user_id: rufusAuthId,
        email: authUser.user.email,
        provider_id: rufusProviderId,
        provider_name: `${provider.first_name} ${provider.last_name}`,
        roles: ['admin', 'provider'],
        changes: {
          provider_linked: provider.auth_user_id === rufusAuthId,
          admin_role_added: true
        }
      }
    }

    console.log('🎉 Dual role setup completed!')
    return NextResponse.json(result)

  } catch (error: any) {
    console.error('❌ Error setting up dual role:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Unknown error occurred' 
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    console.log('🔍 Checking Rufus dual role status...')

    const rufusAuthId = 'ab2e228d-5cb2-47ef-add5-ae7acb9269cc'
    const rufusProviderId = '08fbcd34-cd5f-425c-85bd-1aeeffbe9694'

    // Get auth user
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(rufusAuthId)
    if (authError || !authUser.user) {
      return NextResponse.json({ 
        success: false, 
        error: `Auth user not found: ${authError?.message}` 
      }, { status: 404 })
    }

    // Get provider
    const { data: provider, error: providerError } = await supabaseAdmin
      .from('providers')
      .select('*')
      .eq('id', rufusProviderId)
      .single()

    if (providerError || !provider) {
      return NextResponse.json({ 
        success: false, 
        error: `Provider not found: ${providerError?.message}` 
      }, { status: 404 })
    }

    const metadata = authUser.user.user_metadata || {}
    const hasAdminRole = metadata.roles && metadata.roles.includes('admin')
    const hasProviderRole = provider.auth_user_id === rufusAuthId

    const result = {
      success: true,
      status: {
        auth_user_id: rufusAuthId,
        email: authUser.user.email,
        provider_id: rufusProviderId,
        provider_name: `${provider.first_name} ${provider.last_name}`,
        provider_linked: hasProviderRole,
        admin_role_in_metadata: hasAdminRole,
        admin_email_match: authUser.user.email === 'rufussweeney@gmail.com',
        dual_role_ready: hasAdminRole && hasProviderRole
      }
    }

    return NextResponse.json(result)

  } catch (error: any) {
    console.error('❌ Error checking dual role status:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Unknown error occurred' 
    }, { status: 500 })
  }
}