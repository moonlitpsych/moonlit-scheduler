import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function GET() {
  const providerId = '08fbcd34-cd5f-425c-85bd-1aeeffbe9694' // Rufus Sweeney
  const dayOfWeek = 5 // Friday (Oct 4, 2025)

  // Check provider_availability table (recurring schedule)
  const { data: recurring } = await supabase
    .from('provider_availability')
    .select('*')
    .eq('provider_id', providerId)
    .eq('day_of_week', dayOfWeek)
    .eq('is_recurring', true)

  // Check provider details
  const { data: provider } = await supabase
    .from('providers')
    .select('id, first_name, last_name, is_bookable, is_active')
    .eq('id', providerId)
    .single()

  return NextResponse.json({
    provider,
    recurring_availability: recurring,
    recurring_count: recurring?.length || 0
  })
}
