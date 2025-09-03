// Debug endpoint to check if a provider is being used in other tables
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const providerId = searchParams.get('provider_id')
    
    if (!providerId) {
      return NextResponse.json({
        error: 'provider_id parameter required'
      }, { status: 400 })
    }

    console.log(`🔍 Checking provider usage: ${providerId}`)

    // Check for appointments
    const { data: appointments, error: appointmentsError } = await supabaseAdmin
      .from('appointments')
      .select('id, start_time, patient_id')
      .eq('provider_id', providerId)
      .limit(5) // Just get a few examples

    // Check for availability records
    const { data: availability, error: availabilityError } = await supabaseAdmin
      .from('provider_availability')
      .select('id, day_of_week, start_time, end_time')
      .eq('provider_id', providerId)
      .limit(5)

    // Check for availability cache
    const { data: availabilityCache, error: cacheError } = await supabaseAdmin
      .from('provider_availability_cache')
      .select('id, date, available_slots')
      .eq('provider_id', providerId)
      .limit(5)

    // Check for exceptions
    const { data: exceptions, error: exceptionsError } = await supabaseAdmin
      .from('availability_exceptions')
      .select('id, exception_date, exception_type')
      .eq('provider_id', providerId)
      .limit(5)

    // Check for payer networks
    const { data: payerNetworks, error: payerError } = await supabaseAdmin
      .from('provider_payer_networks')
      .select('id, payer_id, status')
      .eq('provider_id', providerId)
      .limit(5)

    // Get provider info
    const { data: provider, error: providerError } = await supabaseAdmin
      .from('providers')
      .select('id, first_name, last_name, email, is_bookable, specialty')
      .eq('id', providerId)
      .single()

    return NextResponse.json({
      provider_id: providerId,
      provider_info: provider,
      usage: {
        appointments: {
          count: appointments?.length || 0,
          records: appointments || [],
          error: appointmentsError?.message || null
        },
        availability: {
          count: availability?.length || 0,
          records: availability || [],
          error: availabilityError?.message || null
        },
        availability_cache: {
          count: availabilityCache?.length || 0,
          records: availabilityCache || [],
          error: cacheError?.message || null
        },
        exceptions: {
          count: exceptions?.length || 0,
          records: exceptions || [],
          error: exceptionsError?.message || null
        },
        payer_networks: {
          count: payerNetworks?.length || 0,
          records: payerNetworks || [],
          error: payerError?.message || null
        }
      }
    })

  } catch (error: any) {
    console.error('❌ Provider usage check error:', error)
    
    return NextResponse.json({
      error: 'Failed to check provider usage',
      details: error.message
    }, { status: 500 })
  }
}