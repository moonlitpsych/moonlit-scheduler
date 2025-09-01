import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    console.log('🔍 Checking Rufus Sweeney setup...')

    // Get all Rufus records
    const { data: rufusProviders, error: providersError } = await supabaseAdmin
      .from('providers')
      .select('*')
      .or('first_name.ilike.%rufus%,last_name.ilike.%sweeney%')
      .order('first_name')

    if (providersError) {
      throw new Error(`Failed to fetch Rufus providers: ${providersError.message}`)
    }

    // Get his auth users
    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers()
    const rufusAuthUsers = authUsers.users.filter(user => 
      user.email?.includes('rufus') || user.email?.includes('sweeney')
    )

    console.log(`Found ${rufusProviders.length} Rufus provider records`)
    console.log(`Found ${rufusAuthUsers.length} Rufus auth users`)

    return NextResponse.json({
      success: true,
      rufusProviders: rufusProviders,
      rufusAuthUsers: rufusAuthUsers.map(user => ({
        id: user.id,
        email: user.email,
        user_metadata: user.user_metadata,
        created_at: user.created_at
      })),
      analysis: {
        totalProviderRecords: rufusProviders.length,
        totalAuthUsers: rufusAuthUsers.length,
        adminRoleCount: rufusProviders.filter(p => p.role === 'admin').length,
        providerRoleCount: rufusProviders.filter(p => p.role !== 'admin' && p.role !== null).length
      }
    })

  } catch (error) {
    console.error('❌ Rufus check failed:', error.message)
    return NextResponse.json({
      success: false,
      error: 'Rufus check failed',
      details: error.message
    }, { status: 500 })
  }
}