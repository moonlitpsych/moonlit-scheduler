import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    console.log('🔍 Analyzing role system...')

    // Get all providers and their roles
    const { data: providers, error: providersError } = await supabaseAdmin
      .from('providers')
      .select('id, first_name, last_name, role, role_id')
      .order('role', { nullsFirst: false })

    if (providersError) {
      throw new Error(`Failed to fetch providers: ${providersError.message}`)
    }

    // Get the roles table if it exists
    const { data: rolesTable, error: rolesError } = await supabaseAdmin
      .from('roles')
      .select('*')
      .order('name')

    // Count role usage
    const roleUsage = {}
    const roleIdUsage = {}
    
    providers.forEach(provider => {
      const role = provider.role || 'null'
      const roleId = provider.role_id || 'null'
      
      roleUsage[role] = (roleUsage[role] || 0) + 1
      roleIdUsage[roleId] = (roleIdUsage[roleId] || 0) + 1
    })

    // Get unique roles actually in use
    const uniqueRoles = [...new Set(providers.map(p => p.role).filter(r => r))]

    // Check if role_id is being used vs role string
    const usingRoleId = providers.some(p => p.role_id !== null)
    const usingRoleString = providers.some(p => p.role !== null)

    console.log(`Found ${uniqueRoles.length} unique roles in use`)
    console.log(`Role table exists: ${!rolesError}`)
    console.log(`Using role_id: ${usingRoleId}`)
    console.log(`Using role string: ${usingRoleString}`)

    return NextResponse.json({
      success: true,
      analysis: {
        totalProviders: providers.length,
        uniqueRolesInUse: uniqueRoles,
        roleUsageBreakdown: roleUsage,
        roleIdUsageBreakdown: roleIdUsage,
        systemDesign: {
          hasRolesTable: !rolesError,
          usingRoleIdField: usingRoleId,
          usingRoleStringField: usingRoleString,
          mixedRoleSystem: usingRoleId && usingRoleString
        }
      },
      rolesTable: rolesError ? null : rolesTable,
      rolesTableError: rolesError?.message,
      providersByRole: providers.reduce((acc, provider) => {
        const role = provider.role || 'no_role'
        if (!acc[role]) acc[role] = []
        acc[role].push({
          name: `${provider.first_name} ${provider.last_name}`,
          role_id: provider.role_id
        })
        return acc
      }, {}),
      recommendations: {
        shouldSimplify: uniqueRoles.length > 2,
        suggestedRoles: ['provider', 'admin'],
        currentComplexity: `${uniqueRoles.length} different role types`,
        migrationNeeded: usingRoleId && usingRoleString
      }
    })

  } catch (error) {
    console.error('❌ Role analysis failed:', error.message)
    return NextResponse.json({
      success: false,
      error: 'Role analysis failed',
      details: error.message
    }, { status: 500 })
  }
}