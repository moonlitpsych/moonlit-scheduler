// Debug endpoint to check organization and partner data for sorting
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Checking organization data for sorting...')

    // Get organizations count
    const { count: orgCount } = await supabaseAdmin
      .from('organizations')
      .select('*', { count: 'exact', head: true })

    // Get sample organizations with dates
    const { data: orgs } = await supabaseAdmin
      .from('organizations')
      .select('id, name, created_at, updated_at')
      .limit(5)

    // Get partners count
    const { count: partnerCount } = await supabaseAdmin
      .from('partners')
      .select('*', { count: 'exact', head: true })

    // Get sample partners with dates
    const { data: partners } = await supabaseAdmin
      .from('partners')
      .select('id, name, organization_id, created_at, updated_at')
      .limit(5)

    // Get partner users count
    const { count: userCount } = await supabaseAdmin
      .from('partner_users')
      .select('*', { count: 'exact', head: true })

    return NextResponse.json({
      counts: {
        organizations: orgCount || 0,
        partners: partnerCount || 0,
        partner_users: userCount || 0
      },
      sample_data: {
        organizations: orgs || [],
        partners: partners || []
      },
      sorting_analysis: {
        has_orgs_to_sort: (orgCount || 0) > 1,
        has_date_variety: orgs ? checkDateVariety(orgs) : false,
        has_partners_for_activity: (partnerCount || 0) > 0,
        recommendations: getSortingRecommendations(orgCount || 0, partnerCount || 0)
      }
    })

  } catch (error: any) {
    console.error('❌ Org data check error:', error)
    
    return NextResponse.json({
      error: 'Failed to check organization data',
      details: error.message
    }, { status: 500 })
  }
}

function checkDateVariety(orgs: any[]) {
  if (orgs.length < 2) return false
  
  const dates = orgs.map(o => new Date(o.updated_at).getTime())
  const minDate = Math.min(...dates)
  const maxDate = Math.max(...dates)
  
  // If there's more than 1 hour difference, there's variety
  return (maxDate - minDate) > (60 * 60 * 1000)
}

function getSortingRecommendations(orgCount: number, partnerCount: number) {
  const recs = []
  
  if (orgCount === 0) {
    recs.push("No organizations found - need to add organizations to test sorting")
  } else if (orgCount === 1) {
    recs.push("Only 1 organization - need multiple organizations to see sorting differences")
  } else {
    recs.push(`Found ${orgCount} organizations - sorting should work for name/date fields`)
  }
  
  if (partnerCount === 0) {
    recs.push("No partners found - 'Most Recent Activity' sorting will be same as 'Most Recently Updated'")
  } else {
    recs.push(`Found ${partnerCount} partners - activity-based sorting should work`)
  }
  
  return recs
}