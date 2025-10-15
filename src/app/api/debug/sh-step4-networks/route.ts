// Debug Step 4: Get provider_payer_networks for SelectHealth
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

    // Get all networks for SelectHealth
    const { data: networks, error } = await supabaseAdmin
      .from('provider_payer_networks')
      .select(`
        *,
        provider:providers!provider_payer_networks_provider_id_fkey(id, first_name, last_name, email),
        payer:payers!provider_payer_networks_payer_id_fkey(id, name)
      `)
      .eq('payer_id', shData.id)
      .order('updated_at', { ascending: false })

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      selecthealth_id: shData.id,
      selecthealth_name: shData.name,
      networks,
      count: networks?.length || 0
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
