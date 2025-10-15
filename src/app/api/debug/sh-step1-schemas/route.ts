// Debug Step 1: Get table schemas
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const schemas: any = {}

    // Get payers table structure by querying it
    const { data: payerSample } = await supabaseAdmin
      .from('payers')
      .select('*')
      .limit(1)
      .single()

    if (payerSample) {
      schemas.payers = Object.keys(payerSample)
    }

    // Get providers table structure
    const { data: providerSample } = await supabaseAdmin
      .from('providers')
      .select('*')
      .limit(1)
      .single()

    if (providerSample) {
      schemas.providers = Object.keys(providerSample)
    }

    // Get provider_payer_networks table structure
    const { data: networkSample } = await supabaseAdmin
      .from('provider_payer_networks')
      .select('*')
      .limit(1)
      .single()

    if (networkSample) {
      schemas.provider_payer_networks = Object.keys(networkSample)
    }

    // Get service_instances table structure
    const { data: serviceSample } = await supabaseAdmin
      .from('service_instances')
      .select('*')
      .limit(1)
      .single()

    if (serviceSample) {
      schemas.service_instances = Object.keys(serviceSample)
    }

    // Get provider_availability_cache table structure
    const { data: cacheSample } = await supabaseAdmin
      .from('provider_availability_cache')
      .select('*')
      .limit(1)
      .single()

    if (cacheSample) {
      schemas.provider_availability_cache = Object.keys(cacheSample)
    }

    // Get view structure
    const { data: viewSample } = await supabaseAdmin
      .from('v_bookable_provider_payer')
      .select('*')
      .limit(1)
      .single()

    if (viewSample) {
      schemas.v_bookable_provider_payer = Object.keys(viewSample)
    }

    return NextResponse.json({ success: true, schemas })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
