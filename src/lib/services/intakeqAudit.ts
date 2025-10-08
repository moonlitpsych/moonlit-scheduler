/**
 * IntakeQ Sync Audit Trail Service
 *
 * V2.0: Logs all IntakeQ sync operations to database audit table
 */

import { supabaseAdmin } from '@/lib/supabase'
import { getFeatureFlagsStatus } from '@/lib/config/featureFlags'

export interface AuditLogParams {
  action: 'create_client' | 'update_client' | 'create_appointment' | 'duplicate_detected' | 'enrichment_applied'
  status: 'success' | 'failed' | 'duplicate_detected' | 'blocked' | 'retry_needed'
  patientId?: string
  appointmentId?: string
  intakeqClientId?: string
  intakeqAppointmentId?: string
  payload?: any
  response?: any
  error?: string
  duplicateInfo?: any
  enrichmentData?: any
  durationMs?: number
}

/**
 * Log IntakeQ sync operation to audit trail
 */
export async function logIntakeqSync(params: AuditLogParams): Promise<string | null> {
  try {
    // Capture feature flag state at time of sync
    const featureFlagsSnapshot = getFeatureFlagsStatus()

    const { data, error } = await supabaseAdmin
      .from('intakeq_sync_audit')
      .insert({
        action: params.action,
        status: params.status,
        patient_id: params.patientId || null,
        appointment_id: params.appointmentId || null,
        intakeq_client_id: params.intakeqClientId || null,
        intakeq_appointment_id: params.intakeqAppointmentId || null,
        payload: params.payload ? JSON.parse(JSON.stringify(params.payload)) : null,
        response: params.response ? JSON.parse(JSON.stringify(params.response)) : null,
        error: params.error || null,
        duplicate_info: params.duplicateInfo ? JSON.parse(JSON.stringify(params.duplicateInfo)) : null,
        enrichment_data: params.enrichmentData ? JSON.parse(JSON.stringify(params.enrichmentData)) : null,
        feature_flags: featureFlagsSnapshot,
        duration_ms: params.durationMs || null
      })
      .select('id')
      .single()

    if (error) {
      console.error('❌ Failed to log IntakeQ sync to audit trail:', error)
      return null
    }

    console.log(`📝 Audit logged: ${params.action} - ${params.status} (ID: ${data.id})`)
    return data.id

  } catch (error) {
    console.error('❌ Error logging IntakeQ sync to audit trail:', error)
    return null
  }
}

/**
 * Get recent audit logs for a patient
 */
export async function getPatientAuditLogs(patientId: string, limit: number = 10) {
  try {
    const { data, error } = await supabaseAdmin
      .from('intakeq_sync_audit')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('❌ Failed to fetch patient audit logs:', error)
      return []
    }

    return data || []

  } catch (error) {
    console.error('❌ Error fetching patient audit logs:', error)
    return []
  }
}

/**
 * Get failed syncs for monitoring/alerting
 */
export async function getFailedSyncs(hoursAgo: number = 24) {
  try {
    const cutoffTime = new Date()
    cutoffTime.setHours(cutoffTime.getHours() - hoursAgo)

    const { data, error } = await supabaseAdmin
      .from('intakeq_sync_audit')
      .select('*')
      .eq('status', 'failed')
      .gte('created_at', cutoffTime.toISOString())
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ Failed to fetch failed syncs:', error)
      return []
    }

    return data || []

  } catch (error) {
    console.error('❌ Error fetching failed syncs:', error)
    return []
  }
}
