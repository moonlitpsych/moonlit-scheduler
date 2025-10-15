// Debug endpoint for SelectHealth bookability diagnosis
// GET /api/debug/selecthealth-diagnosis

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Running SelectHealth diagnosis...')

    const diagnosis: any = {
      timestamp: new Date().toISOString(),
      schemas: {},
      selecthealth: {},
      privratsky: {},
      networks: {},
      services: {},
      cache: {},
      views: {}
    }

    // 1. Get table schemas
    console.log('📋 Step 1: Getting table schemas...')

    const tables = [
      'payers',
      'providers',
      'provider_payer_networks',
      'services',
      'service_instances',
      'provider_availability_cache'
    ]

    for (const table of tables) {
      const { data: columns, error } = await supabaseAdmin
        .from('information_schema.columns' as any)
        .select('column_name, data_type, is_nullable, column_default')
        .eq('table_name', table)
        .eq('table_schema', 'public')
        .order('ordinal_position')

      if (!error && columns) {
        diagnosis.schemas[table] = columns
      }
    }

    // 2. Get SelectHealth payer record
    console.log('📋 Step 2: Getting SelectHealth payer...')
    const { data: selectHealthRows, error: shError } = await supabaseAdmin
      .from('payers')
      .select('*')
      .ilike('name', '%selecthealth%')

    if (!shError && selectHealthRows && selectHealthRows.length > 0) {
      diagnosis.selecthealth.payer = selectHealthRows[0]
      diagnosis.selecthealth.all_matches = selectHealthRows
    } else {
      diagnosis.selecthealth.error = shError?.message || 'Not found'
    }

    // 3. Get Dr. Privratsky provider record
    console.log('📋 Step 3: Getting Dr. Privratsky provider...')
    const { data: privRows, error: privError } = await supabaseAdmin
      .from('providers')
      .select('*')
      .ilike('last_name', '%privratsky%')

    if (!privError && privRows && privRows.length > 0) {
      diagnosis.privratsky.provider = privRows[0]
      diagnosis.privratsky.all_matches = privRows
    } else {
      diagnosis.privratsky.error = privError?.message || 'Not found'
    }

    // 4. Get all provider_payer_networks for SelectHealth
    if (diagnosis.selecthealth.payer) {
      console.log('📋 Step 4: Getting provider_payer_networks for SelectHealth...')
      const { data: networks, error: netError } = await supabaseAdmin
        .from('provider_payer_networks')
        .select(`
          *,
          provider:providers!provider_payer_networks_provider_id_fkey(id, first_name, last_name, email),
          payer:payers!provider_payer_networks_payer_id_fkey(id, name)
        `)
        .eq('payer_id', diagnosis.selecthealth.payer.id)
        .order('updated_at', { ascending: false })

      if (!netError && networks) {
        diagnosis.networks.selecthealth_contracts = networks
        diagnosis.networks.count = networks.length
      } else {
        diagnosis.networks.error = netError?.message || 'Not found'
      }
    }

    // 5. Get service_instances for SelectHealth
    if (diagnosis.selecthealth.payer) {
      console.log('📋 Step 5: Getting service_instances for SelectHealth...')
      const { data: instances, error: instError } = await supabaseAdmin
        .from('service_instances')
        .select(`
          *,
          service:services!service_instances_service_id_fkey(id, name, description)
        `)
        .eq('payer_id', diagnosis.selecthealth.payer.id)

      if (!instError && instances) {
        diagnosis.services.selecthealth_instances = instances
        diagnosis.services.count = instances.length
      } else {
        diagnosis.services.error = instError?.message || 'Not found'
      }
    }

    // 6. Get Privratsky's availability cache for next 60 days
    if (diagnosis.privratsky.provider) {
      console.log('📋 Step 6: Getting Privratsky availability cache...')
      const today = new Date().toISOString().split('T')[0]
      const in60Days = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      const { data: cache, error: cacheError } = await supabaseAdmin
        .from('provider_availability_cache')
        .select('*')
        .eq('provider_id', diagnosis.privratsky.provider.id)
        .gte('date', today)
        .lte('date', in60Days)
        .order('date')

      if (!cacheError && cache) {
        diagnosis.cache.privratsky_slots = cache
        diagnosis.cache.date_count = cache.length
        diagnosis.cache.total_slots = cache.reduce((sum, row) => sum + (row.slot_count || 0), 0)

        // Group by service_instance_id to see distribution
        const byServiceInstance: any = {}
        cache.forEach(row => {
          const sid = row.service_instance_id || 'null'
          if (!byServiceInstance[sid]) {
            byServiceInstance[sid] = { count: 0, slots: 0, dates: [] }
          }
          byServiceInstance[sid].count++
          byServiceInstance[sid].slots += (row.slot_count || 0)
          byServiceInstance[sid].dates.push(row.date)
        })
        diagnosis.cache.by_service_instance = byServiceInstance
      } else {
        diagnosis.cache.error = cacheError?.message || 'Not found'
      }
    }

    // 7. Check canonical view schema
    console.log('📋 Step 7: Checking v_bookable_provider_payer view...')
    const { data: viewColumns, error: viewError } = await supabaseAdmin
      .from('information_schema.columns' as any)
      .select('column_name, data_type')
      .eq('table_name', 'v_bookable_provider_payer')
      .eq('table_schema', 'public')
      .order('ordinal_position')

    if (!viewError && viewColumns) {
      diagnosis.views.v_bookable_provider_payer_columns = viewColumns
    }

    // 8. Check if Privratsky + SelectHealth appears in the view
    if (diagnosis.privratsky.provider && diagnosis.selecthealth.payer) {
      console.log('📋 Step 8: Checking if Privratsky+SelectHealth in canonical view...')
      const { data: viewRow, error: viewRowError } = await supabaseAdmin
        .from('v_bookable_provider_payer')
        .select('*')
        .eq('provider_id', diagnosis.privratsky.provider.id)
        .eq('payer_id', diagnosis.selecthealth.payer.id)
        .maybeSingle()

      diagnosis.views.privratsky_selecthealth_in_view = viewRow || null
      if (viewRowError) {
        diagnosis.views.view_query_error = viewRowError.message
      }
    }

    // 9. Get ALL rows from view for SelectHealth
    if (diagnosis.selecthealth.payer) {
      console.log('📋 Step 9: Getting all providers bookable for SelectHealth from view...')
      const { data: viewRows, error: allViewError } = await supabaseAdmin
        .from('v_bookable_provider_payer')
        .select('*')
        .eq('payer_id', diagnosis.selecthealth.payer.id)

      if (!allViewError && viewRows) {
        diagnosis.views.all_selecthealth_bookable = viewRows
        diagnosis.views.count = viewRows.length
      } else {
        diagnosis.views.all_error = allViewError?.message
      }
    }

    console.log('✅ Diagnosis complete')

    return NextResponse.json({
      success: true,
      diagnosis
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    })

  } catch (error: any) {
    console.error('❌ Diagnosis error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to run diagnosis',
        details: error.message
      },
      { status: 500 }
    )
  }
}
