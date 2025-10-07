import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { date, providerId } = await request.json()

    // Get provider info
    const { data: provider } = await supabase
      .from('providers')
      .select('id, first_name, last_name')
      .eq('id', providerId)
      .single()

    // Get cache data
    const { data: cacheData } = await supabase
      .from('provider_availability_cache')
      .select('*')
      .eq('provider_id', providerId)
      .eq('date', date)
      .single()

    return NextResponse.json({
      success: true,
      provider,
      date,
      cacheData,
      slotsInCache: cacheData?.available_slots?.length || 0,
      slots: cacheData?.available_slots || []
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
