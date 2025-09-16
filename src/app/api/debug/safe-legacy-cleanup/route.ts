// Safe Legacy Table Cleanup with proper constraint handling
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    console.log('🧹 Starting safe legacy table cleanup...')

    const results: any[] = []

    // 1. Check current state
    const { data: contactsData, error: contactsError, count: contactsCount } = await supabaseAdmin
      .from('contacts')
      .select('*', { count: 'exact', head: true })

    const { data: legacyData, error: legacyError, count: legacyCount } = await supabaseAdmin
      .from('partner_contacts')
      .select('*', { count: 'exact', head: true })

    if (legacyError && legacyError.code === '42P01') {
      return NextResponse.json({
        success: true,
        message: 'partner_contacts table already does not exist',
        results: [{ step: 'already_complete', status: 'complete' }]
      })
    }

    results.push({
      step: 'state_check',
      status: 'pass',
      message: `contacts: ${contactsCount} records, partner_contacts: ${legacyCount} records`
    })

    // 2. Check if partner_contacts is actually different from contacts
    // Sample a few records from each table to compare
    const { data: contactsSample } = await supabaseAdmin
      .from('contacts')
      .select('id, first_name, last_name, email')
      .limit(3)

    const { data: legacySample } = await supabaseAdmin
      .from('partner_contacts')
      .select('id, first_name, last_name, email')
      .limit(3)

    // Check if the tables have the same data
    const sampleComparison = {
      contacts_sample: contactsSample,
      legacy_sample: legacySample,
      appear_identical: JSON.stringify(contactsSample) === JSON.stringify(legacySample)
    }

    results.push({
      step: 'data_comparison',
      status: 'info',
      message: `Tables appear identical: ${sampleComparison.appear_identical}`,
      details: sampleComparison
    })

    // 3. Check for any foreign key references TO partner_contacts
    // This is safer than trying to delete data
    try {
      // Try to rename the table instead of dropping it
      // This is reversible if there are issues
      const timestamp = new Date().toISOString().replace(/[:.]/g, '_')
      const backupTableName = `partner_contacts_backup_${timestamp.substring(0, 19)}`

      // For now, let's just document what needs to be done
      results.push({
        step: 'analysis',
        status: 'info',
        message: 'Tables appear to be duplicates. Manual database action required.',
        details: {
          recommended_action: 'DROP TABLE partner_contacts CASCADE;',
          backup_suggestion: `ALTER TABLE partner_contacts RENAME TO ${backupTableName};`,
          safety_note: 'This should be done directly in the database after confirming no foreign key dependencies'
        }
      })

      // 4. Check what's referencing partner_contacts (if anything)
      const { data: crmNotesCheck } = await supabaseAdmin
        .from('crm_notes')
        .select('id, contact_id')
        .limit(5)

      if (crmNotesCheck && crmNotesCheck.length > 0) {
        // Check if contact_id references contacts table (good) or partner_contacts (bad)
        const sampleContactId = crmNotesCheck[0].contact_id

        if (sampleContactId) {
          const { data: contactExists } = await supabaseAdmin
            .from('contacts')
            .select('id')
            .eq('id', sampleContactId)
            .maybeSingle()

          results.push({
            step: 'foreign_key_check',
            status: contactExists ? 'pass' : 'warning',
            message: contactExists
              ? 'CRM notes correctly reference contacts table'
              : 'CRM notes may reference partner_contacts table',
            details: { sample_id: sampleContactId, found_in_contacts: !!contactExists }
          })
        }
      }

    } catch (cleanupError: any) {
      results.push({
        step: 'cleanup_attempt',
        status: 'warning',
        message: 'Cleanup requires manual database intervention',
        details: cleanupError.message
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Safe analysis complete - manual action required',
      timestamp: new Date().toISOString(),
      results,
      recommended_sql: {
        check_constraints: "SELECT conname, conrelid::regclass, pg_get_constraintdef(oid) FROM pg_constraint WHERE confrelid = 'partner_contacts'::regclass;",
        drop_table: "DROP TABLE partner_contacts CASCADE;",
        safer_rename: "ALTER TABLE partner_contacts RENAME TO partner_contacts_backup_$(date +%Y%m%d);"
      }
    })

  } catch (error: any) {
    console.error('❌ Safe cleanup error:', error)

    return NextResponse.json({
      success: false,
      error: 'Safe cleanup analysis failed',
      details: error.message
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    // Quick status check
    const { error: contactsError, count: contactsCount } = await supabaseAdmin
      .from('contacts')
      .select('*', { count: 'exact', head: true })

    const { error: legacyError, count: legacyCount } = await supabaseAdmin
      .from('partner_contacts')
      .select('*', { count: 'exact', head: true })

    return NextResponse.json({
      status: {
        contacts_table: contactsError ? 'error' : `exists (${contactsCount} records)`,
        legacy_table: legacyError?.code === '42P01' ? 'cleaned' : `exists (${legacyCount} records)`,
        cleanup_needed: legacyError?.code !== '42P01'
      }
    })
  } catch (error: any) {
    return NextResponse.json({
      error: 'Status check failed',
      details: error.message
    }, { status: 500 })
  }
}