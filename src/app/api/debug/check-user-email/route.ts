// Debug endpoint to check if an email exists in providers table
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')
    
    if (!email) {
      return NextResponse.json({
        error: 'Email parameter required'
      }, { status: 400 })
    }

    console.log(`🔍 Checking email: ${email}`)

    // Check if email exists in providers table
    const { data: providers, error: providerError } = await supabaseAdmin
      .from('providers')
      .select('id, first_name, last_name, email')
      .ilike('email', email)

    // Check if email exists in partner_users table  
    const { data: partnerUsers, error: partnerError } = await supabaseAdmin
      .from('partner_users')
      .select('id, full_name, email, organization_id')
      .ilike('email', email)

    // Check if email exists in Supabase auth
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers()
    const authUser = authUsers.users?.find(u => u.email?.toLowerCase() === email.toLowerCase())

    return NextResponse.json({
      email,
      results: {
        providers: {
          found: providers && providers.length > 0,
          count: providers?.length || 0,
          records: providers || [],
          error: providerError?.message || null
        },
        partner_users: {
          found: partnerUsers && partnerUsers.length > 0,
          count: partnerUsers?.length || 0,
          records: partnerUsers || [],
          error: partnerError?.message || null
        },
        supabase_auth: {
          found: !!authUser,
          user_id: authUser?.id || null,
          email_confirmed: authUser?.email_confirmed_at ? true : false,
          created_at: authUser?.created_at || null,
          error: authError?.message || null
        }
      }
    })

  } catch (error: any) {
    console.error('❌ Email check error:', error)
    
    return NextResponse.json({
      error: 'Failed to check email',
      details: error.message
    }, { status: 500 })
  }
}