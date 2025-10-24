/**
 * API Endpoint: Sync Patient Appointments from PracticeQ (Admin/Provider)
 *
 * POST /api/patients/[id]/sync
 *
 * Fetches latest appointments from IntakeQ and syncs to database
 * For use by admin and provider dashboards
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { practiceQSyncService } from '@/lib/services/practiceQSyncService'
import { isAdminEmail } from '@/lib/admin-auth'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: patientId } = await params

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

    // 2. Verify user is admin or provider with access to this patient
    const isAdmin = isAdminEmail(user.email || '')

    if (!isAdmin) {
      // Check if user is a provider assigned to this patient
      const { data: provider, error: providerError } = await supabaseAdmin
        .from('providers')
        .select('id')
        .eq('auth_user_id', user.id)
        .eq('is_active', true)
        .single()

      if (providerError || !provider) {
        return NextResponse.json({ error: 'Provider not found' }, { status: 403 })
      }

      // Verify patient is assigned to this provider
      const { data: patient, error: patientError } = await supabaseAdmin
        .from('patients')
        .select('primary_provider_id')
        .eq('id', patientId)
        .single()

      if (patientError || !patient || patient.primary_provider_id !== provider.id) {
        return NextResponse.json(
          { error: 'Patient not assigned to you' },
          { status: 403 }
        )
      }
    }

    // 3. Parse request body (optional date range)
    let dateRange: { startDate: string; endDate: string } | undefined
    try {
      const body = await request.json()
      if (body.dateRange) {
        dateRange = body.dateRange
      }
    } catch {
      // No body or invalid JSON - use default date range
    }

    // 4. Sync appointments
    console.log(`🔄 [Sync API] Starting sync for patient ${patientId}`)
    const result = await practiceQSyncService.syncPatientAppointments(
      patientId,
      null, // No organization ID for admin/provider sync
      dateRange
    )

    // 5. Return result
    return NextResponse.json(result, { status: 200 })
  } catch (error: any) {
    console.error('❌ [Sync API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to sync appointments' },
      { status: 500 }
    )
  }
}
