import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ payerId: string }> }
) {
  const { payerId } = await params

  const { data, error } = await supabase
    .from('payer_plans')
    .select('id, plan_name, plan_type, is_default, is_active, notes')
    .eq('payer_id', payerId)
    .order('plan_name', { ascending: true })

  if (error) {
    console.error('❌ Failed to fetch payer plans:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, data: data || [] })
}
