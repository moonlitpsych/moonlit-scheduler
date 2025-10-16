// Debug endpoint to introspect partner-related database tables
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    console.log('🔍 Introspecting database schema for partner tables...')

    const results: any = {}

    // Check for each expected table
    const tablesToCheck = [
      'organizations',
      'partners',
      'partner_users',
      'patient_organization_affiliations',
      'partner_user_patient_assignments',
      'appointment_change_requests',
      'patients',
      'patient_affiliations'
    ]

    for (const tableName of tablesToCheck) {
      try {
        // Try to query the table structure
        const { data, error } = await supabaseAdmin
          .from(tableName)
          .select('*')
          .limit(0)

        if (error) {
          results[tableName] = {
            exists: false,
            error: error.message,
            code: error.code
          }
        } else {
          results[tableName] = {
            exists: true
          }

          // Try to get column info by selecting first row
          const { data: sampleRow } = await supabaseAdmin
            .from(tableName)
            .select('*')
            .limit(1)
            .maybeSingle()

          if (sampleRow) {
            results[tableName].columns = Object.keys(sampleRow)
            results[tableName].sample_count = 1
          } else {
            results[tableName].sample_count = 0
          }

          // Get count
          const { count } = await supabaseAdmin
            .from(tableName)
            .select('*', { count: 'exact', head: true })

          results[tableName].row_count = count || 0
        }
      } catch (err: any) {
        results[tableName] = {
          exists: false,
          error: err.message,
          exception: true
        }
      }
    }

    // Check for specific relationships
    const relationshipChecks: any = {}

    // Check if patient_organization_affiliations exists and has expected columns
    if (results['patient_organization_affiliations']?.exists) {
      relationshipChecks.patient_organization_affiliations = {
        has_roi_consent_status: results['patient_organization_affiliations'].columns?.includes('roi_consent_status'),
        has_primary_contact_user_id: results['patient_organization_affiliations'].columns?.includes('primary_contact_user_id'),
        has_affiliation_type: results['patient_organization_affiliations'].columns?.includes('affiliation_type')
      }
    }

    // Check if patients table has affiliation-related columns
    if (results['patients']?.exists) {
      relationshipChecks.patients = {
        has_referring_organization_id: results['patients'].columns?.includes('referring_organization_id'),
        has_referring_partner_user_id: results['patients'].columns?.includes('referring_partner_user_id'),
        has_roi_contacts: results['patients'].columns?.includes('roi_contacts')
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      database: process.env.NEXT_PUBLIC_SUPABASE_URL,
      tables: results,
      relationship_checks: relationshipChecks,
      summary: {
        total_checked: tablesToCheck.length,
        existing_tables: Object.values(results).filter((r: any) => r.exists).length,
        missing_tables: Object.values(results).filter((r: any) => !r.exists).length,
        tables_with_data: Object.values(results).filter((r: any) => r.exists && r.row_count > 0).length
      }
    }, { status: 200 })

  } catch (error: any) {
    console.error('❌ Schema introspection error:', error)

    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}
