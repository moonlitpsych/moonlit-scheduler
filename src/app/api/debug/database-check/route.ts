import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    console.log('🔍 Checking database content...')

    // Check providers table
    const { data: providers, error: providersError } = await supabaseAdmin
      .from('providers')
      .select('id, first_name, last_name, email, role, auth_user_id')
      .order('first_name')

    if (providersError) {
      console.error('❌ Error fetching providers:', providersError)
      return NextResponse.json({ error: 'Failed to fetch providers', details: providersError }, { status: 500 })
    }

    // Check auth.users table (using admin client)
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers()

    if (authError) {
      console.error('❌ Error fetching auth users:', authError)
      return NextResponse.json({ error: 'Failed to fetch auth users', details: authError }, { status: 500 })
    }

    console.log(`✅ Found ${providers?.length} providers`)
    console.log(`✅ Found ${authUsers.users?.length} auth users`)

    return NextResponse.json({
      success: true,
      providers: {
        count: providers?.length || 0,
        data: providers || []
      },
      authUsers: {
        count: authUsers.users?.length || 0,
        data: authUsers.users.map(user => ({
          id: user.id,
          email: user.email,
          created_at: user.created_at,
          email_confirmed_at: user.email_confirmed_at,
          last_sign_in_at: user.last_sign_in_at
        })) || []
      }
    })

  } catch (error) {
    console.error('❌ Unexpected error:', error)
    return NextResponse.json({ error: 'Unexpected error occurred' }, { status: 500 })
  }
}