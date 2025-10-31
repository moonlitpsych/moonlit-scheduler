import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()

  try {
    const { sql } = await request.json()

    if (!sql) {
      return NextResponse.json({ error: 'SQL required' }, { status: 400 })
    }

    // Execute the SQL using the Supabase client with service role
    const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql })

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message,
        details: error
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
