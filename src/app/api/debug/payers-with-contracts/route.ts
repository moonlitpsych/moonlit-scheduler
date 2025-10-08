import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const { data: payers, error } = await supabaseAdmin
      .from('payers')
      .select(`
        id,
        name,
        payer_type,
        provider_payer_networks!inner(id)
      `)
      .order('name')

    if (error) throw error

    const uniquePayers = payers?.reduce((acc, payer) => {
      if (!acc.find(p => p.id === payer.id)) {
        acc.push({
          id: payer.id,
          name: payer.name,
          payer_type: payer.payer_type
        })
      }
      return acc
    }, [] as any[])

    return NextResponse.json({ success: true, payers: uniquePayers })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
