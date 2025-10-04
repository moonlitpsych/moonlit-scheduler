import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Checking availability cache for October 4, 2025...')

    // Check what slots are in the cache for Oct 4, 2025
    const { data: cacheData, error: cacheError } = await supabase
      .from('provider_availability_cache')
      .select(`
        id,
        date,
        available_slots,
        service_instance_id,
        providers (
          id,
          first_name,
          last_name,
          intakeq_practitioner_id,
          is_bookable
        )
      `)
      .eq('date', '2025-10-04')
      .order('providers(last_name)')

    if (cacheError) {
      console.error('❌ Cache query error:', cacheError)
      return NextResponse.json({ error: cacheError.message }, { status: 500 })
    }

    // Also check all bookable providers with IntakeQ IDs
    const { data: providers, error: providersError } = await supabase
      .from('providers')
      .select('id, first_name, last_name, intakeq_practitioner_id, is_bookable')
      .eq('is_bookable', true)
      .not('intakeq_practitioner_id', 'is', null)

    if (providersError) {
      console.error('❌ Providers query error:', providersError)
    }

    // Check if there are any appointments already for Oct 4
    const { data: existingAppts, error: apptsError } = await supabase
      .from('appointments')
      .select('id, provider_id, start_time, end_time, status')
      .gte('start_time', '2025-10-04T00:00:00Z')
      .lt('start_time', '2025-10-05T00:00:00Z')

    console.log('✅ Cache records found:', cacheData?.length || 0)
    console.log('✅ Bookable providers found:', providers?.length || 0)
    console.log('✅ Existing appointments on Oct 4:', existingAppts?.length || 0)

    return NextResponse.json({
      success: true,
      targetDate: '2025-10-04',
      cacheRecords: cacheData || [],
      bookableProviders: providers || [],
      existingAppointments: existingAppts || [],
      analysis: {
        totalCacheRecords: cacheData?.length || 0,
        totalBookableProviders: providers?.length || 0,
        totalExistingAppointments: existingAppts?.length || 0,
        providersWithCache: cacheData?.filter(c => c.providers?.is_bookable).length || 0,
        providersWithoutCache: (providers?.length || 0) - (cacheData?.length || 0)
      }
    })

  } catch (error: any) {
    console.error('❌ Investigation failed:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
