import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const { data: providers, error } = await supabaseAdmin
      .from('providers')
      .select('id, first_name, last_name, role, title, npi, is_active')
      .or('first_name.ilike.%kyle%,last_name.ilike.%roller%')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, providers })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
