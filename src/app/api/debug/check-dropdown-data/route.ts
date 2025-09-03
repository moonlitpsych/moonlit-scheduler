// Debug endpoint to check what types and statuses actually exist in database
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Checking actual dropdown data from database...')

    // Get unique organization types from database
    const { data: orgs, error: orgsError } = await supabaseAdmin
      .from('organizations')
      .select('type, status, name')
      .limit(100)

    if (orgsError) {
      console.error('Error fetching organizations:', orgsError)
      return NextResponse.json({ error: orgsError.message }, { status: 500 })
    }

    // Extract unique types and statuses
    const actualTypes = [...new Set(orgs?.map(o => o.type).filter(Boolean))] || []
    const actualStatuses = [...new Set(orgs?.map(o => o.status).filter(Boolean))] || []
    
    // Count occurrences
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

    // Check what's hardcoded in the frontend
    const hardcodedTypes = [
      'healthcare_partner',
      'treatment_center', 
      'rehabilitation',
      'mental_health',
      'substance_abuse',
      'other'
    ]

    const hardcodedStatuses = [
      'active',
      'inactive', 
      'suspended'
    ]

    return NextResponse.json({
      database_reality: {
        total_organizations: orgs?.length || 0,
        actual_types: actualTypes,
        actual_statuses: actualStatuses,
        type_counts: typeCounts,
        status_counts: statusCounts
      },
      frontend_dropdowns: {
        hardcoded_types: hardcodedTypes,
        hardcoded_statuses: hardcodedStatuses
      },
      analysis: {
        types_match: actualTypes.every(t => hardcodedTypes.includes(t)),
        statuses_match: actualStatuses.every(s => hardcodedStatuses.includes(s)),
        missing_from_dropdown: {
          types: actualTypes.filter(t => !hardcodedTypes.includes(t)),
          statuses: actualStatuses.filter(s => !hardcodedStatuses.includes(s))
        },
        unused_dropdown_options: {
          types: hardcodedTypes.filter(t => !actualTypes.includes(t)),
          statuses: hardcodedStatuses.filter(s => !actualStatuses.includes(s))
        }
      },
      recommendation: getDynamicDropdownRecommendation(actualTypes, actualStatuses, hardcodedTypes, hardcodedStatuses)
    })

  } catch (error: any) {
    console.error('❌ Dropdown data check error:', error)
    
    return NextResponse.json({
      error: 'Failed to check dropdown data',
      details: error.message
    }, { status: 500 })
  }
}

function getDynamicDropdownRecommendation(
  actualTypes: string[], 
  actualStatuses: string[], 
  hardcodedTypes: string[], 
  hardcodedStatuses: string[]
) {
  const issues = []
  
  // Check for database values not in dropdown
  const missingTypes = actualTypes.filter(t => !hardcodedTypes.includes(t))
  const missingStatuses = actualStatuses.filter(s => !hardcodedStatuses.includes(s))
  
  if (missingTypes.length > 0) {
    issues.push(`Database has types not in dropdown: ${missingTypes.join(', ')}`)
  }
  
  if (missingStatuses.length > 0) {
    issues.push(`Database has statuses not in dropdown: ${missingStatuses.join(', ')}`)
  }
  
  // Check for dropdown values not in database
  const unusedTypes = hardcodedTypes.filter(t => !actualTypes.includes(t))
  const unusedStatuses = hardcodedStatuses.filter(s => !actualStatuses.includes(s))
  
  if (unusedTypes.length > 0) {
    issues.push(`Dropdown has unused type options: ${unusedTypes.join(', ')}`)
  }
  
  if (unusedStatuses.length > 0) {
    issues.push(`Dropdown has unused status options: ${unusedStatuses.join(', ')}`)
  }
  
  if (issues.length === 0) {
    return "✅ Dropdowns perfectly match database reality"
  } else {
    return "⚠️ Issues found: " + issues.join(' | ') + " | Recommendation: Make dropdowns dynamic by querying database for actual values"
  }
}