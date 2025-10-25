import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    // Get one provider with all fields to see the schema
    const { data: sample, error } = await supabaseAdmin
      .from('providers')
      .select('*')
      .eq('first_name', 'Anthony')
      .eq('last_name', 'Privratsky')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Also get all providers with just key fields
    const { data: allProviders, error: allError } = await supabaseAdmin
      .from('providers')
      .select('id, first_name, last_name, role, title, is_active')
      .order('last_name')

    if (allError) {
      return NextResponse.json({ error: allError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      sample_provider: sample,
      all_providers: allProviders
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
