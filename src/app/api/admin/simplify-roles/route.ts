import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST() {
  try {
    console.log('🔄 Starting role system simplification...')

    // Step 1: Get current state
    const { data: providers, error: providersError } = await supabaseAdmin
      .from('providers')
      .select('id, first_name, last_name, role, role_id, email')
      .order('first_name')

    if (providersError) {
      throw new Error(`Failed to fetch providers: ${providersError.message}`)
    }

    const { data: currentRoles, error: rolesError } = await supabaseAdmin
      .from('roles')
      .select('*')

    if (rolesError) {
      throw new Error(`Failed to fetch roles: ${rolesError.message}`)
    }

    console.log(`📊 Current state: ${providers.length} providers, ${currentRoles.length} roles`)

    // Step 2: Ensure simplified roles exist
    console.log('🧹 Setting up simplified roles...')
    
    // Get or create admin role
    let { data: adminRoles } = await supabaseAdmin
      .from('roles')
      .select('*')
      .eq('name', 'admin')
      .single()

    if (!adminRoles) {
      const { data: newAdminRole, error: createAdminError } = await supabaseAdmin
        .from('roles')
        .insert({
          name: 'admin',
          description: 'System administrator with full access',
          permissions: [
            'manage_providers',
            'manage_appointments', 
            'view_analytics',
            'manage_settings',
            'edit_profile',
            'manage_availability',
            'view_appointments'
          ]
        })
        .select()
        .single()

      if (createAdminError) {
        throw new Error(`Failed to create admin role: ${createAdminError.message}`)
      }
      adminRoles = newAdminRole
    } else {
      // Update existing admin role
      const { error: updateAdminError } = await supabaseAdmin
        .from('roles')
        .update({
          description: 'System administrator with full access',
          permissions: [
            'manage_providers',
            'manage_appointments', 
            'view_analytics',
            'manage_settings',
            'edit_profile',
            'manage_availability',
            'view_appointments'
          ]
        })
        .eq('name', 'admin')
      
      if (updateAdminError) {
        console.warn('⚠️ Could not update admin role:', updateAdminError.message)
      }
    }

    // Get or create provider role
    let { data: providerRoles } = await supabaseAdmin
      .from('roles')
      .select('*')
      .eq('name', 'provider')
      .single()

    if (!providerRoles) {
      const { data: newProviderRole, error: createProviderError } = await supabaseAdmin
        .from('roles')
        .insert({
          name: 'provider',
          description: 'Healthcare provider',
          permissions: [
            'edit_profile',
            'manage_availability', 
            'view_appointments'
          ]
        })
        .select()
        .single()

      if (createProviderError) {
        throw new Error(`Failed to create provider role: ${createProviderError.message}`)
      }
      providerRoles = newProviderRole
    } else {
      // Update existing provider role  
      const { error: updateProviderError } = await supabaseAdmin
        .from('roles')
        .update({
          description: 'Healthcare provider',
          permissions: [
            'edit_profile',
            'manage_availability', 
            'view_appointments'
          ]
        })
        .eq('name', 'provider')
      
      if (updateProviderError) {
        console.warn('⚠️ Could not update provider role:', updateProviderError.message)
      }
    }

    const newRoles = [adminRoles, providerRoles]

    const adminRole = newRoles.find(r => r.name === 'admin')
    const providerRole = newRoles.find(r => r.name === 'provider')

    console.log(`✅ Created simplified roles:`)
    console.log(`   - Admin: ${adminRole.id}`)
    console.log(`   - Provider: ${providerRole.id}`)

    // Step 3: Migrate all providers to new role system
    console.log('🔄 Migrating providers to simplified roles...')
    
    const migrationResults = {
      admins: [],
      providers: [],
      errors: []
    }

    for (const provider of providers) {
      try {
        // Determine if they should be admin or provider
        const shouldBeAdmin = (
          provider.role === 'admin' || 
          provider.email === 'rufussweeney@gmail.com' ||
          provider.email === 'hello@trymoonlit.com' // Miriam Admin
        )

        const newRoleId = shouldBeAdmin ? adminRole.id : providerRole.id
        const newRoleString = shouldBeAdmin ? 'admin' : 'provider'

        // Update the provider
        const { error: updateError } = await supabaseAdmin
          .from('providers')
          .update({
            role: newRoleString,
            role_id: newRoleId
          })
          .eq('id', provider.id)

        if (updateError) {
          throw new Error(`Failed to update ${provider.first_name}: ${updateError.message}`)
        }

        const result = {
          name: `${provider.first_name} ${provider.last_name}`,
          email: provider.email,
          oldRole: provider.role || 'null',
          newRole: newRoleString,
          newRoleId: newRoleId
        }

        if (shouldBeAdmin) {
          migrationResults.admins.push(result)
          console.log(`👑 ${result.name} → admin`)
        } else {
          migrationResults.providers.push(result)
          console.log(`👨‍⚕️ ${result.name} → provider`)
        }

      } catch (error) {
        console.error(`❌ Error migrating ${provider.first_name} ${provider.last_name}:`, error.message)
        migrationResults.errors.push({
          name: `${provider.first_name} ${provider.last_name}`,
          error: error.message
        })
      }
    }

    // Step 4: Verify final state
    const { data: finalProviders } = await supabaseAdmin
      .from('providers')
      .select('id, first_name, last_name, role, role_id')
      .order('role', { nullsFirst: false })

    const { data: finalRoles } = await supabaseAdmin
      .from('roles')
      .select('*')

    // Count final state
    const finalRoleCounts = {
      admin: finalProviders.filter(p => p.role === 'admin').length,
      provider: finalProviders.filter(p => p.role === 'provider').length,
      other: finalProviders.filter(p => p.role !== 'admin' && p.role !== 'provider').length
    }

    console.log('🎉 Role simplification complete!')
    console.log(`📊 Final state: ${finalRoleCounts.admin} admins, ${finalRoleCounts.provider} providers, ${finalRoleCounts.other} others`)

    return NextResponse.json({
      success: true,
      message: 'Role system simplified successfully',
      migration: {
        before: {
          totalProviders: providers.length,
          totalRoles: currentRoles.length,
          roleVariations: [...new Set(providers.map(p => p.role).filter(r => r))]
        },
        after: {
          totalProviders: finalProviders.length,
          totalRoles: finalRoles.length,
          roleCounts: finalRoleCounts
        },
        results: migrationResults,
        newRoles: newRoles,
        finalProviders: finalProviders
      }
    })

  } catch (error) {
    console.error('❌ Role simplification failed:', error.message)
    return NextResponse.json({
      success: false,
      error: 'Role simplification failed',
      details: error.message
    }, { status: 500 })
  }
}