import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ payerId: string }> }
) {
  try {
    const { payerId } = await params
    console.log('🔍 Fetching contracts for payer:', payerId)

    // Get provider-payer contracts
    const { data: contracts, error: contractsError } = await supabase
      .from('provider_payer_networks')
      .select(`
        id,
        provider_id,
        effective_date,
        expiration_date,
        status
      `)
      .eq('payer_id', payerId)
      .order('effective_date', { ascending: false })

    if (contractsError) {
      console.error('❌ Error fetching contracts:', contractsError)
      return NextResponse.json(
        { error: 'Failed to fetch contracts' },
        { status: 500 }
      )
    }

    // Get provider names separately
    const providerIds = contracts?.map(c => c.provider_id) || []
    let providerNames: Record<string, string> = {}

    if (providerIds.length > 0) {
      const { data: providers } = await supabase
        .from('providers')
        .select('id, first_name, last_name')
        .in('id', providerIds)

      providerNames = Object.fromEntries(
        providers?.map(p => [p.id, `${p.first_name} ${p.last_name}`]) || []
      )
    }

    // Transform the data
    const transformedContracts = contracts?.map(contract => ({
      id: contract.id,
      provider_id: contract.provider_id,
      provider_name: providerNames[contract.provider_id] || 'Unknown Provider',
      effective_date: contract.effective_date,
      expiration_date: contract.expiration_date,
      status: contract.status || 'active',
      billing_provider_id: null // Column doesn't exist in this table
    })) || []

    console.log(`✅ Found ${transformedContracts.length} contracts for payer`)

    return NextResponse.json({
      success: true,
      data: transformedContracts
    })

  } catch (error) {
    console.error('❌ Contracts API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}