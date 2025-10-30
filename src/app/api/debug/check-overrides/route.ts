// Debug endpoint to check manual_overrides table
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const columnName = searchParams.get('column_name')

    let query = supabaseAdmin
      .from('manual_overrides')
      .select('*')
      .eq('scope', 'appointment')
      .order('changed_at', { ascending: false })
      .limit(20)

    if (columnName) {
      query = query.eq('column_name', columnName)
    }

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    // Also get total count by column_name
    const { data: summary, error: summaryError } = await supabaseAdmin
      .from('manual_overrides')
      .select('column_name')
      .eq('scope', 'appointment')

    const columnCounts: Record<string, number> = {}
    if (summary) {
      summary.forEach((row: any) => {
        columnCounts[row.column_name] = (columnCounts[row.column_name] || 0) + 1
      })
    }

    return NextResponse.json({
      success: true,
      total_overrides: summary?.length || 0,
      overrides_by_column: columnCounts,
      recent_overrides: data
    })

  } catch (error: any) {
    console.error('Check overrides error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
