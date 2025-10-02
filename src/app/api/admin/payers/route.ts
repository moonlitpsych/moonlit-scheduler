import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Fetching payers with contract/supervision counts...')

    // Get all payers with relationship counts
    const { data: payers, error: payersError } = await supabase
      .from('payers')
      .select(`
        *,
        provider_payer_networks(count),
        supervision_relationships(count)
      `)
      .order('name')

    if (payersError) {
      console.error('❌ Error fetching payers:', payersError)
      return NextResponse.json(
        { error: 'Failed to fetch payers' },
        { status: 500 }
      )
    }

    // Transform the data to include counts
    const transformedPayers = payers?.map(payer => ({
      ...payer,
      contract_count: payer.provider_payer_networks?.length || 0,
      supervision_count: payer.supervision_relationships?.length || 0,
      provider_payer_networks: undefined, // Remove the nested data
      supervision_relationships: undefined
    })) || []

    console.log(`✅ Found ${transformedPayers.length} payers`)

    return NextResponse.json({
      success: true,
      data: transformedPayers
    })

  } catch (error) {
    console.error('❌ Payers API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    console.log('🔍 Creating new payer:', body.name)

    // Validate required fields
    if (!body.name || !body.payer_type) {
      return NextResponse.json(
        { error: 'Name and payer type are required' },
        { status: 400 }
      )
    }

    // Create new payer
    const { data: newPayer, error: createError } = await supabase
      .from('payers')
      .insert({
        name: body.name,
        payer_type: body.payer_type,
        state: body.state,
        status_code: body.status_code || null,
        effective_date: body.effective_date || null,
        requires_attending: body.requires_attending || false,
        allows_supervised: body.allows_supervised || false,
        supervision_level: body.supervision_level || null,
        requires_individual_contract: body.requires_individual_contract || false
      })
      .select()
      .single()

    if (createError) {
      console.error('❌ Error creating payer:', createError)
      return NextResponse.json(
        { error: 'Failed to create payer' },
        { status: 500 }
      )
    }

    console.log('✅ Created new payer:', newPayer.name)

    return NextResponse.json({
      success: true,
      data: newPayer
    })

  } catch (error) {
    console.error('❌ Create payer error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}