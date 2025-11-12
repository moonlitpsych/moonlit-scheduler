import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Missing Supabase credentials' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get the table name from query params
    const { searchParams } = new URL(request.url)
    const tableName = searchParams.get('table') || 'provider_plan_overrides'

    // Query to get column information
    const { data: columns, error: columnsError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable, column_default, udt_name')
      .eq('table_schema', 'public')
      .eq('table_name', tableName)
      .order('ordinal_position')

    // If that doesn't work, try a raw SQL approach via a sample select
    const { data: sample, error: sampleError } = await supabase
      .from(tableName)
      .select('*')
      .limit(0)

    return NextResponse.json({
      table_name: tableName,
      columns,
      columns_error: columnsError?.message,
      sample_structure: sample,
      sample_error: sampleError?.message
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message, stack: error.stack },
      { status: 500 }
    )
  }
}
