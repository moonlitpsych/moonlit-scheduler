import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const providerId = searchParams.get('provider_id') || '08fbcd34-cd5f-425c-85bd-1aeeffbe9694' // Rufus Sweeney
  const serviceInstanceId = searchParams.get('service_instance_id') || '12191f44-a09c-426f-8e22-0c5b8e57b3b7'
  const date = searchParams.get('date') || '2025-10-04'

  // Call the database function that the trigger uses
  const { data, error } = await supabase.rpc('expand_available_slots', {
    p_provider_id: providerId,
    p_service_instance_id: serviceInstanceId,
    p_from: date,
    p_thru: date,
    p_tz: 'America/Denver'
  })

  // Also get the raw cache for comparison
  const { data: cache } = await supabase
    .from('provider_availability_cache')
    .select('*')
    .eq('provider_id', providerId)
    .eq('service_instance_id', serviceInstanceId)
    .eq('date', date)
    .single()

  return NextResponse.json({
    function_result: data,
    function_error: error,
    raw_cache: cache,
    test_appointment_time: {
      local: '2025-10-04 17:00:00-06',
      utc: '2025-10-04T23:00:00.000Z'
    }
  })
}
