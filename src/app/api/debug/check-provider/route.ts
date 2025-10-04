import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function GET(request: NextRequest) {
  const providerId = request.nextUrl.searchParams.get('id') || '9b093465-e514-4d9f-8c45-22dcd0eb1811'

  const { data, error } = await supabase
    .from('providers')
    .select('*')
    .eq('id', providerId)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }

  return NextResponse.json({ provider: data })
}
