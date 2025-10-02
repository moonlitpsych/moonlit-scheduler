import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Fetching providers for selection...')

    // Get all providers for dropdown selection
    const { data: providers, error: providersError } = await supabase
      .from('providers')
      .select('id, first_name, last_name')
      .order('last_name', { ascending: true })

    if (providersError) {
      console.error('❌ Error fetching providers:', providersError)
      return NextResponse.json(
        { error: 'Failed to fetch providers' },
        { status: 500 }
      )
    }

    // Transform the data to include full names
    const transformedProviders = providers?.map(provider => ({
      id: provider.id,
      name: `${provider.first_name} ${provider.last_name}`.trim()
    })) || []

    console.log(`✅ Found ${transformedProviders.length} providers`)

    return NextResponse.json({
      success: true,
      data: transformedProviders
    })

  } catch (error) {
    console.error('❌ Providers API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}