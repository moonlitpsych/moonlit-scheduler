import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST() {
  try {
    console.log('🧹 Starting legacy roles cleanup...')

    // Step 1: Get current roles table
    const { data: allRoles, error: rolesError } = await supabaseAdmin
      .from('roles')
      .select('*')
      .order('name')

    if (rolesError) {
      throw new Error(`Failed to fetch roles: ${rolesError.message}`)
    }

    console.log(`📊 Found ${allRoles.length} roles in table`)

    // Step 2: Identify active vs legacy roles
    const activeRoles = ['admin', 'provider']
    const legacyRoles = allRoles.filter(role => !activeRoles.includes(role.name))
    const keepRoles = allRoles.filter(role => activeRoles.includes(role.name))

    console.log(`✅ Active roles to keep: ${keepRoles.map(r => r.name).join(', ')}`)
    console.log(`🗑️ Legacy roles to delete: ${legacyRoles.map(r => r.name).join(', ')}`)

    // Step 3: Verify no providers are using legacy roles
    const { data: providers, error: providersError } = await supabaseAdmin
      .from('providers')
      .select('id, first_name, last_name, role, role_id')

    if (providersError) {
      throw new Error(`Failed to fetch providers: ${providersError.message}`)
    }

    const providersUsingLegacyRoleIds = providers.filter(p => 
      legacyRoles.some(lr => lr.id === p.role_id)
    )

    const providersUsingLegacyRoleStrings = providers.filter(p => 
      legacyRoles.some(lr => lr.name === p.role) && !activeRoles.includes(p.role)
    )

    if (providersUsingLegacyRoleIds.length > 0 || providersUsingLegacyRoleStrings.length > 0) {
      console.warn('⚠️ Found providers still using legacy roles!')
      console.log('Legacy role_id users:', providersUsingLegacyRoleIds.map(p => `${p.first_name} ${p.last_name}`))
      console.log('Legacy role string users:', providersUsingLegacyRoleStrings.map(p => `${p.first_name} ${p.last_name}`))
      
      return NextResponse.json({
        success: false,
        error: 'Cannot delete legacy roles - still in use',
        details: {
          legacyRoleIdUsers: providersUsingLegacyRoleIds,
          legacyRoleStringUsers: providersUsingLegacyRoleStrings
        }
      }, { status: 400 })
    }

    // Step 4: Delete legacy roles
    const deletionResults = {
      deleted: [],
      errors: []
    }

    for (const legacyRole of legacyRoles) {
      try {
        console.log(`🗑️ Deleting legacy role: ${legacyRole.name}`)
        
        const { error: deleteError } = await supabaseAdmin
          .from('roles')
          .delete()
          .eq('id', legacyRole.id)

        if (deleteError) {
          throw new Error(`Failed to delete ${legacyRole.name}: ${deleteError.message}`)
        }

        deletionResults.deleted.push({
          id: legacyRole.id,
          name: legacyRole.name,
          description: legacyRole.description
        })

        console.log(`✅ Deleted: ${legacyRole.name}`)

      } catch (error) {
        console.error(`❌ Error deleting ${legacyRole.name}:`, error.message)
        deletionResults.errors.push({
          name: legacyRole.name,
          error: error.message
        })
      }
    }

    // Step 5: Verify final state
    const { data: finalRoles, error: finalRolesError } = await supabaseAdmin
      .from('roles')
      .select('*')
      .order('name')

    if (finalRolesError) {
      console.warn('⚠️ Could not verify final roles state:', finalRolesError.message)
    }

    console.log('🎉 Legacy roles cleanup complete!')
    console.log(`📊 Final state: ${finalRoles?.length || 'unknown'} roles remaining`)

    return NextResponse.json({
      success: true,
      message: 'Legacy roles cleanup completed',
      cleanup: {
        before: {
          totalRoles: allRoles.length,
          activeRoles: keepRoles.map(r => ({ id: r.id, name: r.name })),
          legacyRoles: legacyRoles.map(r => ({ id: r.id, name: r.name }))
        },
        after: {
          totalRoles: finalRoles?.length || 0,
          remainingRoles: finalRoles?.map(r => ({ id: r.id, name: r.name })) || []
        },
        results: deletionResults
      }
    })

  } catch (error) {
    console.error('❌ Legacy roles cleanup failed:', error.message)
    return NextResponse.json({
      success: false,
      error: 'Legacy roles cleanup failed',
      details: error.message
    }, { status: 500 })
  }
}