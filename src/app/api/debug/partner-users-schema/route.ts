// Debug API to check partner_users table schema
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Checking partner_users table schema...')
    
    // Try to get the table information from Supabase
    const { data, error } = await supabaseAdmin
      .from('partner_users')
      .select('*')
      .limit(1)
    
    if (error) {
      console.error('❌ Error querying partner_users:', error)
      
      // Try a simpler query to get table structure info
      try {
        const { data: emptyResult, error: emptyError } = await supabaseAdmin
          .from('partner_users')
          .select()
          .limit(0)
          
        return NextResponse.json({
          success: true,
          table_exists: !emptyError,
          error: error.message,
          empty_query_error: emptyError?.message,
          suggestion: "The table exists but the columns being queried don't match the actual table schema"
        })
      } catch (innerErr: any) {
        return NextResponse.json({
          success: false,
          table_exists: false,
          error: error.message,
          inner_error: innerErr.message
        })
      }
    }
    
    console.log('✅ partner_users query successful:', data)
    
    return NextResponse.json({
      success: true,
      table_exists: true,
      row_count: data?.length || 0,
      sample_data: data || [],
      columns: data?.[0] ? Object.keys(data[0]) : [],
      note: "Table exists and is queryable"
    })
    
  } catch (error: any) {
    console.error('❌ Error checking partner_users schema:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to check partner_users table',
        details: error.message
      },
      { status: 500 }
    )
  }
}