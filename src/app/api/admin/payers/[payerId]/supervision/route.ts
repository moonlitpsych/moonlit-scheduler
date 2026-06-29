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

    // Get supervision relationships for this payer (incl. date-bound fields so the
    // editor can preload and manage start/end dates and active status).
    const { data: relationships, error: relationshipsError } = await supabase
      .from('supervision_relationships')
      .select(`
        id,
        supervisor_provider_id,
        supervisee_provider_id,
        start_date,
        end_date,
        is_active,
        supervision_type,
        supervision_level
      `)
      .eq('payer_id', payerId)
      .order('start_date', { ascending: true })

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

    // Transform the data. Legacy field names (supervising_/supervised_/effective_/
    // expiration_) are kept for existing consumers (PayerDetailModal); the date-bound
    // fields (start_date/end_date/is_active/...) are added for the supervision editor.
    const transformedRelationships = relationships?.map(relationship => ({
      id: relationship.id,
      supervising_provider_id: relationship.supervisor_provider_id,
      supervised_provider_id: relationship.supervisee_provider_id,
      supervising_provider_name: providerNames[relationship.supervisor_provider_id] || 'Unknown Provider',
      supervised_provider_name: providerNames[relationship.supervisee_provider_id] || 'Unknown Provider',
      effective_date: relationship.start_date,   // legacy alias → start_date
      expiration_date: relationship.end_date,    // legacy alias → end_date
      start_date: relationship.start_date,
      end_date: relationship.end_date,
      is_active: relationship.is_active,
      supervision_type: relationship.supervision_type,
      supervision_level: relationship.supervision_level
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