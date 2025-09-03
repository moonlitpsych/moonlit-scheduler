// Deep investigation of organization status data
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Deep investigation of organization status data...')

    // Get all organizations with their status field
    const { data: orgs, error: orgsError } = await supabaseAdmin
      .from('organizations')
      .select('id, name, status, type, created_at, updated_at')
      .limit(20) // Sample of 20 to see variety

    if (orgsError) {
      return NextResponse.json({ error: orgsError.message }, { status: 500 })
    }

    // Analyze status field specifically
    const statusAnalysis = orgs?.reduce((acc: any, org) => {
      const status = org.status || 'NULL'
      if (!acc[status]) {
        acc[status] = {
          count: 0,
          examples: []
        }
      }
      acc[status].count++
      if (acc[status].examples.length < 3) {
        acc[status].examples.push({
          id: org.id,
          name: org.name,
          created_at: org.created_at
        })
      }
      return acc
    }, {})

    // Get total count by status
    const { data: allOrgs } = await supabaseAdmin
      .from('organizations')
      .select('status')

    const totalStatusCounts = allOrgs?.reduce((acc: any, org) => {
      const status = org.status || 'NULL'
      acc[status] = (acc[status] || 0) + 1
      return acc
    }, {})

    // Check database schema/constraints for status field
    const { data: schemaInfo, error: schemaError } = await supabaseAdmin
      .rpc('get_table_schema', { table_name: 'organizations' })
      .single()

    return NextResponse.json({
      investigation: {
        sample_records: orgs?.map(o => ({
          name: o.name,
          status: o.status,
          type: o.type,
          created_at: o.created_at
        })),
        status_breakdown: statusAnalysis,
        total_status_counts: totalStatusCounts,
        total_organizations: allOrgs?.length || 0
      },
      database_info: {
        schema_info: schemaInfo || null,
        schema_error: schemaError?.message || null
      },
      questions_to_investigate: [
        "Are there NULL status values that should have real statuses?",
        "Is 'prospect' the default value being set somewhere?",
        "Should organizations have different statuses like 'active', 'inactive'?",
        "Is there a database constraint or default value forcing 'prospect'?"
      ]
    })

  } catch (error: any) {
    console.error('❌ Organization status investigation error:', error)
    
    return NextResponse.json({
      error: 'Failed to investigate organization status',
      details: error.message
    }, { status: 500 })
  }
}