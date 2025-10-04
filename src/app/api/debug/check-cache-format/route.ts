import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function GET() {
  // Check cache for October 4, 2025
  const { data: cache } = await supabase
    .from('provider_availability_cache')
    .select('*')
    .eq('date', '2025-10-04')
    .limit(1)

  return NextResponse.json({
    cache_record: cache?.[0],
    sample_slot: cache?.[0]?.available_slots?.[0],
    slot_format_check: {
      has_start_time: !!cache?.[0]?.available_slots?.[0]?.start_time,
      has_end_time: !!cache?.[0]?.available_slots?.[0]?.end_time,
      has_available: !!cache?.[0]?.available_slots?.[0]?.available,
      has_appointment_type: !!cache?.[0]?.available_slots?.[0]?.appointment_type,
      has_duration_minutes: !!cache?.[0]?.available_slots?.[0]?.duration_minutes,
      is_string_format: typeof cache?.[0]?.available_slots?.[0] === 'string'
    }
  })
}
