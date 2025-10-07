import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { providerId, date, time } = await request.json()

    console.log('🔍 DEBUG: Checking appointment data for:', { providerId, date, time })

    // 1. Check provider details
    const { data: provider, error: providerError } = await supabase
      .from('providers')
      .select('*')
      .eq('id', providerId)
      .single()

    // 2. Check provider-payer relationships for this provider
    const { data: relationships } = await supabase
      .from('v_bookable_provider_payer')
      .select('*')
      .eq('provider_id', providerId)

    // 3. Check IntakeQ settings
    const { data: intakeqSettings } = await supabase
      .from('provider_intakeq_settings')
      .select('*')
      .eq('provider_id', providerId)

    // 4. Check availability cache for this date
    const { data: cacheData } = await supabase
      .from('provider_availability_cache')
      .select('*')
      .eq('provider_id', providerId)
      .eq('date', date)

    // 5. Check base availability (recurring)
    const testDate = new Date(date)
    const dayOfWeek = testDate.getDay()
    const { data: baseAvailability } = await supabase
      .from('provider_availability')
      .select('*')
      .eq('provider_id', providerId)
      .eq('day_of_week', dayOfWeek)

    return NextResponse.json({
      success: true,
      debug: {
        provider: provider || providerError,
        relationships,
        intakeqSettings,
        cacheData,
        baseAvailability,
        dateInfo: {
          date,
          time,
          dayOfWeek,
          dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek]
        }
      }
    })
  } catch (error: any) {
    console.error('❌ Debug endpoint error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
