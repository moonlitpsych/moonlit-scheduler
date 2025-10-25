import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    console.log('🔍 Checking provider IDs from database...')

    // Get providers directly from database
    const { data: providers, error } = await supabaseAdmin
      .from('providers')
      .select('id, first_name, last_name, role, is_active')
      .order('last_name')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Format for easy comparison
    const formatted = providers?.map(p => ({
      id: p.id,
      name: `${p.first_name} ${p.last_name}`,
      role: p.role,
      is_active: p.is_active
    }))

    return NextResponse.json({
      success: true,
      count: providers?.length || 0,
      providers: formatted
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
