// Debug Step 3: Get Dr. Privratsky provider record
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('providers')
      .select('*')
      .ilike('last_name', '%privratsky%')

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      privratsky: data && data.length > 0 ? data[0] : null,
      all_matches: data
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
