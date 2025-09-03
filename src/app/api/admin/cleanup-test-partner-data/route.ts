// Admin API to cleanup test partner and organization data
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    console.log('🧹 Checking for test partner and organization data...')
    
    // 1. Find test organizations
    const { data: testOrgs, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('id, name, slug, status, created_at')
      .or(`name.ilike.%test%,name.ilike.%demo%,name.ilike.%sample%,slug.ilike.%test%,slug.ilike.%demo%`)
    
    if (orgError) {
      console.error('Error fetching organizations:', orgError)
    }

    // 2. Find test partner users
    const { data: testUsers, error: userError } = await supabaseAdmin
      .from('partner_users')
      .select('id, first_name, last_name, email, organization_id, status, created_at')
      .or(`email.ilike.%test%,email.ilike.%demo%,email.ilike.%sample%,first_name.ilike.%test%,last_name.ilike.%test%`)
    
    if (userError) {
      console.error('Error fetching partner users:', userError)
    }

    // 3. Find test patient affiliations
    let testAffiliations: any[] = []
    if (testOrgs && testOrgs.length > 0) {
      const testOrgIds = testOrgs.map(org => org.id)
      const { data: affiliations, error: affiliationError } = await supabaseAdmin
        .from('patient_affiliations')
        .select(`
          id,
          organization_id,
          status,
          created_at,
          patients(first_name, last_name, email)
        `)
        .in('organization_id', testOrgIds)
      
      if (affiliationError) {
        console.error('Error fetching patient affiliations:', affiliationError)
      } else {
        testAffiliations = affiliations || []
      }
    }

    // 4. Find organizations that might be test data (created recently with generic names)
    const { data: suspiciousOrgs, error: suspiciousError } = await supabaseAdmin
      .from('organizations')
      .select('id, name, slug, status, created_at')
      .gte('created_at', '2025-08-20') // Created during partner dashboard development
      .not('name', 'ilike', '%psychiatry%')
      .not('name', 'ilike', '%moonlit%')
      .not('name', 'ilike', '%medical%')
      .not('name', 'ilike', '%health%')
    
    if (suspiciousError) {
      console.error('Error fetching suspicious organizations:', suspiciousError)
    }

    const summary = {
      test_organizations: testOrgs || [],
      test_partner_users: testUsers || [],
      test_patient_affiliations: testAffiliations,
      suspicious_organizations: suspiciousOrgs || [],
      total_test_items: (testOrgs?.length || 0) + (testUsers?.length || 0) + testAffiliations.length
    }

    console.log('📊 Test data summary:')
    console.log(`  - Test organizations: ${testOrgs?.length || 0}`)
    console.log(`  - Test partner users: ${testUsers?.length || 0}`)
    console.log(`  - Test patient affiliations: ${testAffiliations.length}`)
    console.log(`  - Suspicious organizations: ${suspiciousOrgs?.length || 0}`)

    return NextResponse.json({
      success: true,
      data: summary,
      message: 'Test data scan completed. Use DELETE method to remove identified test data.'
    })

  } catch (error: any) {
    console.error('❌ Test data scan error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to scan for test data',
        details: error.message
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    console.log('🗑️  Starting deletion of test partner and organization data...')
    
    let deletedCount = 0
    const deletionResults: string[] = []

    // 1. Find and delete test organizations first (this will cascade to related data)
    const { data: testOrgs, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('id, name, slug')
      .or(`name.ilike.%test%,name.ilike.%demo%,name.ilike.%sample%,slug.ilike.%test%,slug.ilike.%demo%`)
    
    if (orgError) {
      console.error('Error fetching test organizations:', orgError)
    }

    // 2. Find and delete test partner users
    const { data: testUsers, error: userError } = await supabaseAdmin
      .from('partner_users')
      .select('id, first_name, last_name, email, organization_id')
      .or(`email.ilike.%test%,email.ilike.%demo%,email.ilike.%sample%,first_name.ilike.%test%,last_name.ilike.%test%`)
    
    if (userError) {
      console.error('Error fetching test partner users:', userError)
    }

    // Delete patient affiliations first (to avoid foreign key constraints)
    if (testOrgs && testOrgs.length > 0) {
      const testOrgIds = testOrgs.map(org => org.id)
      
      const { count: deletedAffiliations, error: deleteAffiliationsError } = await supabaseAdmin
        .from('patient_affiliations')
        .delete({ count: 'exact' })
        .in('organization_id', testOrgIds)
      
      if (deleteAffiliationsError) {
        console.error('❌ Error deleting patient affiliations:', deleteAffiliationsError)
        deletionResults.push(`Error deleting patient affiliations: ${deleteAffiliationsError.message}`)
      } else {
        deletedCount += deletedAffiliations || 0
        deletionResults.push(`✅ Deleted ${deletedAffiliations || 0} test patient affiliations`)
      }
    }

    // Delete partner users
    if (testUsers && testUsers.length > 0) {
      const testUserIds = testUsers.map(user => user.id)
      
      const { count: deletedUsers, error: deleteUsersError } = await supabaseAdmin
        .from('partner_users')
        .delete({ count: 'exact' })
        .in('id', testUserIds)
      
      if (deleteUsersError) {
        console.error('❌ Error deleting partner users:', deleteUsersError)
        deletionResults.push(`Error deleting partner users: ${deleteUsersError.message}`)
      } else {
        deletedCount += deletedUsers || 0
        deletionResults.push(`✅ Deleted ${deletedUsers || 0} test partner users`)
        testUsers.forEach(user => {
          deletionResults.push(`  - ${user.first_name} ${user.last_name} (${user.email})`)
        })
      }
    }

    // Delete organizations last
    if (testOrgs && testOrgs.length > 0) {
      const testOrgIds = testOrgs.map(org => org.id)
      
      const { count: deletedOrgs, error: deleteOrgsError } = await supabaseAdmin
        .from('organizations')
        .delete({ count: 'exact' })
        .in('id', testOrgIds)
      
      if (deleteOrgsError) {
        console.error('❌ Error deleting organizations:', deleteOrgsError)
        deletionResults.push(`Error deleting organizations: ${deleteOrgsError.message}`)
      } else {
        deletedCount += deletedOrgs || 0
        deletionResults.push(`✅ Deleted ${deletedOrgs || 0} test organizations`)
        testOrgs.forEach(org => {
          deletionResults.push(`  - ${org.name} (${org.slug})`)
        })
      }
    }

    // Clean up any audit logs related to test data
    const { count: deletedLogs, error: logsError } = await supabaseAdmin
      .from('scheduler_audit_logs')
      .delete({ count: 'exact' })
      .or(`details->>partner_user_id.in.(${testUsers?.map(u => `"${u.id}"`).join(',')}),resource_id.in.(${testOrgs?.map(o => `"${o.id}"`).join(',')})`)
    
    if (logsError) {
      console.warn('⚠️ Could not clean up audit logs:', logsError)
      deletionResults.push(`Warning: Could not clean audit logs: ${logsError.message}`)
    } else if (deletedLogs && deletedLogs > 0) {
      deletionResults.push(`✅ Cleaned up ${deletedLogs} related audit log entries`)
    }

    console.log('🎉 Test data deletion completed!')
    deletionResults.forEach(result => console.log(result))

    return NextResponse.json({
      success: true,
      data: {
        deleted_count: deletedCount,
        deletion_results: deletionResults,
        test_organizations_deleted: testOrgs?.length || 0,
        test_partner_users_deleted: testUsers?.length || 0
      },
      message: `Successfully deleted ${deletedCount} test data items`
    })

  } catch (error: any) {
    console.error('❌ Test data deletion error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete test data',
        details: error.message
      },
      { status: 500 }
    )
  }
}