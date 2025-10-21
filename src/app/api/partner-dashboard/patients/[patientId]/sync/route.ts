/**
 * API Endpoint: Sync Patient Appointments from PracticeQ
 *
 * POST /api/partner-dashboard/patients/[patientId]/sync
 *
 * Fetches latest appointments from IntakeQ and syncs to database
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { practiceQSyncService } from '@/lib/services/practiceQSyncService'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ patientId: string }> }
) {
  try {
    const { patientId } = await params

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

    // 2. Get partner user and verify access
    const { data: partnerUser, error: partnerError } = await supabaseAdmin
      .from('partner_users')
      .select('id, organization_id, role, is_active')
      .eq('auth_user_id', user.id)
      .eq('is_active', true)
      .single()

    if (partnerError || !partnerUser) {
      return NextResponse.json({ error: 'Partner user not found' }, { status: 403 })
    }

    // 3. Verify patient is affiliated with partner's organization
    const { data: affiliation, error: affError } = await supabaseAdmin
      .from('patient_organization_affiliations')
      .select('id')
      .eq('patient_id', patientId)
      .eq('organization_id', partnerUser.organization_id)
      .eq('status', 'active')
      .single()

    if (affError || !affiliation) {
      return NextResponse.json(
        { error: 'Patient not affiliated with your organization' },
        { status: 403 }
      )
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

    // 5. Sync appointments
    console.log(`🔄 [Sync API] Starting sync for patient ${patientId}`)
    const result = await practiceQSyncService.syncPatientAppointments(
      patientId,
      partnerUser.organization_id,
      dateRange
    )

    // 6. Log activity
    await supabaseAdmin.from('patient_activity_log').insert({
      patient_id: patientId,
      organization_id: partnerUser.organization_id,
      activity_type: 'practiceq_sync',
      description: `Synced ${result.summary.new + result.summary.updated + result.summary.unchanged} appointments from PracticeQ`,
      metadata: {
        summary: result.summary,
        warnings: result.warnings,
        synced_by: partnerUser.id
      },
      visible_to_partner: true,
      performed_by_user_id: partnerUser.id,
      created_at: new Date().toISOString()
    })

    // 7. If there are warnings about missing providers, notify admin
    if (result.warnings.length > 0) {
      console.warn('⚠️ [Sync API] Warnings during sync:', result.warnings)
      // TODO: Send email to admin about missing practitioner mappings
    }

    return NextResponse.json(result, { status: 200 })
  } catch (error: any) {
    console.error('❌ [Sync API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to sync appointments' },
      { status: 500 }
    )
  }
}
