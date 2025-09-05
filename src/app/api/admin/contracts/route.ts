// Admin Contract Tracker API
// GET /api/admin/contracts - List all provider-payer contracts
// POST /api/admin/contracts - Create new contract

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

// GET - List all provider-payer contracts
export async function GET(request: NextRequest) {
  try {
    const { authorized } = await verifyAdminAccess()
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    console.log('🔍 Admin fetching contracts')

    // Fetch provider-payer network relationships
    const { data: contracts, error } = await supabaseAdmin
      .from('provider_payer_networks')
      .select(`
        id,
        provider_id,
        payer_id,
        status_code,
        effective_date,
        termination_date,
        created_at,
        updated_at,
        provider:providers!provider_payer_networks_provider_id_fkey (
          id,
          first_name,
          last_name,
          email
        ),
        payer:payers!provider_payer_networks_payer_id_fkey (
          id,
          name,
          payer_type,
          state
        )
      `)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('❌ Error fetching contracts:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch contracts' },
        { status: 500 }
      )
    }

    // Transform data for frontend
    const transformedContracts = (contracts || []).map(contract => ({
      ...contract,
      provider_name: contract.provider ? 
        `${contract.provider.first_name} ${contract.provider.last_name}` : 
        'Unknown Provider',
      payer_name: contract.payer?.name || 'Unknown Payer',
      payer_state: contract.payer?.state || 'Unknown',
      status_display: contract.status_code || 'unknown',
      contract_type: 'direct' // All from provider_payer_networks are direct contracts
    }))

    console.log(`✅ Found ${contracts?.length || 0} contracts`)

    return NextResponse.json({
      success: true,
      data: transformedContracts
    })

  } catch (error: any) {
    console.error('❌ Admin contracts API error:', error)
    
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

// POST - Create new contract (for future implementation)
export async function POST(request: NextRequest) {
  try {
    const { authorized, user } = await verifyAdminAccess()
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Future implementation for creating contracts
    return NextResponse.json(
      { success: false, error: 'Contract creation not yet implemented' },
      { status: 501 }
    )

  } catch (error: any) {
    console.error('❌ Admin create contract error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to create contract',
        details: error.message
      },
      { status: 500 }
    )
  }
}