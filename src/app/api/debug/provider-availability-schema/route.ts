import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    // Query the table to see what columns exist
    const { data: sampleRows, error } = await supabaseAdmin
      .from('provider_availability')
      .select('*')
      .limit(5)

    return NextResponse.json({
      success: true,
      sample_rows: sampleRows,
      columns: sampleRows && sampleRows.length > 0 ? Object.keys(sampleRows[0]) : [],
      row_count: sampleRows?.length || 0,
      error_if_any: error?.message
    })

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
