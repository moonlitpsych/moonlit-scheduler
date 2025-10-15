// Debug Step 5: Get service_instances for SelectHealth
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    // First get SelectHealth ID
    const { data: shData } = await supabaseAdmin
      .from('payers')
      .select('id, name')
      .ilike('name', '%selecthealth%')
      .single()

    if (!shData) {
      return NextResponse.json({ success: false, error: 'SelectHealth not found' }, { status: 404 })
    }

    // Get all service instances for SelectHealth
    const { data: instances, error } = await supabaseAdmin
      .from('service_instances')
      .select(`
        *,
        service:services!service_instances_service_id_fkey(id, name, description)
      `)
      .eq('payer_id', shData.id)

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      selecthealth_id: shData.id,
      selecthealth_name: shData.name,
      instances,
      count: instances?.length || 0
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
