/**
 * Bulk Sync All Organization Patients from PracticeQ
 *
 * POST /api/partner-dashboard/patients/sync-all
 *
 * Syncs all patients for the partner user's organization
 * For use by case managers when they need fresh data NOW
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { practiceQSyncService } from '@/lib/services/practiceQSyncService'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

interface BulkSyncResult {
  success: boolean
  syncLogId: string
  organizationId: string
  organizationName: string
  syncedAt: string
  patientsProcessed: number
  totalSummary: {
    new: number
    updated: number
    unchanged: number
    errors: number
  }
  patientResults: Array<{
    patientId: string
    patientName: string
    status: 'success' | 'error'
    summary?: {
      new: number
      updated: number
      unchanged: number
      errors: number
    }
    errorMessage?: string
  }>
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // 1. Verify authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const supabase = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    })

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Check for impersonation (admin viewing as partner)
    const { searchParams } = new URL(request.url)
    const partnerUserId = searchParams.get('partner_user_id')

    // 3. Get partner user and verify access
    let partnerUserQuery = supabaseAdmin
      .from('partner_users')
      .select('id, organization_id, role, is_active, full_name, organizations!partner_users_organization_id_fkey(id, name)')
      .eq('is_active', true)

    if (partnerUserId) {
      // Admin is impersonating - use provided partner_user_id
      partnerUserQuery = partnerUserQuery.eq('id', partnerUserId)
    } else {
      // Regular partner user - lookup by auth_user_id
      partnerUserQuery = partnerUserQuery.eq('auth_user_id', user.id)
    }

    const { data: partnerUser, error: partnerError } = await partnerUserQuery.single()

    if (partnerError || !partnerUser) {
      return NextResponse.json({ error: 'Partner user not found' }, { status: 403 })
    }

    const organization = Array.isArray(partnerUser.organizations)
      ? partnerUser.organizations[0]
      : partnerUser.organizations

    console.log(`🔄 [Bulk Sync] ${partnerUser.full_name} initiated bulk sync for ${organization.name}`)

    // 4. Create sync log entry
    const { data: syncLog, error: logError } = await supabaseAdmin
      .from('sync_logs')
      .insert({
        sync_type: 'manual_org_bulk',
        organization_id: partnerUser.organization_id,
        triggered_by_user_id: partnerUser.id,
        status: 'in_progress',
        started_at: new Date().toISOString()
      })
      .select('id')
      .single()

    if (logError || !syncLog) {
      throw new Error(`Failed to create sync log: ${logError?.message}`)
    }

    // 5. Parse request body (optional date range)
    let dateRange: { startDate: string; endDate: string } | undefined
    try {
      const body = await request.json()
      if (body.dateRange) {
        dateRange = body.dateRange
      }
    } catch {
      // No body or invalid JSON - use default date range
    }

    // 6. Get all active patients for this organization
    const { data: affiliations, error: affiliationError } = await supabaseAdmin
      .from('patient_organization_affiliations')
      .select(`
        patient_id,
        patients!inner(
          id,
          first_name,
          last_name,
          email,
          status
        )
      `)
      .eq('organization_id', partnerUser.organization_id)
      .eq('status', 'active')

    if (affiliationError) {
      throw new Error(`Failed to fetch patients: ${affiliationError.message}`)
    }

    const patients = affiliations
      ?.map(a => a.patients)
      .filter(p => p && p.status === 'active' && p.email) || []

    console.log(`  👥 [Bulk Sync] Found ${patients.length} active patients with email`)

    // 7. Sync each patient
    const results: BulkSyncResult = {
      success: true,
      syncLogId: syncLog.id,
      organizationId: partnerUser.organization_id,
      organizationName: organization.name,
      syncedAt: new Date().toISOString(),
      patientsProcessed: 0,
      totalSummary: {
        new: 0,
        updated: 0,
        unchanged: 0,
        errors: 0
      },
      patientResults: []
    }

    for (const patient of patients) {
      if (!patient) continue

      try {
        console.log(`    🔄 Syncing: ${patient.first_name} ${patient.last_name}`)

        const result = await practiceQSyncService.syncPatientAppointments(
          patient.id,
          partnerUser.organization_id,
          dateRange
        )

        results.patientsProcessed++
        results.totalSummary.new += result.summary.new
        results.totalSummary.updated += result.summary.updated
        results.totalSummary.unchanged += result.summary.unchanged
        results.totalSummary.errors += result.summary.errors

        results.patientResults.push({
          patientId: patient.id,
          patientName: `${patient.first_name} ${patient.last_name}`,
          status: 'success',
          summary: result.summary
        })

        console.log(`    ✅ ${result.summary.new} new, ${result.summary.updated} updated, ${result.summary.unchanged} unchanged`)

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100))

      } catch (error: any) {
        console.error(`    ❌ Failed to sync ${patient.first_name} ${patient.last_name}:`, error.message)
        results.totalSummary.errors++
        results.patientResults.push({
          patientId: patient.id,
          patientName: `${patient.first_name} ${patient.last_name}`,
          status: 'error',
          errorMessage: error.message || 'Unknown error'
        })
      }
    }

    // 8. Update sync log
    const duration = Date.now() - startTime
    await supabaseAdmin
      .from('sync_logs')
      .update({
        status: results.totalSummary.errors > 0 ? 'partial_success' : 'completed',
        completed_at: new Date().toISOString(),
        patients_processed: results.patientsProcessed,
        patients_failed: results.patientResults.filter(r => r.status === 'error').length,
        appointments_new: results.totalSummary.new,
        appointments_updated: results.totalSummary.updated,
        appointments_unchanged: results.totalSummary.unchanged,
        appointments_errors: results.totalSummary.errors,
        metadata: {
          duration_ms: duration,
          patient_names: patients.map(p => `${p!.first_name} ${p!.last_name}`)
        }
      })
      .eq('id', syncLog.id)

    // 9. Log activity
    await supabaseAdmin.from('patient_activity_log').insert({
      organization_id: partnerUser.organization_id,
      activity_type: 'practiceq_bulk_sync',
      description: `Bulk synced ${results.patientsProcessed} patients from PracticeQ (${results.totalSummary.new} new, ${results.totalSummary.updated} updated)`,
      metadata: {
        totalSummary: results.totalSummary,
        patientsProcessed: results.patientsProcessed,
        duration_ms: duration
      },
      visible_to_partner: true,
      performed_by_user_id: partnerUser.id,
      created_at: new Date().toISOString()
    })

    console.log(`\n✅ [Bulk Sync] Complete: ${results.patientsProcessed} patients in ${(duration / 1000).toFixed(1)}s`)

    return NextResponse.json(results, { status: 200 })

  } catch (error: any) {
    console.error('❌ [Bulk Sync] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to bulk sync appointments' },
      { status: 500 }
    )
  }
}
