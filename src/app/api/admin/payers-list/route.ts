// Admin Payers List API
// GET /api/admin/payers-list - Get all payers for dropdown selections

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isAdminEmail } from '@/lib/admin-auth'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

async function verifyAdminAccess() {
  try {
    const supabase = createServerComponentClient({ cookies })
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

// GET - List all payers for admin selections
export async function GET(request: NextRequest) {
  try {
    const { authorized } = await verifyAdminAccess()
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    console.log('🔍 Admin fetching payers list')

    // Fetch all payers ordered by name
    const { data: payers, error } = await supabaseAdmin
      .from('payers')
      .select('id, name, state, payer_type, status_code')
      .order('name', { ascending: true })

    if (error) {
      console.error('❌ Error fetching payers:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch payers' },
        { status: 500 }
      )
    }

    console.log(`✅ Found ${payers?.length || 0} payers`)

    return NextResponse.json({
      success: true,
      data: payers || []
    })

  } catch (error: any) {
    console.error('❌ Admin payers list API error:', error)
    
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