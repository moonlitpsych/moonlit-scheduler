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
        status,
        effective_date,
        expiration_date,
        notes,
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
      status_display: contract.status || 'unknown',
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

// POST - Create or update contract (UPSERT)
export async function POST(request: NextRequest) {
  try {
    const { authorized, user } = await verifyAdminAccess()
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { provider_id, payer_id, effective_date, expiration_date, status, notes } = body

    // Validate required fields
    if (!provider_id || !payer_id || !effective_date) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: provider_id, payer_id, effective_date' },
        { status: 400 }
      )
    }

    console.log('📝 Saving contract (create or update):', { provider_id, payer_id, effective_date, expiration_date })

    // Use raw SQL for UPSERT with proper conflict resolution
    // ON CONFLICT updates the row instead of throwing 409 error
    const { data: savedContract, error: upsertError } = await supabaseAdmin.rpc('upsert_provider_payer_contract', {
      p_provider_id: provider_id,
      p_payer_id: payer_id,
      p_effective_date: effective_date,
      p_expiration_date: expiration_date || null,
      p_status: status || null,  // Will default to 'in_network' in the function
      p_notes: notes || null
    })

    if (upsertError) {
      console.error('❌ Error upserting contract:', upsertError)
      return NextResponse.json(
        { success: false, error: 'Failed to save contract', details: upsertError.message },
        { status: 500 }
      )
    }

    // Fetch the complete contract with joined data
    const { data: fullContract, error: fetchError } = await supabaseAdmin
      .from('provider_payer_networks')
      .select(`
        id,
        provider_id,
        payer_id,
        status,
        effective_date,
        expiration_date,
        notes,
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
      .eq('provider_id', provider_id)
      .eq('payer_id', payer_id)
      .single()

    if (fetchError || !fullContract) {
      console.error('❌ Error fetching saved contract:', fetchError)
      return NextResponse.json(
        { success: false, error: 'Contract saved but failed to retrieve', details: fetchError?.message },
        { status: 500 }
      )
    }

    console.log('✅ Contract saved successfully:', fullContract.id)

    // Transform data for frontend
    const transformedContract = {
      ...fullContract,
      provider_name: fullContract.provider ?
        `${fullContract.provider.first_name} ${fullContract.provider.last_name}` :
        'Unknown Provider',
      payer_name: fullContract.payer?.name || 'Unknown Payer',
      payer_state: fullContract.payer?.state || 'Unknown',
      status_display: fullContract.status || 'unknown',
      contract_type: 'direct'
    }

    return NextResponse.json({
      success: true,
      data: transformedContract,
      message: 'Contract saved successfully'
    }, { status: 200 })

  } catch (error: any) {
    console.error('❌ Admin save contract error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to save contract',
        details: error.message
      },
      { status: 500 }
    )
  }
}