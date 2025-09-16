// Direct Database Schema Check - bypasses information_schema issues
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Direct database schema validation...')

    const results: any[] = []

    // 1. Direct contacts table check
    try {
      const { data: contacts, error: contactsError, count } = await supabaseAdmin
        .from('contacts')
        .select('*', { count: 'exact', head: true })

      if (contactsError) {
        results.push({
          check: 'contacts_table_direct',
          status: 'fail',
          message: 'contacts table not accessible',
          details: contactsError
        })
      } else {
        results.push({
          check: 'contacts_table_direct',
          status: 'pass',
          message: `contacts table exists with ${count || 0} records`
        })

        // Get sample structure
        const { data: sampleContacts } = await supabaseAdmin
          .from('contacts')
          .select('*')
          .limit(1)

        if (sampleContacts && sampleContacts.length > 0) {
          results.push({
            check: 'contacts_structure',
            status: 'pass',
            message: 'contacts table structure verified',
            details: {
              columns: Object.keys(sampleContacts[0]),
              sample_record: sampleContacts[0]
            }
          })
        }
      }
    } catch (err: any) {
      results.push({
        check: 'contacts_table_direct',
        status: 'fail',
        message: 'Error accessing contacts table',
        details: err.message
      })
    }

    // 2. Check for legacy partner_contacts table
    try {
      const { data: legacyContacts, error: legacyError, count: legacyCount } = await supabaseAdmin
        .from('partner_contacts')
        .select('*', { count: 'exact', head: true })

      if (legacyError && legacyError.code === '42P01') {
        results.push({
          check: 'legacy_table_cleanup',
          status: 'pass',
          message: 'partner_contacts table does not exist (good - migration complete)'
        })
      } else if (legacyError) {
        results.push({
          check: 'legacy_table_cleanup',
          status: 'warning',
          message: 'Error checking partner_contacts table',
          details: legacyError
        })
      } else {
        results.push({
          check: 'legacy_table_cleanup',
          status: 'warning',
          message: `partner_contacts table still exists with ${legacyCount || 0} records - should be dropped`,
          details: { rowCount: legacyCount }
        })
      }
    } catch (err: any) {
      results.push({
        check: 'legacy_table_cleanup',
        status: 'warning',
        message: 'Error checking legacy table',
        details: err.message
      })
    }

    // 3. Check organizations table
    try {
      const { data: orgs, error: orgsError, count: orgsCount } = await supabaseAdmin
        .from('organizations')
        .select('*', { count: 'exact', head: true })

      if (orgsError && orgsError.code === '42P01') {
        results.push({
          check: 'organizations_table',
          status: 'fail',
          message: 'organizations table does not exist'
        })
      } else if (orgsError) {
        results.push({
          check: 'organizations_table',
          status: 'fail',
          message: 'Error accessing organizations table',
          details: orgsError
        })
      } else {
        results.push({
          check: 'organizations_table',
          status: 'pass',
          message: `organizations table exists with ${orgsCount || 0} records`
        })
      }
    } catch (err: any) {
      results.push({
        check: 'organizations_table',
        status: 'fail',
        message: 'Error checking organizations table',
        details: err.message
      })
    }

    // 4. Check crm_notes table
    try {
      const { data: notes, error: notesError, count: notesCount } = await supabaseAdmin
        .from('crm_notes')
        .select('*', { count: 'exact', head: true })

      if (notesError && notesError.code === '42P01') {
        results.push({
          check: 'crm_notes_table',
          status: 'warning',
          message: 'crm_notes table does not exist'
        })
      } else if (notesError) {
        results.push({
          check: 'crm_notes_table',
          status: 'warning',
          message: 'Error accessing crm_notes table',
          details: notesError
        })
      } else {
        results.push({
          check: 'crm_notes_table',
          status: 'pass',
          message: `crm_notes table exists with ${notesCount || 0} records`
        })
      }
    } catch (err: any) {
      results.push({
        check: 'crm_notes_table',
        status: 'warning',
        message: 'Error checking crm_notes table',
        details: err.message
      })
    }

    // 5. Test data consistency - check for orphaned contact references
    try {
      // Sample some contacts with organization_id
      const { data: contactsWithOrgs } = await supabaseAdmin
        .from('contacts')
        .select('id, organization_id, first_name, last_name')
        .not('organization_id', 'is', null)
        .limit(5)

      if (contactsWithOrgs && contactsWithOrgs.length > 0) {
        const orgIds = contactsWithOrgs.map(c => c.organization_id).filter(Boolean)

        if (orgIds.length > 0) {
          const { data: existingOrgs } = await supabaseAdmin
            .from('organizations')
            .select('id')
            .in('id', orgIds)

          const existingOrgIds = new Set(existingOrgs?.map(o => o.id) || [])
          const orphanedContacts = contactsWithOrgs.filter(c =>
            c.organization_id && !existingOrgIds.has(c.organization_id)
          )

          if (orphanedContacts.length > 0) {
            results.push({
              check: 'data_consistency',
              status: 'warning',
              message: `Found ${orphanedContacts.length} contacts with invalid organization_id references`,
              details: orphanedContacts
            })
          } else {
            results.push({
              check: 'data_consistency',
              status: 'pass',
              message: 'Contact-organization relationships are consistent'
            })
          }
        }
      } else {
        results.push({
          check: 'data_consistency',
          status: 'pass',
          message: 'No contacts with organization_id found to validate'
        })
      }
    } catch (err: any) {
      results.push({
        check: 'data_consistency',
        status: 'warning',
        message: 'Error checking data consistency',
        details: err.message
      })
    }

    // Calculate summary
    const passCount = results.filter(r => r.status === 'pass').length
    const failCount = results.filter(r => r.status === 'fail').length
    const warningCount = results.filter(r => r.status === 'warning').length

    let overallStatus = 'healthy'
    if (failCount > 0) {
      overallStatus = 'critical_issues'
    } else if (warningCount > 0) {
      overallStatus = 'issues_found'
    }

    console.log(`✅ Direct schema check complete: ${passCount} passed, ${failCount} failed, ${warningCount} warnings`)

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      overall_status: overallStatus,
      summary: {
        total_checks: results.length,
        passed: passCount,
        failed: failCount,
        warnings: warningCount
      },
      results,
      migration_status: {
        contacts_table_working: results.find(r => r.check === 'contacts_table_direct')?.status === 'pass',
        legacy_table_cleaned: results.find(r => r.check === 'legacy_table_cleanup')?.status === 'pass'
      }
    })

  } catch (error: any) {
    console.error('❌ Direct schema check error:', error)

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      overall_status: 'critical_issues',
      error: 'Direct schema check failed',
      details: error.message
    }, { status: 500 })
  }
}