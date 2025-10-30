/**
 * Admin Bulk Sync ALL Patients from PracticeQ
 *
 * POST /api/admin/patients/bulk-sync-all
 *
 * Syncs ALL active patients in the system (admin only)
 * Updates payer information from IntakeQ insurance fields
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { practiceQSyncService } from '@/lib/services/practiceQSyncService'
import { isAdminEmail } from '@/lib/admin-auth'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export const maxDuration = 300 // 5 minutes timeout

interface BulkSyncResult {
  success: boolean
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
    // 1. Verify admin authentication
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

    // Verify user is admin
    if (!isAdminEmail(user.email || '')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    console.log(`🔄 [Admin Bulk Sync] ${user.email} initiated bulk sync of ALL patients`)

    // 2. Parse request body (optional date range)
    let dateRange: { startDate: string; endDate: string } | undefined
    try {
      const body = await request.json()
      if (body.dateRange) {
        dateRange = body.dateRange
      }
    } catch {
      // No body or invalid JSON - use default date range
    }

    // 3. Get ALL active patients with email
    const { data: patients, error: patientError } = await supabaseAdmin
      .from('patients')
      .select('id, first_name, last_name, email, status')
      .eq('status', 'active')
      .not('email', 'is', null)
      .order('last_name', { ascending: true })

    if (patientError) {
      throw new Error(`Failed to fetch patients: ${patientError.message}`)
    }

    console.log(`  👥 [Admin Bulk Sync] Found ${patients?.length || 0} active patients with email`)

    if (!patients || patients.length === 0) {
      return NextResponse.json({
        success: true,
        syncedAt: new Date().toISOString(),
        patientsProcessed: 0,
        totalSummary: { new: 0, updated: 0, unchanged: 0, errors: 0 },
        patientResults: []
      })
    }

    // 4. Sync each patient
    const results: BulkSyncResult = {
      success: true,
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
        console.log(`    🔄 Syncing: ${patient.first_name} ${patient.last_name} (${patient.email})`)

        // Sync patient appointments (no organization_id for admin bulk sync)
        const result = await practiceQSyncService.syncPatientAppointments(
          patient.id,
          null, // No organization filter for admin sync
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
          status: result.summary.errors > 0 ? 'error' : 'success',
          summary: result.summary
        })

        console.log(`      ✅ ${patient.first_name}: ${result.summary.new} new, ${result.summary.updated} updated`)

        // Brief pause between patients to avoid overwhelming IntakeQ API
        await new Promise(resolve => setTimeout(resolve, 100))

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

    const duration = Date.now() - startTime
    console.log(`✅ [Admin Bulk Sync] Completed in ${duration}ms - ${results.patientsProcessed} patients processed`)
    console.log(`   📊 Summary: ${results.totalSummary.new} new, ${results.totalSummary.updated} updated, ${results.totalSummary.unchanged} unchanged, ${results.totalSummary.errors} errors`)

    return NextResponse.json(results)

  } catch (error: any) {
    console.error('❌ [Admin Bulk Sync] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to sync patients'
      },
      { status: 500 }
    )
  }
}
