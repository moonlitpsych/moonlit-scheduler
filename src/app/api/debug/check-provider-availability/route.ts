// Debug endpoint to check provider_availability table
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const privId = '504d53c6-54ef-40b0-81d4-80812c2c7bfd'

    const { data, error } = await supabaseAdmin
      .from('provider_availability')
      .select('*')
      .eq('provider_id', privId)
      .order('day_of_week')

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      provider_id: privId,
      provider_name: 'Anthony Privratsky',
      availability_rules: data,
      count: data?.length || 0
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
