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

// POST - Create new contract
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

    console.log('📝 Creating new contract:', { provider_id, payer_id, effective_date, expiration_date })

    // Check if contract already exists for this provider-payer combination
    const { data: existingContracts, error: checkError } = await supabaseAdmin
      .from('provider_payer_networks')
      .select('id, effective_date, expiration_date')
      .eq('provider_id', provider_id)
      .eq('payer_id', payer_id)

    if (checkError) {
      console.error('❌ Error checking existing contracts:', checkError)
      return NextResponse.json(
        { success: false, error: 'Failed to check existing contracts', details: checkError.message },
        { status: 500 }
      )
    }

    // Check for date overlaps with existing contracts
    if (existingContracts && existingContracts.length > 0) {
      const newStart = new Date(effective_date)
      const newEnd = expiration_date ? new Date(expiration_date) : null

      for (const existing of existingContracts) {
        const existingStart = new Date(existing.effective_date)
        const existingEnd = existing.expiration_date ? new Date(existing.expiration_date) : null

        // Check for overlap
        const overlaps = (
          (newEnd === null || existingStart <= newEnd) &&
          (existingEnd === null || newStart <= existingEnd)
        )

        if (overlaps) {
          return NextResponse.json(
            {
              success: false,
              error: 'Date overlap detected',
              details: `A contract already exists for this provider-payer combination with overlapping dates (${existing.effective_date} - ${existing.expiration_date || 'ongoing'}). Please adjust the dates or update the existing contract.`
            },
            { status: 409 }
          )
        }
      }
    }

    // Insert new contract
    const { data: newContract, error: insertError} = await supabaseAdmin
      .from('provider_payer_networks')
      .insert({
        provider_id,
        payer_id,
        effective_date,
        expiration_date: expiration_date || null,
        status: status || null,  // Allow null - database will handle defaults
        notes: notes || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
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
      .single()

    if (insertError) {
      console.error('❌ Error inserting contract:', insertError)
      return NextResponse.json(
        { success: false, error: 'Failed to create contract', details: insertError.message },
        { status: 500 }
      )
    }

    console.log('✅ Contract created successfully:', newContract.id)

    // Transform data for frontend
    const transformedContract = {
      ...newContract,
      provider_name: newContract.provider ?
        `${newContract.provider.first_name} ${newContract.provider.last_name}` :
        'Unknown Provider',
      payer_name: newContract.payer?.name || 'Unknown Payer',
      payer_state: newContract.payer?.state || 'Unknown',
      status_display: newContract.status || 'unknown',
      contract_type: 'direct'
    }

    return NextResponse.json({
      success: true,
      data: transformedContract,
      message: 'Contract created successfully'
    })

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