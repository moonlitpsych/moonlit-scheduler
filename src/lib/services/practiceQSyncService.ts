/**
 * PracticeQ (IntakeQ) Appointment Sync Service
 *
 * Fetches appointments from IntakeQ API and syncs to our database
 * Handles deduplication, provider matching, status mapping
 */

import { createClient } from '@supabase/supabase-js'
import { intakeQService } from './intakeQService'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase credentials')
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

interface IntakeQAppointment {
  Id: string
  ClientId: string
  ClientName: string
  ClientEmail: string
  ClientPhone: string
  ClientDateOfBirth: string
  PractitionerId: string
  PractitionerName: string
  PractitionerEmail: string
  ServiceId: string
  LocationId: string
  Status: 'Confirmed' | 'Canceled' | 'WaitingConfirmation' | 'Declined' | 'Missed'
  StartDate: number // Unix timestamp in milliseconds
  EndDate: number
  StartDateIso: string
  EndDateIso: string
  Duration: number
}

interface SyncResult {
  success: boolean
  patientId: string
  patientName: string
  patientEmail: string
  syncedAt: string
  summary: {
    new: number
    updated: number
    unchanged: number
    errors: number
  }
  appointments: Array<{
    id: string
    pqAppointmentId: string
    startTime: string
    providerName: string | null
    status: string
    syncAction: 'created' | 'updated' | 'unchanged' | 'error'
    errorMessage?: string
  }>
  warnings: string[]
}

class PracticeQSyncService {
  /**
   * Sync appointments for a single patient from PracticeQ
   *
   * @param patientId - Moonlit patient ID
   * @param organizationId - Organization ID (for access control)
   * @param dateRange - Date range to sync (default: last 90 days + next 90 days)
   * @returns Sync result with summary
   */
  async syncPatientAppointments(
    patientId: string,
    organizationId: string,
    dateRange?: { startDate: string; endDate: string }
  ): Promise<SyncResult> {
    const warnings: string[] = []

    // 1. Get patient info
    const { data: patient, error: patientError } = await supabaseAdmin
      .from('patients')
      .select('id, first_name, last_name, email')
      .eq('id', patientId)
      .single()

    if (patientError || !patient) {
      throw new Error(`Patient not found: ${patientId}`)
    }

    if (!patient.email) {
      throw new Error(`Patient ${patientId} has no email address`)
    }

    console.log(`🔄 [PracticeQ Sync] Starting sync for ${patient.first_name} ${patient.last_name} (${patient.email})`)

    // 2. Verify patient is affiliated with organization
    const { data: affiliation, error: affError } = await supabaseAdmin
      .from('patient_organization_affiliations')
      .select('id')
      .eq('patient_id', patientId)
      .eq('organization_id', organizationId)
      .eq('status', 'active')
      .single()

    if (affError || !affiliation) {
      throw new Error(`Patient ${patientId} not affiliated with organization ${organizationId}`)
    }

    // 3. Calculate date range (default: last 90 days + next 90 days)
    const defaultStartDate = new Date()
    defaultStartDate.setDate(defaultStartDate.getDate() - 90)
    const defaultEndDate = new Date()
    defaultEndDate.setDate(defaultEndDate.getDate() + 90)

    const startDate = dateRange?.startDate || defaultStartDate.toISOString().split('T')[0]
    const endDate = dateRange?.endDate || defaultEndDate.toISOString().split('T')[0]

    console.log(`📅 [PracticeQ Sync] Date range: ${startDate} to ${endDate}`)

    // 4. Fetch appointments from IntakeQ
    let intakeqAppointments: IntakeQAppointment[]
    try {
      // IntakeQ API: GET /appointments?client={email}&startDate={date}&endDate={date}
      const response = await intakeQService.makeRequest<IntakeQAppointment[]>(
        `/appointments?client=${encodeURIComponent(patient.email)}&startDate=${startDate}&endDate=${endDate}`
      )
      intakeqAppointments = response || []
      console.log(`📥 [PracticeQ Sync] Fetched ${intakeqAppointments.length} appointments from IntakeQ`)
    } catch (error: any) {
      console.error('❌ [PracticeQ Sync] Failed to fetch from IntakeQ:', error.message)
      throw new Error(`Failed to fetch appointments from PracticeQ: ${error.message}`)
    }

    // 5. Process each appointment
    const summary = { new: 0, updated: 0, unchanged: 0, errors: 0 }
    const appointments: SyncResult['appointments'] = []

    for (const intakeqAppt of intakeqAppointments) {
      try {
        const result = await this.syncSingleAppointment(intakeqAppt, patientId, warnings)
        appointments.push(result)

        if (result.syncAction === 'created') summary.new++
        else if (result.syncAction === 'updated') summary.updated++
        else if (result.syncAction === 'unchanged') summary.unchanged++
        else if (result.syncAction === 'error') summary.errors++
      } catch (error: any) {
        console.error(`❌ [PracticeQ Sync] Error processing appointment ${intakeqAppt.Id}:`, error.message)
        summary.errors++
        appointments.push({
          id: '',
          pqAppointmentId: intakeqAppt.Id,
          startTime: intakeqAppt.StartDateIso,
          providerName: intakeqAppt.PractitionerName,
          status: intakeqAppt.Status,
          syncAction: 'error',
          errorMessage: error.message
        })
      }
    }

    // 6. Update last sync time
    await supabaseAdmin
      .from('patient_organization_affiliations')
      .update({ last_practiceq_sync_at: new Date().toISOString() })
      .eq('patient_id', patientId)
      .eq('organization_id', organizationId)

    console.log(`✅ [PracticeQ Sync] Complete: ${summary.new} new, ${summary.updated} updated, ${summary.unchanged} unchanged, ${summary.errors} errors`)

    return {
      success: summary.errors === 0,
      patientId,
      patientName: `${patient.first_name} ${patient.last_name}`,
      patientEmail: patient.email,
      syncedAt: new Date().toISOString(),
      summary,
      appointments,
      warnings
    }
  }

