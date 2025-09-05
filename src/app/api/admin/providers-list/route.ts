// Admin Providers List API
// GET /api/admin/providers-list - Get all providers for dropdown selections

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isAdminEmail } from '@/lib/admin-auth'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

async function verifyAdminAccess() {
  try {
    const cookieStore = await cookies()
    const supabase = createServerComponentClient({ cookies: () => cookieStore })
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user || !isAdminEmail(user.email || '')) {
      return { authorized: false, user: null }
    }
    
    return { authorized: true, user }
  } catch (error) {
    console.error('Admin verification error:', error)
    return { authorized: false, user: null }
  }
}

// GET - List all providers for admin selections
export async function GET(request: NextRequest) {
  try {
    const { authorized } = await verifyAdminAccess()
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    console.log('🔍 Admin fetching providers list')

    // Fetch all active providers ordered by name (fix for missing role_title column)
    const { data: providers, error } = await supabaseAdmin
      .from('providers')
      .select('id, first_name, last_name, email, is_active, specialty, is_bookable')
      .eq('is_active', true)
      .order('last_name', { ascending: true })

    if (error) {
      console.error('❌ Error fetching providers:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch providers' },
        { status: 500 }
      )
    }

    // Filter and clean provider data
    const cleanedProviders = (providers || [])
      .filter(provider => provider.first_name && provider.last_name)
      .map(provider => ({
        id: provider.id,
        first_name: provider.first_name,
        last_name: provider.last_name,
        email: provider.email || '',
        is_active: provider.is_active || false,
        role_title: '', // Placeholder until column exists
        specialty: Array.isArray(provider.specialty) ? provider.specialty : []
      }))

    console.log(`✅ Found ${cleanedProviders.length} active providers`)

    return NextResponse.json({
      success: true,
      data: cleanedProviders
    })

  } catch (error: any) {
    console.error('❌ Admin providers list API error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        details: error.message
      },
      { status: 500 }
    )
  }
}