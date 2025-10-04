import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function GET() {
  const dougId = '9b093465-e514-4d9f-8c45-22dcd0eb1811'

  // Check recurring availability
  const { data: availability } = await supabase
    .from('provider_availability')
    .select('*')
    .eq('provider_id', dougId)

  // Check availability cache
  const { data: cache } = await supabase
    .from('provider_availability_cache')
    .select('*')
    .eq('provider_id', dougId)

  // Check provider details
  const { data: provider } = await supabase
    .from('providers')
    .select('id, first_name, last_name, is_bookable, intakeq_practitioner_id')
    .eq('id', dougId)
    .single()

  return NextResponse.json({
    provider,
    recurring_availability: availability,
    cached_availability: cache
  })
}
