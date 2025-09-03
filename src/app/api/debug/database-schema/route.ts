// Database Schema Inspector API
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Inspecting database schema...')

    // Get all tables in the public schema
    const { data: tables, error: tablesError } = await supabaseAdmin
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .order('table_name')

    if (tablesError) {
      console.error('❌ Error fetching tables:', tablesError)
    }

    // Get detailed schema information
    const schemaInfo: any = {
      total_tables: tables?.length || 0,
      tables: {}
    }

    // Check specific tables we're interested in
    const tablesToInspect = [
      'partners',
      'organizations', 
      'partner_users',
      'partner_organizations',
      'scheduler_audit_logs',
      'providers',
      'patients',
      'appointments',
      'payers'
    ]

    for (const tableName of tablesToInspect) {
      try {
        // Get columns for this table
        const { data: columns, error: columnsError } = await supabaseAdmin
          .from('information_schema.columns')
          .select('column_name, data_type, is_nullable, column_default')
          .eq('table_schema', 'public')
          .eq('table_name', tableName)
          .order('ordinal_position')

        if (columnsError) {
          schemaInfo.tables[tableName] = { error: columnsError.message, exists: false }
        } else if (columns && columns.length > 0) {
          // Get row count
          const { count, error: countError } = await supabaseAdmin
            .from(tableName)
            .select('*', { count: 'exact', head: true })

          schemaInfo.tables[tableName] = {
            exists: true,
            columns: columns,
            row_count: countError ? 'Error counting rows' : count || 0
          }
        } else {
          schemaInfo.tables[tableName] = { exists: false, error: 'Table not found' }
        }
      } catch (error: any) {
        schemaInfo.tables[tableName] = { 
          exists: false, 
          error: error.message || 'Unknown error' 
        }
      }
    }

    // Check for partner-related tables
    const partnerTables = tables?.filter(t => 
      t.table_name.includes('partner') || 
      t.table_name.includes('organization')
    ) || []

    console.log('✅ Schema inspection complete')
    console.log('📊 Found tables:', tables?.map(t => t.table_name).slice(0, 10))
    console.log('🏢 Partner-related tables:', partnerTables.map(t => t.table_name))

    return NextResponse.json({
      success: true,
      data: {
        ...schemaInfo,
        all_tables: tables?.map(t => t.table_name) || [],
        partner_related_tables: partnerTables.map(t => t.table_name)
      }
    })

  } catch (error: any) {
    console.error('❌ Schema inspection error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to inspect database schema',
        details: error.message
      },
      { status: 500 }
    )
  }
}