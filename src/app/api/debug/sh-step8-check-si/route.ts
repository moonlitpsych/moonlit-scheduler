// Debug Step 8: Check what payer the current service_instance belongs to
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const serviceInstanceId = '12191f44-a09c-426f-8e22-0c5b8e57b3b7'

    const { data: si, error } = await supabaseAdmin
      .from('service_instances')
      .select(`
        *,
        service:services!service_instances_service_id_fkey(id, name, description),
        payer:payers!service_instances_payer_id_fkey(id, name, state)
      `)
      .eq('id', serviceInstanceId)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      service_instance: si,
      note: si ? `This service_instance belongs to payer: ${si.payer?.name || 'UNKNOWN'}` : 'Service instance not found'
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
