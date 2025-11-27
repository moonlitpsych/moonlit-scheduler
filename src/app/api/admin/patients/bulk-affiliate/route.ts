/**
 * Bulk Patient-Organization Affiliation API
 *
 * Allows admins to associate multiple patients with an organization in a single operation.
 * Skips patients who are already affiliated with the organization.
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { isAdminEmail } from '@/lib/admin-auth'

interface BulkAffiliateRequest {
  patient_ids: string[]
  organization_id: string
  primary_contact_user_id?: string | null  // Case manager override
  start_date?: string
  notes?: string
}

interface AffiliationResult {
  patient_id: string
  status: 'created' | 'skipped' | 'error'
  reason?: string
}

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    // Next.js 15: cookies() is async and must be awaited
    const cookieStore = await cookies()
    const supabase = createServerComponentClient({ cookies: () => cookieStore })
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is admin
    if (!isAdminEmail(user.email || '')) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    const body: BulkAffiliateRequest = await request.json()
    const {
      patient_ids,
      organization_id,
      primary_contact_user_id,
      start_date,
      notes
    } = body

    // Validate required fields
    if (!patient_ids || !Array.isArray(patient_ids) || patient_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'patient_ids array is required' },
        { status: 400 }
      )
    }

    if (!organization_id) {
      return NextResponse.json(
        { success: false, error: 'organization_id is required' },
        { status: 400 }
      )
    }

    console.log('🔗 Bulk affiliate request:', {
      patient_count: patient_ids.length,
      organization_id,
      primary_contact_user_id: primary_contact_user_id || 'using org default',
      admin_email: user.email
    })

    // Fetch organization to get default case manager
    const { data: organization, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('id, name, default_case_manager_id')
      .eq('id', organization_id)
      .single()

    if (orgError || !organization) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 404 }
      )
    }

    // Determine case manager: use override if provided, otherwise org default
    const caseManagerId = primary_contact_user_id || organization.default_case_manager_id

    // Check for existing affiliations
    const { data: existingAffiliations, error: existingError } = await supabaseAdmin
      .from('patient_organization_affiliations')
      .select('patient_id')
      .eq('organization_id', organization_id)
      .in('patient_id', patient_ids)

    if (existingError) {
      console.error('❌ Error checking existing affiliations:', existingError)
      return NextResponse.json(
        { success: false, error: 'Failed to check existing affiliations' },
        { status: 500 }
      )
    }

    // Create a set of already-affiliated patient IDs
    const existingPatientIds = new Set(existingAffiliations?.map(a => a.patient_id) || [])

    // Separate patients into new affiliations and skipped
    const results: AffiliationResult[] = []
    const newAffiliations: any[] = []

    for (const patientId of patient_ids) {
      if (existingPatientIds.has(patientId)) {
        results.push({
          patient_id: patientId,
          status: 'skipped',
          reason: 'Already affiliated with this organization'
        })
      } else {
        newAffiliations.push({
          patient_id: patientId,
          organization_id: organization_id,
          status: 'active',
          affiliation_type: 'case_management',
          primary_contact_user_id: caseManagerId,
          start_date: start_date || new Date().toISOString().split('T')[0],
          notes: notes || `Bulk affiliated by admin (${user.email})`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      }
    }

    // Insert new affiliations
    let createdCount = 0
    let errorCount = 0

    if (newAffiliations.length > 0) {
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('patient_organization_affiliations')
        .insert(newAffiliations)
        .select('patient_id')

      if (insertError) {
        console.error('❌ Error creating affiliations:', insertError)
        // Mark all as errors
        for (const aff of newAffiliations) {
          results.push({
            patient_id: aff.patient_id,
            status: 'error',
            reason: insertError.message
          })
          errorCount++
        }
      } else {
        // Mark all as created
        for (const aff of newAffiliations) {
          results.push({
            patient_id: aff.patient_id,
            status: 'created'
          })
          createdCount++
        }
      }
    }

    const skippedCount = existingPatientIds.size
    const skippedIds = Array.from(existingPatientIds)

    // Log the operation for audit
    await supabaseAdmin
      .from('scheduler_audit_logs')
      .insert({
        action: 'bulk_affiliate_patients',
        resource_type: 'patient_organization_affiliations',
        resource_id: organization_id,
        details: {
          organization_name: organization.name,
          total_requested: patient_ids.length,
          created: createdCount,
          skipped: skippedCount,
          errors: errorCount,
          case_manager_id: caseManagerId,
          admin_email: user.email
        }
      })

    console.log('✅ Bulk affiliate complete:', {
      organization: organization.name,
      created: createdCount,
      skipped: skippedCount,
      errors: errorCount
    })

    return NextResponse.json({
      success: true,
      created: createdCount,
      skipped: skippedCount,
      errors: errorCount,
      skipped_ids: skippedIds,
      results: results,
      organization: {
        id: organization.id,
        name: organization.name
      }
    })

  } catch (error: any) {
    console.error('❌ Bulk affiliate error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process bulk affiliation', details: error.message },
      { status: 500 }
    )
  }
}
