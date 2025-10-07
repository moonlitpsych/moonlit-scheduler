import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date')

  if (!date) {
    return NextResponse.json({ error: 'Missing date parameter' }, { status: 400 })
  }

  // Check cache for this date
  const { data: cacheRecords, error } = await supabase
    .from('provider_availability_cache')
    .select('date, provider_id, service_instance_id, available_slots')
    .eq('date', date)
    .order('provider_id')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    date,
    recordCount: cacheRecords?.length || 0,
    records: cacheRecords?.map(r => ({
      provider_id: r.provider_id,
      service_instance_id: r.service_instance_id,
      slot_count: r.available_slots?.length || 0,
      slots: r.available_slots
    })) || []
  })
}
