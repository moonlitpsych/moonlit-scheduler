import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { practiceQSyncService } from '@/lib/services/practiceQSyncService'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes

/**
 * Assign primary providers for patients with appointments but no primary_provider_id
 * POST /api/admin/patients/assign-primary-providers
 *
 * Body (optional):
 * {
 *   "patientId": "uuid"  // If provided, only process this patient
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { patientId } = body

    console.log('🔧 Starting primary provider assignment...')

    let patients: any[]

    if (patientId) {
      // Process single patient
      const { data: patient, error } = await supabaseAdmin
        .from('patients')
        .select('id, first_name, last_name, email, primary_provider_id')
        .eq('id', patientId)
        .single()

      if (error || !patient) {
        return NextResponse.json({
          success: false,
          error: 'Patient not found'
        }, { status: 404 })
      }

      patients = [patient]
    } else {
      // Process all patients without primary_provider_id
      const { data, error } = await supabaseAdmin
        .from('patients')
        .select('id, first_name, last_name, email, primary_provider_id')
        .is('primary_provider_id', null)

      if (error) {
        throw new Error(`Failed to fetch patients: ${error.message}`)
      }

      patients = data || []
    }

    console.log(`👥 Found ${patients.length} patients to process`)

    const results = {
      processed: 0,
      assigned: 0,
      skipped: 0,
      errors: [] as Array<{ email: string; error: string }>
    }

    for (const patient of patients) {
      try {
        results.processed++
        console.log(`\n🔄 Processing: ${patient.first_name} ${patient.last_name} (${patient.email})`)

        // Assign primary provider based on appointment history
        await practiceQSyncService.assignPrimaryProvider(patient.id)

        // Check if assignment was successful
        const { data: updated } = await supabaseAdmin
          .from('patients')
          .select('primary_provider_id')
          .eq('id', patient.id)
          .single()

        if (updated?.primary_provider_id) {
          results.assigned++
          console.log(`  ✅ Assigned primary provider`)
        } else {
          results.skipped++
          console.log(`  ⏭️  Skipped (no appointments or already assigned)`)
        }
      } catch (error: any) {
        console.error(`  ❌ Error: ${error.message}`)
        results.errors.push({
          email: patient.email,
          error: error.message
        })
      }
    }

    console.log(`\n🎉 Complete! Processed: ${results.processed}, Assigned: ${results.assigned}, Skipped: ${results.skipped}, Errors: ${results.errors.length}`)

    return NextResponse.json({
      success: true,
      message: `Processed ${results.processed} patients`,
      results
    })

  } catch (error: any) {
    console.error('❌ Primary provider assignment failed:', error)
    return NextResponse.json({
      success: false,
      error: 'Assignment failed',
      details: error.message
    }, { status: 500 })
  }
}
