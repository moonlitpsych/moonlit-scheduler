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
    console.log('🔍 Fetching supervision relationships for payer:', payerId)

    // Get supervision relationships for this payer
    const { data: relationships, error: relationshipsError } = await supabase
      .from('supervision_relationships')
      .select(`
        id,
        supervisor_provider_id,
        supervisee_provider_id
      `)
      .eq('payer_id', payerId)

    if (relationshipsError) {
      console.error('❌ Error fetching supervision relationships:', relationshipsError)
      return NextResponse.json(
        { error: 'Failed to fetch supervision relationships' },
        { status: 500 }
      )
    }

    // Get provider names separately
    const allProviderIds = new Set<string>()
    relationships?.forEach(r => {
      allProviderIds.add(r.supervisor_provider_id)
      allProviderIds.add(r.supervisee_provider_id)
    })

    let providerNames: Record<string, string> = {}
    if (allProviderIds.size > 0) {
      const { data: providers } = await supabase
        .from('providers')
        .select('id, first_name, last_name')
        .in('id', Array.from(allProviderIds))

      providerNames = Object.fromEntries(
        providers?.map(p => [p.id, `${p.first_name} ${p.last_name}`]) || []
      )
    }

    // Transform the data
    const transformedRelationships = relationships?.map(relationship => ({
      id: relationship.id,
      supervising_provider_id: relationship.supervisor_provider_id,
      supervised_provider_id: relationship.supervisee_provider_id,
      supervising_provider_name: providerNames[relationship.supervisor_provider_id] || 'Unknown Provider',
      supervised_provider_name: providerNames[relationship.supervisee_provider_id] || 'Unknown Provider',
      effective_date: null, // Column doesn't exist in this table
      expiration_date: null // Column doesn't exist in this table
    })) || []

    console.log(`✅ Found ${transformedRelationships.length} supervision relationships for payer`)

    return NextResponse.json({
      success: true,
      data: transformedRelationships
    })

  } catch (error) {
    console.error('❌ Supervision relationships API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}