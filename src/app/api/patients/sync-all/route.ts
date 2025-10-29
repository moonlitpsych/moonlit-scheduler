/**
 * Bulk Sync All Provider Patients from PracticeQ
 *
 * POST /api/patients/sync-all
 *
 * Syncs all patients assigned to the logged-in provider
 * For use by providers when they need fresh data NOW
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { practiceQSyncService } from '@/lib/services/practiceQSyncService'
import { isAdminEmail } from '@/lib/admin-auth'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

interface BulkSyncResult {
  success: boolean
  syncLogId: string
  providerId: string
  providerName: string
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

    // 2. Get provider and verify access
    // Support admin impersonation
    const isAdmin = isAdminEmail(user.email || '')
    let providerId: string
    let providerName: string

    if (isAdmin) {
      // Check for impersonation context
      const impersonationHeader = request.headers.get('x-impersonated-provider-id')
      if (impersonationHeader) {
        providerId = impersonationHeader

        const { data: impersonatedProvider } = await supabaseAdmin
          .from('providers')
          .select('first_name, last_name')
          .eq('id', providerId)
          .single()

        providerName = impersonatedProvider
          ? `${impersonatedProvider.first_name} ${impersonatedProvider.last_name}`
          : 'Unknown Provider'
      } else {
        return NextResponse.json({ error: 'Provider ID required for admin' }, { status: 400 })
      }
    } else {
      // Regular provider - look up by auth_user_id
      const { data: provider, error: providerError } = await supabaseAdmin
        .from('providers')
        .select('id, first_name, last_name')
        .eq('auth_user_id', user.id)
        .eq('is_active', true)
        .single()

      if (providerError || !provider) {
        return NextResponse.json({ error: 'Provider not found' }, { status: 403 })
      }

      providerId = provider.id
      providerName = `${provider.first_name} ${provider.last_name}`
    }

    console.log(`🔄 [Provider Bulk Sync] ${providerName} initiated bulk sync`)

    // 3. Create sync log entry
    const { data: syncLog, error: logError } = await supabaseAdmin
      .from('sync_logs')
      .insert({
        sync_type: 'manual_provider_bulk',
        provider_id: providerId,
        triggered_by_user_id: user.id,
        status: 'in_progress',
        started_at: new Date().toISOString()
      })
      .select('id')
      .single()

    if (logError || !syncLog) {
      console.error('Failed to create sync log:', logError)
      // Continue anyway - logging failure shouldn't block the sync
    }

    // 4. Parse request body (optional date range)
    let dateRange: { startDate: string; endDate: string } | undefined
    try {
      const body = await request.json()
      if (body.dateRange) {
        dateRange = body.dateRange
      }
    } catch {
      // No body or invalid JSON - use default date range
    }

    // 5. Get all active patients assigned to this provider
    const { data: patients, error: patientError } = await supabaseAdmin
      .from('patients')
      .select('id, first_name, last_name, email, status')
      .eq('primary_provider_id', providerId)
      .eq('status', 'active')
      .not('email', 'is', null)

    if (patientError) {
      throw new Error(`Failed to fetch patients: ${patientError.message}`)
    }

    console.log(`  👥 [Provider Bulk Sync] Found ${patients?.length || 0} active patients with email`)

    // 6. Sync each patient
    const results: BulkSyncResult = {
      success: true,
      syncLogId: syncLog?.id || '',
      providerId: providerId,
      providerName: providerName,
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

    for (const patient of patients || []) {
      if (!patient) continue

      try {
        console.log(`    🔄 Syncing: ${patient.first_name} ${patient.last_name}`)

        // Sync patient appointments (no organization_id for provider sync)
        const result = await practiceQSyncService.syncPatientAppointments(
          patient.id,
          null, // No organization filter for provider sync
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

        console.log(`      ✅ ${patient.first_name}: ${result.summary.new} new, ${result.summary.updated} updated`)
      } catch (patientError: any) {
        console.error(`      ❌ Failed to sync ${patient.first_name}:`, patientError.message)

        results.totalSummary.errors++
        results.patientResults.push({
          patientId: patient.id,
          patientName: `${patient.first_name} ${patient.last_name}`,
          status: 'error',
          errorMessage: patientError.message || 'Unknown error'
        })
      }
    }

    // 7. Update sync log status
    if (syncLog) {
      await supabaseAdmin
        .from('sync_logs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          patients_processed: results.patientsProcessed,
          summary: results.totalSummary
        })
        .eq('id', syncLog.id)
    }

    const duration = Date.now() - startTime
    console.log(`✅ [Provider Bulk Sync] Completed in ${duration}ms - ${results.patientsProcessed} patients processed`)

    return NextResponse.json(results)
  } catch (error: any) {
    console.error('❌ [Provider Bulk Sync] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to sync patients'
      },
      { status: 500 }
    )
  }
}
