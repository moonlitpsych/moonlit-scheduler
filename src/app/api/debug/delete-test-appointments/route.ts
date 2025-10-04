import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function POST() {
  // Delete all test appointments
  const { data, error } = await supabase
    .from('appointments')
    .delete()
    .eq('is_test', true)
    .select('id')

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    message: `Deleted ${data?.length || 0} test appointments`,
    deleted_ids: data?.map(a => a.id)
  })
}
