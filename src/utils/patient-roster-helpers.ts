/**
 * Patient Roster Helper Utilities
 *
 * Shared helper functions for patient roster operations across all user roles.
 */

import {
  PatientRosterItem,
  EngagementStatus,
  AppointmentStatus,
  ConsentStatus,
  UserRole
} from '@/types/patient-roster'
import { exportToCSV, formatDateForCSV, formatRelativeTime } from './csvExport'

/**
 * Date Formatting
 */

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return ''
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  } catch {
    return ''
  }
}

export function formatDateShort(dateString: string | null | undefined): string {
  if (!dateString) return ''
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  } catch {
    return ''
  }
}

export function formatTime(dateString: string | null | undefined): string {
  if (!dateString) return ''
  try {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    })
  } catch {
    return ''
  }
}

/**
 * Status Helpers
 */

export function getEngagementStatusColor(status: EngagementStatus): string {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-800'
    case 'inactive':
      return 'bg-gray-100 text-gray-800'
    case 'discharged':
      return 'bg-blue-100 text-blue-800'
    case 'transferred':
      return 'bg-purple-100 text-purple-800'
    case 'deceased':
      return 'bg-black text-white'
    case 'unresponsive':
      return 'bg-yellow-100 text-yellow-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

export function getEngagementStatusLabel(status: EngagementStatus): string {
  switch (status) {
    case 'active':
      return 'Active'
    case 'inactive':
      return 'Inactive'
    case 'discharged':
      return 'Discharged'
    case 'transferred':
      return 'Transferred'
    case 'deceased':
      return 'Deceased'
    case 'unresponsive':
      return 'Unresponsive'
    default:
      return status
  }
}

export function getAppointmentStatusColor(status: AppointmentStatus): string {
  switch (status) {
    case 'scheduled':
      return 'bg-blue-100 text-blue-800'
    case 'confirmed':
      return 'bg-green-100 text-green-800'
    case 'completed':
      return 'bg-gray-100 text-gray-800'
    case 'cancelled':
      return 'bg-red-100 text-red-800'
    case 'no_show':
      return 'bg-orange-100 text-orange-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

export function getAppointmentStatusLabel(status: AppointmentStatus): string {
  switch (status) {
    case 'scheduled':
      return 'Scheduled'
    case 'confirmed':
      return 'Confirmed'
    case 'completed':
      return 'Completed'
    case 'cancelled':
      return 'Cancelled'
    case 'no_show':
      return 'No Show'
    default:
      return status
  }
}

export function getConsentStatusColor(status: ConsentStatus): string {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-800'
    case 'expired':
      return 'bg-red-100 text-red-800'
    case 'missing':
      return 'bg-yellow-100 text-yellow-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

export function getConsentStatusLabel(status: ConsentStatus): string {
  switch (status) {
    case 'active':
      return 'Active'
    case 'expired':
      return 'Expired'
    case 'missing':
      return 'Missing'
    default:
      return status
  }
}

/**
 * Provider Name Formatting
 */

export function formatProviderName(
  provider: { first_name: string; last_name: string } | null | undefined,
  includeTitle: boolean = true
): string {
  if (!provider) return ''
  const title = includeTitle ? 'Dr. ' : ''
  return `${title}${provider.first_name} ${provider.last_name}`
}

export function formatProviderNameShort(
  provider: { first_name: string; last_name: string } | null | undefined
): string {
  if (!provider) return ''
  return `Dr. ${provider.last_name}`
}

/**
 * Patient Name Formatting
 */

export function formatPatientName(patient: PatientRosterItem): string {
  return `${patient.first_name} ${patient.last_name}`
}

export function formatPatientNameReversed(patient: PatientRosterItem): string {
  return `${patient.last_name}, ${patient.first_name}`
}

/**
 * Contact Info Formatting
 */

export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return ''
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '')
  // Format as (XXX) XXX-XXXX
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  }
  return phone
}

/**
 * CSV Export for Patient Roster
 */

interface ExportPatientRosterOptions {
  patients: PatientRosterItem[]
  userType: UserRole
  filename?: string
}

export function exportPatientRosterToCSV(options: ExportPatientRosterOptions): void {
  const { patients, userType, filename } = options

  // Base columns for all roles
  const baseData = patients.map(patient => ({
    name: formatPatientName(patient),
    email: patient.email || '',
    phone: formatPhone(patient.phone),
    status: getEngagementStatusLabel(patient.engagement_status),
    previousAppointment: patient.previous_appointment
      ? formatDateForCSV(patient.previous_appointment.start_time)
      : '',
    previousAppointmentRelative: patient.previous_appointment
      ? formatRelativeTime(patient.previous_appointment.start_time, false)
      : '',
    previousAppointmentStatus: patient.previous_appointment
      ? getAppointmentStatusLabel(patient.previous_appointment.status as AppointmentStatus)
      : '',
    nextAppointment: patient.next_appointment
      ? formatDateForCSV(patient.next_appointment.start_time)
      : '',
    nextAppointmentRelative: patient.next_appointment
      ? formatRelativeTime(patient.next_appointment.start_time, true)
      : '',
    provider: patient.primary_provider
      ? formatProviderNameShort(patient.primary_provider)
      : '',
    payer: patient.primary_payer?.name || '',
    // Role-specific fields
    ...(userType === 'partner' && patient.roi
      ? {
          roiStatus: getConsentStatusLabel(patient.roi.consent_status),
          roiExpiresOn: patient.roi.consent_expires_on
            ? formatDateForCSV(patient.roi.consent_expires_on)
            : '',
          isAssignedToMe: patient.is_assigned_to_me ? 'Yes' : 'No',
          assignedTo: patient.current_assignment?.partner_user_name || ''
        }
      : {}),
    ...(userType !== 'partner'
      ? {
          caseManager: patient.case_manager_name || '',
          organizations: patient.affiliation_details
            ?.map(aff => aff.org_name)
            .join('; ') || ''
        }
      : {})
  }))

  // Column mapping based on role
  const baseColumns = {
    name: 'Patient Name',
    email: 'Email',
    phone: 'Phone',
    status: 'Status',
    previousAppointment: 'Previous Appointment',
    previousAppointmentRelative: 'Days Since',
    previousAppointmentStatus: 'Previous Status',
    nextAppointment: 'Next Appointment',
    nextAppointmentRelative: 'Days Until',
    provider: 'Provider',
    payer: 'Insurance'
  }

  const partnerColumns = {
    ...baseColumns,
    roiStatus: 'ROI Status',
    roiExpiresOn: 'ROI Expires',
    isAssignedToMe: 'Assigned to Me',
    assignedTo: 'Assigned To'
  }

  const providerAdminColumns = {
    ...baseColumns,
    caseManager: 'Case Manager',
    organizations: 'Organizations'
  }

  const columnMapping = userType === 'partner' ? partnerColumns : providerAdminColumns

  // Generate filename if not provided
  const timestamp = new Date().toISOString().split('T')[0]
  const defaultFilename = `${userType}-patients-${timestamp}.csv`

  exportToCSV(baseData, filename || defaultFilename, columnMapping)
}

/**
 * Filter Helpers
 */

export function hasActiveFutureAppointment(patient: PatientRosterItem): boolean {
  if (!patient.next_appointment) return false
  const now = new Date()
  const appointmentDate = new Date(patient.next_appointment.start_time)
  return appointmentDate > now && patient.next_appointment.status !== 'cancelled'
}

export function hasROIExpired(patient: PatientRosterItem): boolean {
  if (!patient.roi || !patient.roi.consent_expires_on) return false
  const expirationDate = new Date(patient.roi.consent_expires_on)
  return expirationDate < new Date()
}

export function hasROIMissing(patient: PatientRosterItem): boolean {
  return patient.roi?.consent_status === 'missing'
}

export function daysSinceLastAppointment(patient: PatientRosterItem): number | null {
  if (!patient.previous_appointment) return null
  const appointmentDate = new Date(patient.previous_appointment.start_time)
  const now = new Date()
  const diffMs = now.getTime() - appointmentDate.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

export function daysUntilNextAppointment(patient: PatientRosterItem): number | null {
  if (!patient.next_appointment) return null
  const appointmentDate = new Date(patient.next_appointment.start_time)
  const now = new Date()
  const diffMs = appointmentDate.getTime() - now.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

/**
 * Search Helpers
 */

export function matchesSearchTerm(patient: PatientRosterItem, searchTerm: string): boolean {
  if (!searchTerm) return true
  const search = searchTerm.toLowerCase()
  return (
    formatPatientName(patient).toLowerCase().includes(search) ||
    patient.email?.toLowerCase().includes(search) ||
    patient.phone?.includes(search) ||
    false
  )
}

/**
 * Dropdown Options Helpers
 */

export function getUniqueProviders(patients: PatientRosterItem[]): Array<{
  id: string
  name: string
}> {
  const providerMap = new Map<string, string>()
  patients.forEach(patient => {
    if (patient.primary_provider && patient.primary_provider_id) {
      providerMap.set(
        patient.primary_provider_id,
        formatProviderName(patient.primary_provider)
      )
    }
  })
  return Array.from(providerMap.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function getUniquePayers(patients: PatientRosterItem[]): Array<{
  id: string
  name: string
}> {
  const payerMap = new Map<string, string>()
  patients.forEach(patient => {
    if (patient.primary_payer && patient.primary_payer_id) {
      payerMap.set(patient.primary_payer_id, patient.primary_payer.name)
    }
  })
  return Array.from(payerMap.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function getUniqueOrganizations(patients: PatientRosterItem[]): Array<{
  id: string
  name: string
}> {
  const orgMap = new Map<string, string>()
  patients.forEach(patient => {
    patient.affiliation_details?.forEach(aff => {
      orgMap.set(aff.org_id, aff.org_name)
    })
  })
  return Array.from(orgMap.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function getUniqueCaseManagers(patients: PatientRosterItem[]): Array<{
  id: string
  name: string
}> {
  const managerMap = new Map<string, string>()
  patients.forEach(patient => {
    if (patient.primary_case_manager_id && patient.case_manager_name) {
      managerMap.set(patient.primary_case_manager_id, patient.case_manager_name)
    }
  })
  return Array.from(managerMap.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name))
}
