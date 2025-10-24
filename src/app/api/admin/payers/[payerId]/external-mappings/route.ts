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
    const { searchParams } = new URL(request.url)
    const system = searchParams.get('system') || 'practiceq'

    console.log(`🔍 Fetching ${system} mappings for payer:`, payerId)

    // Get external mappings for this payer and system
    const { data: mappings, error } = await supabase
      .from('payer_external_mappings')
      .select('key_name, value')
      .eq('payer_id', payerId)
      .eq('system', system)

    if (error) {
      console.error('❌ Error fetching external mappings:', error)
      return NextResponse.json(
        { error: 'Failed to fetch external mappings' },
        { status: 500 }
      )
    }

    // Convert array of mappings to object
    const mappingObject = mappings?.reduce((acc, mapping) => {
      acc[mapping.key_name] = mapping.value
      return acc
    }, {} as Record<string, string>) || {}

    console.log(`✅ Found ${Object.keys(mappingObject).length} mappings for ${system}`)

    return NextResponse.json({
      success: true,
      data: mappingObject
    })

  } catch (error) {
    console.error('❌ External mappings API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}