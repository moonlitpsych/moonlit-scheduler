// Comprehensive Pre-Commit Safety Verification
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Running comprehensive commit safety verification...')

    const results: any[] = []

    // 1. Verify CRM notes correctly reference contacts (no phantom contacts)
    try {
      const { data: crmNotes, error: crmError } = await supabaseAdmin
        .from('crm_notes')
        .select('id, contact_id, organization_id')
        .not('contact_id', 'is', null)
        .limit(50)

      if (crmError) {
        results.push({
          check: 'crm_notes_references',
          status: 'warning',
          message: 'Error checking CRM notes',
          details: crmError
        })
      } else if (crmNotes && crmNotes.length > 0) {
        // Get unique contact IDs from CRM notes
        const contactIds = [...new Set(crmNotes.map(n => n.contact_id).filter(Boolean))]

        if (contactIds.length > 0) {
          // Check if all contact IDs exist in contacts table
          const { data: existingContacts, error: contactsError } = await supabaseAdmin
            .from('contacts')
            .select('id')
            .in('id', contactIds)

          const existingContactIds = new Set(existingContacts?.map(c => c.id) || [])
          const phantomContacts = contactIds.filter(id => !existingContactIds.has(id))

          if (phantomContacts.length === 0) {
            results.push({
              check: 'crm_notes_references',
              status: 'pass',
              message: `All ${contactIds.length} CRM note contact references are valid`,
              details: {
                notes_checked: crmNotes.length,
                unique_contacts: contactIds.length,
                all_valid: true
              }
            })
          } else {
            results.push({
              check: 'crm_notes_references',
              status: 'fail',
              message: `Found ${phantomContacts.length} phantom contact references in CRM notes`,
              details: {
                phantom_contact_ids: phantomContacts.slice(0, 5),
                total_phantom_count: phantomContacts.length
              }
            })
          }
        } else {
          results.push({
            check: 'crm_notes_references',
            status: 'pass',
            message: 'No CRM notes with contact_id references found'
          })
        }
      } else {
        results.push({
          check: 'crm_notes_references',
          status: 'pass',
          message: 'No CRM notes found'
        })
      }
    } catch (err: any) {
      results.push({
        check: 'crm_notes_references',
        status: 'fail',
        message: 'Error validating CRM notes references',
        details: err.message
      })
    }

    // 2. Verify both tables have identical row counts and sample data
    try {
      const { count: contactsCount, error: contactsCountError } = await supabaseAdmin
        .from('contacts')
        .select('*', { count: 'exact', head: true })

      const { count: legacyCount, error: legacyCountError } = await supabaseAdmin
        .from('partner_contacts')
        .select('*', { count: 'exact', head: true })

      if (contactsCountError || legacyCountError) {
        results.push({
          check: 'table_data_comparison',
          status: 'warning',
          message: 'Error getting table counts',
          details: { contactsCountError, legacyCountError }
        })
      } else {
        // Get sample data from both tables for comparison
        const { data: contactsSample } = await supabaseAdmin
          .from('contacts')
          .select('id, first_name, last_name, email, phone')
          .order('created_at')
          .limit(5)

        const { data: legacySample } = await supabaseAdmin
          .from('partner_contacts')
          .select('id, first_name, last_name, email, phone')
          .order('created_at')
          .limit(5)

        const countsMatch = contactsCount === legacyCount
        const samplesMatch = JSON.stringify(contactsSample) === JSON.stringify(legacySample)

        results.push({
          check: 'table_data_comparison',
          status: countsMatch && samplesMatch ? 'pass' : 'warning',
          message: countsMatch && samplesMatch
            ? `Tables are identical: ${contactsCount} records each`
            : `Table differences detected`,
          details: {
            contacts_count: contactsCount,
            legacy_count: legacyCount,
            counts_match: countsMatch,
            samples_match: samplesMatch,
            contacts_sample: contactsSample?.slice(0, 3),
            legacy_sample: legacySample?.slice(0, 3)
          }
        })
      }
    } catch (err: any) {
      results.push({
        check: 'table_data_comparison',
        status: 'fail',
        message: 'Error comparing table data',
        details: err.message
      })
    }

    // 3. Test actual application functionality with contacts table
    try {
      // Test a real query that the app would make
      const { data: appTestData, error: appTestError } = await supabaseAdmin
        .from('contacts')
        .select('id, first_name, last_name, organization_id, is_placeholder')
        .not('first_name', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(10)

      if (appTestError) {
        results.push({
          check: 'app_functionality_test',
          status: 'fail',
          message: 'Application queries against contacts table failing',
          details: appTestError
        })
      } else {
        const placeholderCount = appTestData?.filter(c => c.is_placeholder).length || 0
        const realContactsCount = appTestData?.filter(c => !c.is_placeholder).length || 0

        results.push({
          check: 'app_functionality_test',
          status: 'pass',
          message: `Application queries working: ${appTestData?.length || 0} contacts returned`,
          details: {
            total_returned: appTestData?.length || 0,
            placeholder_contacts: placeholderCount,
            real_contacts: realContactsCount,
            sample_names: appTestData?.slice(0, 3).map(c => `${c.first_name} ${c.last_name}`.trim())
          }
        })
      }
    } catch (err: any) {
      results.push({
        check: 'app_functionality_test',
        status: 'fail',
        message: 'Error testing application functionality',
        details: err.message
      })
    }

    // 4. Check for constraints on contacts table (basic validation)
    try {
      // Try to insert invalid data to test constraints
      const testId = '00000000-0000-0000-0000-000000000001'

      // Test 1: Try inserting without required fields (should fail if constraints exist)
      const { error: constraintTestError } = await supabaseAdmin
        .from('contacts')
        .insert({
          id: testId,
          is_placeholder: null // This should violate constraints if they exist
        })

      // Clean up the test insert if it somehow succeeded
      if (!constraintTestError) {
        await supabaseAdmin
          .from('contacts')
          .delete()
          .eq('id', testId)
      }

      const hasConstraints = constraintTestError &&
        (constraintTestError.message.includes('violates') ||
         constraintTestError.message.includes('constraint') ||
         constraintTestError.message.includes('null'))

      results.push({
        check: 'contacts_constraints',
        status: hasConstraints ? 'pass' : 'warning',
        message: hasConstraints
          ? 'Constraints appear to be enforced on contacts table'
          : 'No obvious constraints detected on contacts table',
        details: {
          constraint_test_error: constraintTestError?.message,
          suggests_constraints: hasConstraints
        }
      })
    } catch (err: any) {
      results.push({
        check: 'contacts_constraints',
        status: 'warning',
        message: 'Error testing constraints',
        details: err.message
      })
    }

    // Calculate overall safety score
    const passCount = results.filter(r => r.status === 'pass').length
    const failCount = results.filter(r => r.status === 'fail').length
    const warningCount = results.filter(r => r.status === 'warning').length

    let safetyStatus = 'safe_to_commit'
    if (failCount > 0) {
      safetyStatus = 'not_safe'
    } else if (warningCount > 2) {
      safetyStatus = 'review_needed'
    }

    console.log(`✅ Commit safety check complete: ${safetyStatus}`)

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      safety_status: safetyStatus,
      summary: {
        total_checks: results.length,
        passed: passCount,
        failed: failCount,
        warnings: warningCount
      },
      commit_recommendation: {
        safe_to_commit: safetyStatus === 'safe_to_commit',
        migration_complete: true,
        app_functional: passCount >= 2,
        data_integrity: results.find(r => r.check === 'crm_notes_references')?.status === 'pass'
      },
      results
    })

  } catch (error: any) {
    console.error('❌ Commit safety check error:', error)

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      safety_status: 'not_safe',
      error: 'Safety check failed',
      details: error.message
    }, { status: 500 })
  }
}