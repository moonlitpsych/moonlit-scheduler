// Simple Database Schema Check
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Checking for partner dashboard tables...')

    const schemaInfo: any = {
      tables_checked: [],
      existing_tables: [],
      missing_tables: []
    }

    // Tables we expect for the partner dashboard
    const expectedTables = [
      'partners',
      'organizations', 
      'partner_users',
      'scheduler_audit_logs',
      'providers',
      'patients',
      'appointments',
      'payers',
      'provider_payer_networks'
    ]

    for (const tableName of expectedTables) {
      schemaInfo.tables_checked.push(tableName)
      
      try {
        // Try to query the table to see if it exists
        const { data, error, count } = await supabaseAdmin
          .from(tableName)
          .select('*', { count: 'exact', head: true })

        if (error) {
          if (error.code === '42P01' || error.message.includes('does not exist')) {
            schemaInfo.missing_tables.push({
              table: tableName,
              status: 'missing',
              error: 'Table does not exist'
            })
          } else {
            schemaInfo.missing_tables.push({
              table: tableName,
              status: 'error',
              error: error.message
            })
          }
        } else {
          schemaInfo.existing_tables.push({
            table: tableName,
            status: 'exists',
            row_count: count || 0
          })
        }
      } catch (error: any) {
        schemaInfo.missing_tables.push({
          table: tableName,
          status: 'error',
          error: error.message
        })
      }
    }

    // Try to get some sample data from existing tables
    const sampleData: any = {}
    for (const tableInfo of schemaInfo.existing_tables) {
      try {
        const { data } = await supabaseAdmin
          .from(tableInfo.table)
          .select('*')
          .limit(1)

        if (data && data.length > 0) {
          sampleData[tableInfo.table] = {
            sample_columns: Object.keys(data[0]),
            sample_record: data[0]
          }
        }
      } catch (error) {
        // Ignore errors for sample data
      }
    }

    console.log('✅ Schema check complete')
    console.log('📊 Existing tables:', schemaInfo.existing_tables.map((t: any) => t.table))
    console.log('❌ Missing tables:', schemaInfo.missing_tables.map((t: any) => t.table))

    return NextResponse.json({
      success: true,
      data: {
        ...schemaInfo,
        summary: {
          total_checked: expectedTables.length,
          existing_count: schemaInfo.existing_tables.length,
          missing_count: schemaInfo.missing_tables.length
        },
        sample_data: sampleData
      }
    })

  } catch (error: any) {
    console.error('❌ Schema check error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to check database schema',
        details: error.message
      },
      { status: 500 }
    )
  }
}