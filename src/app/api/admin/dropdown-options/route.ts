// Dynamic dropdown options API - pulls actual values from database
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isAdminEmail } from '@/lib/admin-auth'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

async function verifyAdminAccess() {
  try {
    const supabase = createServerComponentClient({ cookies })
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user || !isAdminEmail(user.email || '')) {
      return { authorized: false, user: null }
    }
    
    return { authorized: true, user }
  } catch (error) {
    console.error('Admin verification error:', error)
    return { authorized: false, user: null }
  }
}

export async function GET(request: NextRequest) {
  try {
    // Verify admin access
    const { authorized } = await verifyAdminAccess()
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    console.log('🔍 Fetching dynamic dropdown options from database...')

    // Get all unique types and statuses from database
    const { data: orgs, error: orgsError } = await supabaseAdmin
      .from('organizations')
      .select('type, status')

    if (orgsError) {
      console.error('❌ Error fetching organizations for dropdowns:', orgsError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch dropdown options' },
        { status: 500 }
      )
    }

    // Extract unique values and filter out nulls
    const actualTypes = [...new Set(orgs?.map(o => o.type).filter(Boolean))] || []
    const actualStatuses = [...new Set(orgs?.map(o => o.status).filter(Boolean))] || []

    // Get counts for each option
    const typeCounts: Record<string, number> = {}
    const statusCounts: Record<string, number> = {}
    
    orgs?.forEach(org => {
      if (org.type) {
        typeCounts[org.type] = (typeCounts[org.type] || 0) + 1
      }
      if (org.status) {
        statusCounts[org.status] = (statusCounts[org.status] || 0) + 1
      }
    })

    // Schema-defined options (what SHOULD be in database)
    const schemaTypes = [
      'healthcare_partner',
      'treatment_center', 
      'rehabilitation',
      'mental_health',
      'substance_abuse',
      'other'
    ]

    const schemaStatuses = [
      'active',
      'inactive', 
      'suspended'
    ]

    console.log(`✅ Found ${actualTypes.length} actual types, ${actualStatuses.length} actual statuses`)

    return NextResponse.json({
      success: true,
      data: {
        // Actual values from database (for dropdowns)
        actual_options: {
          types: actualTypes.sort(),
          statuses: actualStatuses.sort()
        },
        // Schema-defined values (what should be)
        schema_options: {
          types: schemaTypes,
          statuses: schemaStatuses
        },
        // Counts for context
        counts: {
          type_counts: typeCounts,
          status_counts: statusCounts
        },
        // Analysis
        analysis: {
          schema_mismatch: {
            types: !actualTypes.every(t => schemaTypes.includes(t)),
            statuses: !actualStatuses.every(s => schemaStatuses.includes(s))
          },
          recommendations: getRecommendations(actualTypes, actualStatuses, schemaTypes, schemaStatuses)
        }
      }
    })

  } catch (error: any) {
    console.error('❌ Dropdown options API error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch dropdown options',
        details: error.message
      },
      { status: 500 }
    )
  }
}

function getRecommendations(
  actualTypes: string[], 
  actualStatuses: string[], 
  schemaTypes: string[], 
  schemaStatuses: string[]
) {
  const recs = []
  
  const nonSchemaTypes = actualTypes.filter(t => !schemaTypes.includes(t))
  const nonSchemaStatuses = actualStatuses.filter(s => !schemaStatuses.includes(s))
  
  if (nonSchemaTypes.length > 0) {
    recs.push(`Database has non-schema types: ${nonSchemaTypes.join(', ')} - consider data cleanup or schema update`)
  }
  
  if (nonSchemaStatuses.length > 0) {
    recs.push(`Database has non-schema statuses: ${nonSchemaStatuses.join(', ')} - consider data cleanup or schema update`)
  }
  
  if (actualTypes.length === 0) {
    recs.push("No organization types found - database may need initial data")
  }
  
  if (actualStatuses.length === 0) {
    recs.push("No organization statuses found - database may need initial data")
  }
  
  return recs
}