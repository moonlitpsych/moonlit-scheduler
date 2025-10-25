import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const { data: providers, error } = await supabaseAdmin
      .from('providers')
      .select('id, first_name, last_name, provider_type, is_active')
      .eq('is_active', true)
      .order('last_name')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      providers: providers?.map(p => ({
        id: p.id,
        name: `${p.first_name} ${p.last_name}`,
        provider_type: p.provider_type
      }))
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
