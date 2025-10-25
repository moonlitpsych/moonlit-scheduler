/**
 * Automated PracticeQ Appointment Sync Cron Job
 *
 * POST /api/cron/sync-practiceq-appointments
 *
 * Runs daily at 3:00 AM Mountain Time (9:00 AM UTC)
 * Syncs all patients from all partner organizations
 *
 * Configured in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/sync-practiceq-appointments",
 *     "schedule": "0 9 * * *"
 *   }]
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { practiceQSyncService } from '@/lib/services/practiceQSyncService'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase credentials')
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

interface SyncStats {
  totalPatients: number
  patientsProcessed: number
  patientsFailed: number
  totalAppointments: {
    new: number
    updated: number
    unchanged: number
    errors: number
  }
  duration: number
  errors: Array<{ patientId: string; patientName: string; error: string }>
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  // 1. Verify authorization (Vercel Cron Secret)
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.error('❌ [Cron Sync] Unauthorized: Invalid cron secret')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('🔄 [Cron Sync] Starting automated daily PracticeQ sync...')

  // Create sync log entry
  const { data: syncLog, error: logError } = await supabaseAdmin
    .from('sync_logs')
    .insert({
      sync_type: 'automated_daily',
      status: 'in_progress',
      started_at: new Date().toISOString()
    })
    .select('id')
    .single()

  if (logError || !syncLog) {
    console.error('❌ [Cron Sync] Failed to create sync log:', logError)
    return NextResponse.json({ error: 'Failed to create sync log' }, { status: 500 })
  }

  const syncLogId = syncLog.id

  try {
    // 2. Get all active organizations
    const { data: organizations, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('id, name')
      .eq('status', 'active')

    if (orgError || !organizations) {
      throw new Error(`Failed to fetch organizations: ${orgError?.message}`)
    }

    console.log(`📊 [Cron Sync] Found ${organizations.length} active organizations`)

    const stats: SyncStats = {
      totalPatients: 0,
      patientsProcessed: 0,
      patientsFailed: 0,
      totalAppointments: {
        new: 0,
        updated: 0,
        unchanged: 0,
        errors: 0
      },
      duration: 0,
      errors: []
    }

    // 3. For each organization, sync all patients
    for (const org of organizations) {
      console.log(`\n🏢 [Cron Sync] Processing organization: ${org.name}`)

      // Get all active patients for this organization
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
        .eq('organization_id', org.id)
        .eq('status', 'active')

      if (affiliationError) {
        console.error(`❌ [Cron Sync] Failed to fetch patients for ${org.name}:`, affiliationError)
        continue
      }

      const patients = affiliations
        ?.map(a => a.patients)
        .filter(p => p && p.status === 'active' && p.email) || []

      console.log(`  👥 Found ${patients.length} active patients with email`)
      stats.totalPatients += patients.length

      // Sync each patient
      for (const patient of patients) {
        if (!patient) continue

        try {
          console.log(`    🔄 Syncing: ${patient.first_name} ${patient.last_name} (${patient.email})`)

          const result = await practiceQSyncService.syncPatientAppointments(
            patient.id,
            org.id,
            {
              // Default: last 90 days + next 90 days
              startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            }
          )

          stats.patientsProcessed++
          stats.totalAppointments.new += result.summary.new
          stats.totalAppointments.updated += result.summary.updated
          stats.totalAppointments.unchanged += result.summary.unchanged
          stats.totalAppointments.errors += result.summary.errors

          console.log(`    ✅ Synced: ${result.summary.new} new, ${result.summary.updated} updated, ${result.summary.unchanged} unchanged`)

          // Throttle to avoid rate limiting (IntakeQ: 500 requests/day)
          // With ~100 patients, we're well under the limit, but add small delay to be safe
          await new Promise(resolve => setTimeout(resolve, 100)) // 100ms delay

        } catch (error: any) {
          stats.patientsFailed++
          stats.errors.push({
            patientId: patient.id,
            patientName: `${patient.first_name} ${patient.last_name}`,
            error: error.message || 'Unknown error'
          })
          console.error(`    ❌ Failed to sync ${patient.first_name} ${patient.last_name}:`, error.message)
        }
      }
    }

    // 4. Calculate final stats
    stats.duration = Date.now() - startTime

    // 5. Update sync log
    await supabaseAdmin
      .from('sync_logs')
      .update({
        status: stats.patientsFailed > 0 ? 'partial_success' : 'completed',
        completed_at: new Date().toISOString(),
        patients_processed: stats.patientsProcessed,
        patients_failed: stats.patientsFailed,
        appointments_new: stats.totalAppointments.new,
        appointments_updated: stats.totalAppointments.updated,
        appointments_unchanged: stats.totalAppointments.unchanged,
        appointments_errors: stats.totalAppointments.errors,
        metadata: {
          totalPatients: stats.totalPatients,
          duration_ms: stats.duration,
          organizations_processed: organizations.length,
          errors: stats.errors.slice(0, 10) // Only store first 10 errors
        }
      })
      .eq('id', syncLogId)

    // 6. Log completion
    console.log('\n✅ [Cron Sync] Automated sync completed!')
    console.log(`   📊 Patients processed: ${stats.patientsProcessed}/${stats.totalPatients}`)
    console.log(`   ✨ Appointments: ${stats.totalAppointments.new} new, ${stats.totalAppointments.updated} updated, ${stats.totalAppointments.unchanged} unchanged`)
    console.log(`   ⏱️  Duration: ${(stats.duration / 1000).toFixed(1)}s`)

    if (stats.patientsFailed > 0) {
      console.warn(`   ⚠️  ${stats.patientsFailed} patients failed`)
      console.warn(`   First few errors:`, stats.errors.slice(0, 3))
    }

    // 7. Send email notification if there were significant errors
    if (stats.patientsFailed > 5) {
      // TODO: Send email to admin@trymoonlit.com with error summary
      console.warn('⚠️ [Cron Sync] High error rate detected - admin notification recommended')
    }

    return NextResponse.json({
      success: true,
      syncLogId,
      stats
    }, { status: 200 })

  } catch (error: any) {
    console.error('❌ [Cron Sync] Fatal error:', error)

    // Update sync log with failure
    await supabaseAdmin
      .from('sync_logs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: error.message || 'Unknown error',
        error_stack: error.stack,
        metadata: {
          duration_ms: Date.now() - startTime
        }
      })
      .eq('id', syncLogId)

    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to sync appointments'
    }, { status: 500 })
  }
}

// Also allow GET for manual testing (protected by cron secret)
export async function GET(request: NextRequest) {
  return POST(request)
}