  /**
   * Process a single IntakeQ appointment
   */
  private async syncSingleAppointment(
    intakeqAppt: IntakeQAppointment,
    patientId: string,
    warnings: string[]
  ): Promise<SyncResult['appointments'][0]> {
    // 1. Check if appointment already exists
    const { data: existing } = await supabaseAdmin
      .from('appointments')
      .select('id, status, start_time, provider_id')
      .eq('pq_appointment_id', intakeqAppt.Id)
      .single()

    // 2. Map provider from IntakeQ PractitionerId
    const providerId = await this.mapProvider(intakeqAppt.PractitionerId, warnings)

    if (!providerId) {
      warnings.push(
        `⚠️ Unknown practitioner ${intakeqAppt.PractitionerId} (${intakeqAppt.PractitionerName}) - appointment ${intakeqAppt.Id} created without provider. Admin action required.`
      )
    }

    // 3. Map status
    const status = this.mapStatus(intakeqAppt.Status)

    // 4. Convert ISO date to timestamptz (IntakeQ returns UTC, convert to Mountain Time)
    const startTime = new Date(intakeqAppt.StartDateIso).toISOString()
    const endTime = new Date(intakeqAppt.EndDateIso).toISOString()

    // 5. Create or update appointment
    if (existing) {
      // Check if anything changed
      const hasChanges =
        existing.status !== status ||
        new Date(existing.start_time).getTime() !== new Date(startTime).getTime() ||
        existing.provider_id !== providerId

      if (!hasChanges) {
        return {
          id: existing.id,
          pqAppointmentId: intakeqAppt.Id,
          startTime,
          providerName: intakeqAppt.PractitionerName,
          status,
          syncAction: 'unchanged'
        }
      }

      // Update existing appointment
      const { data: updated, error } = await supabaseAdmin
        .from('appointments')
        .update({
          status,
          start_time: startTime,
          end_time: endTime,
          provider_id: providerId,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select('id')
        .single()

      if (error) throw error

      return {
        id: updated.id,
        pqAppointmentId: intakeqAppt.Id,
        startTime,
        providerName: intakeqAppt.PractitionerName,
        status,
        syncAction: 'updated'
      }
    } else {
      // Create new appointment
      const { data: created, error } = await supabaseAdmin
        .from('appointments')
        .insert({
          patient_id: patientId,
          provider_id: providerId,
          start_time: startTime,
          end_time: endTime,
          status,
          appointment_type: 'initial', // Default, can be updated later
          pq_appointment_id: intakeqAppt.Id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('id')
        .single()

      if (error) throw error

      return {
        id: created.id,
        pqAppointmentId: intakeqAppt.Id,
        startTime,
        providerName: intakeqAppt.PractitionerName,
        status,
        syncAction: 'created'
      }
    }
  }

  /**
   * Map IntakeQ PractitionerId to Moonlit provider_id
   */
  private async mapProvider(practitionerId: string, warnings: string[]): Promise<string | null> {
    const { data, error } = await supabaseAdmin
      .from('provider_intakeq_settings')
      .select('provider_id')
      .eq('practitioner_id', practitionerId)
      .single()

    if (error || !data) {
      console.warn(`⚠️ [PracticeQ Sync] Unknown practitioner: ${practitionerId}`)
      return null
    }

    return data.provider_id
  }

  /**
   * Map IntakeQ status to Moonlit status
   */
  private mapStatus(intakeqStatus: IntakeQAppointment['Status']): string {
    const statusMap: Record<string, string> = {
      'Confirmed': 'confirmed',
      'Canceled': 'cancelled',
      'WaitingConfirmation': 'scheduled',
      'Declined': 'cancelled',
      'Missed': 'no_show'
    }

    return statusMap[intakeqStatus] || 'scheduled'
  }
}

export const practiceQSyncService = new PracticeQSyncService()
