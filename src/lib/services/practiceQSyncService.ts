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
  LocationName?: string
  PlaceOfService?: string
  TelehealthInfo?: {
    Url?: string
    MeetingUrl?: string
    VideoUrl?: string
  } | null
  Status: 'Confirmed' | 'Canceled' | 'WaitingConfirmation' | 'Declined' | 'Missed'
  StartDate: number // Unix timestamp in milliseconds
  EndDate: number
  StartDateIso: string
  EndDateIso: string
  Duration: number
  CustomFields?: Array<{
    Label?: string
    Name?: string
    Value?: string
    Answer?: string
  }>
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
   * @param organizationId - Organization ID (for access control, null for admin/provider sync)
   * @param dateRange - Date range to sync (default: last 90 days + next 90 days)
   * @returns Sync result with summary
   */
  async syncPatientAppointments(
    patientId: string,
    organizationId: string | null,
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

    // 2. Verify patient is affiliated with organization (skip for admin/provider sync)
    if (organizationId) {
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
    } else {
      console.log(`🔓 [PracticeQ Sync] Skipping organization check (admin/provider sync)`)
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

        // Update patient payer from appointment custom fields (if available)
        await this.updatePatientPayer(patientId, intakeqAppt)
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
    if (organizationId) {
      // Partner dashboard: update affiliation sync time
      await supabaseAdmin
        .from('patient_organization_affiliations')
        .update({ last_practiceq_sync_at: new Date().toISOString() })
        .eq('patient_id', patientId)
        .eq('organization_id', organizationId)
    } else {
      // Admin/provider dashboard: update patient sync time
      await supabaseAdmin
        .from('patients')
        .update({ last_intakeq_sync: new Date().toISOString() })
        .eq('id', patientId)
    }

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

    // 4.5. Extract meeting URL and location info
    const meetingUrl = this.extractMeetingUrl(intakeqAppt)
    const locationInfo = this.extractLocationInfo(intakeqAppt)

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
          meeting_url: meetingUrl,
          location_info: locationInfo,
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
          meeting_url: meetingUrl,
          location_info: locationInfo,
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

  /**
   * Extract insurance company name from IntakeQ custom fields
   */
  private extractInsuranceFromCustomFields(appointment: IntakeQAppointment): string | null {
    if (!appointment.CustomFields || appointment.CustomFields.length === 0) {
      return null
    }

    // Look for insurance-related custom fields
    const insuranceField = appointment.CustomFields.find(field => {
      const label = (field.Label || field.Name || '').toLowerCase()
      return label.includes('insurance company') ||
             label.includes('name of your insurance') ||
             label.includes('insurance provider')
    })

    if (!insuranceField) {
      return null
    }

    const insuranceName = insuranceField.Value || insuranceField.Answer
    return insuranceName ? insuranceName.trim() : null
  }

  /**
   * Map insurance name from IntakeQ to payer ID
   */
  private async mapInsuranceToPayer(insuranceName: string): Promise<string | null> {
    // Normalize the insurance name
    const normalized = insuranceName.toLowerCase().trim()

    // Define mappings from common IntakeQ insurance names to payer names
    const mappings: Record<string, string[]> = {
      'dmba': ['DMBA'],
      'health choice': ['Health Choice Utah', 'HCU'],
      'molina': ['Molina Utah'],
      'uuhp': ['HealthyU (UUHP)', 'University of Utah Health Plans (UUHP)'],
      'selecthealth': ['SelectHealth Integrated', 'SelectHealth Care', 'SelectHealth Med', 'SelectHealth Value'],
      'utah medicaid': ['Utah Medicaid Fee-for-Service'],
      'medicaid': ['Utah Medicaid Fee-for-Service', 'Molina Utah', 'Health Choice Utah', 'HealthyU (UUHP)', 'SelectHealth Integrated'],
      'tam': ['Utah Medicaid Fee-for-Service'], // Targeted Adult Medicaid
      'hmhi': ['HMHI BHN'],
      'optum': ['Optum Commercial Behavioral Health', 'Optum Salt Lake and Tooele County Medicaid Network'],
      'united': ['United Healthcare'],
      'aetna': ['Aetna'],
      'cigna': ['Cigna'],
      'regence': ['Regence BlueCross BlueShield'],
      'tricare': ['TriCare West'],
      'triwest': ['TriWest']
    }

    // Find matching payer names
    let possiblePayerNames: string[] = []
    for (const [key, payerNames] of Object.entries(mappings)) {
      if (normalized.includes(key)) {
        possiblePayerNames = payerNames
        break
      }
    }

    if (possiblePayerNames.length === 0) {
      console.warn(`⚠️ [Insurance Mapping] Unknown insurance name: "${insuranceName}"`)
      return null
    }

    // Query database for matching payer (case-insensitive, Utah only)
    const { data: payers, error } = await supabaseAdmin
      .from('payers')
      .select('id, name')
      .eq('state', 'UT')
      .in('name', possiblePayerNames)
      .limit(1)

    if (error || !payers || payers.length === 0) {
      console.warn(`⚠️ [Insurance Mapping] No payer found for "${insuranceName}" (tried: ${possiblePayerNames.join(', ')})`)
      return null
    }

    console.log(`✅ [Insurance Mapping] Mapped "${insuranceName}" → ${payers[0].name} (${payers[0].id})`)
    return payers[0].id
  }

  /**
   * Update patient's primary payer from appointment insurance data
   */
  private async updatePatientPayer(patientId: string, appointment: IntakeQAppointment): Promise<void> {
    // Extract insurance from custom fields
    const insuranceName = this.extractInsuranceFromCustomFields(appointment)

    if (!insuranceName) {
      return // No insurance info in this appointment
    }

    // Map to payer ID
    const payerId = await this.mapInsuranceToPayer(insuranceName)

    if (!payerId) {
      return // Couldn't map to a known payer
    }

    // Update patient's primary payer
    const { error } = await supabaseAdmin
      .from('patients')
      .update({
        primary_payer_id: payerId,
        updated_at: new Date().toISOString()
      })
      .eq('id', patientId)

    if (error) {
      console.error(`❌ [Payer Update] Failed to update patient ${patientId}:`, error)
    } else {
      console.log(`✅ [Payer Update] Updated patient ${patientId} with payer ${payerId}`)
    }
  }

  /**
   * Extract meeting URL from IntakeQ TelehealthInfo
   */
  private extractMeetingUrl(appointment: IntakeQAppointment): string | null {
    if (!appointment.TelehealthInfo) {
      return null
    }

    // Try different possible field names
    const url = appointment.TelehealthInfo.Url ||
                appointment.TelehealthInfo.MeetingUrl ||
                appointment.TelehealthInfo.VideoUrl

    if (url && typeof url === 'string') {
      console.log(`📹 [Meeting URL] Extracted: ${url}`)
      return url
    }

    // If TelehealthInfo is not null but has no URL, log for debugging
    if (appointment.TelehealthInfo) {
      console.log(`⚠️ [Meeting URL] TelehealthInfo present but no URL found:`, appointment.TelehealthInfo)
    }

    return null
  }

  /**
   * Extract location information from IntakeQ appointment
   */
  private extractLocationInfo(appointment: IntakeQAppointment): any {
    const locationInfo: any = {}

    if (appointment.LocationId) {
      locationInfo.locationId = appointment.LocationId
    }

    if (appointment.LocationName) {
      locationInfo.locationName = appointment.LocationName
    }

    if (appointment.PlaceOfService) {
      locationInfo.placeOfService = appointment.PlaceOfService
      // Determine location type from place of service code
      // 02 = Telehealth provided other than in patient's home
      // 10 = Telehealth provided in patient's home
      // 11 = Office
      // 12 = Home
      if (appointment.PlaceOfService === '02' || appointment.PlaceOfService === '10') {
        locationInfo.locationType = 'telehealth'
      } else if (appointment.PlaceOfService === '11') {
        locationInfo.locationType = 'office'
      } else if (appointment.PlaceOfService === '12') {
        locationInfo.locationType = 'home'
      }
    }

    // If we have any location data, return it
    if (Object.keys(locationInfo).length > 0) {
      console.log(`📍 [Location] Extracted:`, locationInfo)
      return locationInfo
    }

    return null
  }
}

export const practiceQSyncService = new PracticeQSyncService()
