// Debug Step 6: Get Privratsky's availability cache
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    // First get Privratsky ID
    const { data: privData } = await supabaseAdmin
      .from('providers')
      .select('id, first_name, last_name')
      .ilike('last_name', '%privratsky%')
      .single()

    if (!privData) {
      return NextResponse.json({ success: false, error: 'Privratsky not found' }, { status: 404 })
    }

    // Get cache for next 60 days
    const today = new Date().toISOString().split('T')[0]
    const in60Days = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const { data: cache, error } = await supabaseAdmin
      .from('provider_availability_cache')
      .select('*')
      .eq('provider_id', privData.id)
      .gte('date', today)
      .lte('date', in60Days)
      .order('date')

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    // Group by service_instance_id
    const byServiceInstance: any = {}
    ;(cache || []).forEach(row => {
      const sid = row.service_instance_id || 'null'
      if (!byServiceInstance[sid]) {
        byServiceInstance[sid] = { count: 0, slots: 0, dates: [] }
      }
      byServiceInstance[sid].count++
      byServiceInstance[sid].slots += (row.slot_count || 0)
      byServiceInstance[sid].dates.push(row.date)
    })

    return NextResponse.json({
      success: true,
      provider_id: privData.id,
      provider_name: `${privData.first_name} ${privData.last_name}`,
      cache,
      date_count: cache?.length || 0,
      total_slots: (cache || []).reduce((sum, row) => sum + (row.slot_count || 0), 0),
      by_service_instance: byServiceInstance
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
