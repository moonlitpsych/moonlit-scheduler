// Simple API to list partner and organization data for cleanup review
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    console.log('📋 Listing all partner and organization data for cleanup review...')
    
    // 1. Get all organizations
    const { data: allOrgs, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('id, name, slug, status, created_at')
      .order('created_at', { ascending: false })
      .limit(20)
    
    if (orgError) {
      console.error('Error fetching organizations:', orgError)
    }

    // 2. Get all partner users
    const { data: allUsers, error: userError } = await supabaseAdmin
      .from('partner_users')
      .select('id, first_name, last_name, email, organization_id, status, created_at')
      .order('created_at', { ascending: false })
      .limit(20)
    
    if (userError) {
      console.error('Error fetching partner users:', userError)
    }

    // 3. Get count of patient affiliations
    const { count: affiliationCount, error: affiliationError } = await supabaseAdmin
      .from('patient_organization_affiliations')
      .select('*', { count: 'exact', head: true })
    
    if (affiliationError) {
      console.error('Error counting patient affiliations:', affiliationError)
    }

    const summary = {
      organizations: allOrgs || [],
      partner_users: allUsers || [],
      organization_count: allOrgs?.length || 0,
      partner_user_count: allUsers?.length || 0,
      patient_affiliation_count: affiliationCount || 0,
      recommendation: 'Review the data above. Any organizations or users with test/demo/sample names should be deleted before importing real data.'
    }

    console.log('📊 Data summary:')
    console.log(`  - Organizations: ${allOrgs?.length || 0}`)
    console.log(`  - Partner users: ${allUsers?.length || 0}`)
    console.log(`  - Patient affiliations: ${affiliationCount || 0}`)

    return NextResponse.json({
      success: true,
      data: summary,
      message: 'Partner data listing completed'
    })

  } catch (error: any) {
    console.error('❌ Data listing error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list partner data',
        details: error.message
      },
      { status: 500 }
    )
  }
}

// DELETE endpoint to remove specific organizations/users by ID
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { organization_ids, partner_user_ids } = body
    
    console.log('🗑️  Deleting specified partner data...', { organization_ids, partner_user_ids })
    
    let deletedCount = 0
    const results: string[] = []

    // Delete patient affiliations first
    if (organization_ids && organization_ids.length > 0) {
      const { count: deletedAffiliations, error: affiliationError } = await supabaseAdmin
        .from('patient_organization_affiliations')
        .delete({ count: 'exact' })
        .in('organization_id', organization_ids)
      
      if (affiliationError) {
        console.error('Error deleting patient affiliations:', affiliationError)
        results.push(`Error deleting patient affiliations: ${affiliationError.message}`)
      } else {
        deletedCount += deletedAffiliations || 0
        results.push(`✅ Deleted ${deletedAffiliations || 0} patient affiliations`)
      }
    }

    // Delete partner users
    if (partner_user_ids && partner_user_ids.length > 0) {
      const { count: deletedUsers, error: userError } = await supabaseAdmin
        .from('partner_users')
        .delete({ count: 'exact' })
        .in('id', partner_user_ids)
      
      if (userError) {
        console.error('Error deleting partner users:', userError)
        results.push(`Error deleting partner users: ${userError.message}`)
      } else {
        deletedCount += deletedUsers || 0
        results.push(`✅ Deleted ${deletedUsers || 0} partner users`)
      }
    }

    // Delete organizations last
    if (organization_ids && organization_ids.length > 0) {
      const { count: deletedOrgs, error: orgError } = await supabaseAdmin
        .from('organizations')
        .delete({ count: 'exact' })
        .in('id', organization_ids)
      
      if (orgError) {
        console.error('Error deleting organizations:', orgError)
        results.push(`Error deleting organizations: ${orgError.message}`)
      } else {
        deletedCount += deletedOrgs || 0
        results.push(`✅ Deleted ${deletedOrgs || 0} organizations`)
      }
    }

    console.log('🎉 Selective deletion completed!')
    results.forEach(result => console.log(result))

    return NextResponse.json({
      success: true,
      data: {
        deleted_count: deletedCount,
        results: results
      },
      message: `Successfully deleted ${deletedCount} items`
    })

  } catch (error: any) {
    console.error('❌ Selective deletion error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete specified data',
        details: error.message
      },
      { status: 500 }
    )
  }
}