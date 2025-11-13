// Debug endpoint to check which affiliation tables exist
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    console.log('🔍 Checking affiliation table existence...')

    const results: any = {
      timestamp: new Date().toISOString(),
      checks: []
    }

    // Check 1: Try patient_affiliations
    try {
      const { data, error } = await supabaseAdmin
        .from('patient_organization_affiliations')
        .select('*', { count: 'exact', head: true })

      results.checks.push({
        table: 'patient_affiliations',
        exists: !error,
        error: error?.message || null,
        count: data !== null ? 'accessible' : 'not accessible'
      })
    } catch (e: any) {
      results.checks.push({
        table: 'patient_affiliations',
        exists: false,
        error: e.message
      })
    }

    // Check 2: Try patient_organization_affiliations
    try {
      const { data, error, count } = await supabaseAdmin
        .from('patient_organization_affiliations')
        .select('*', { count: 'exact', head: true })

      results.checks.push({
        table: 'patient_organization_affiliations',
        exists: !error,
        error: error?.message || null,
        count: count
      })
    } catch (e: any) {
      results.checks.push({
        table: 'patient_organization_affiliations',
        exists: false,
        error: e.message
      })
    }

    // Check 3: Query information_schema
    try {
      const { data, error } = await supabaseAdmin
        .rpc('exec_sql', {
          sql: `
            SELECT table_name, table_type
            FROM information_schema.tables
            WHERE table_name LIKE '%affiliation%'
            AND table_schema = 'public'
            ORDER BY table_name
          `
        })

      results.schema_query = {
        success: !error,
        tables: data,
        error: error?.message || null
      }
    } catch (e: any) {
      // RPC might not exist - that's OK
      results.schema_query = {
        success: false,
        note: 'exec_sql RPC not available',
        error: e.message
      }
    }

    return NextResponse.json({
      success: true,
      data: results
    })

  } catch (error: any) {
    console.error('❌ Debug endpoint error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    )
  }
}
