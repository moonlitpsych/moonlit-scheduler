/**
 * RosterTable Component
 *
 * Main table component for patient roster with sortable and resizable columns.
 * Adapts columns based on user role.
 */

import { ArrowUp, ArrowDown, ArrowUpDown, Users } from 'lucide-react'
import { useResizableColumns } from '@/hooks/useResizableColumns'
import { PatientRosterItem, UserRole, SortColumn } from '@/types/patient-roster'
import {
  PatientNameCell,
  EngagementStatusCell,
  AppointmentCell,
  ProviderCell,
  ContactCell
} from './cells'

interface RosterTableProps {
  patients: PatientRosterItem[]
  userType: UserRole
  sortColumn: SortColumn | null
  sortDirection: 'asc' | 'desc' | null
  onSort: (column: SortColumn) => void
  onResetWidths?: () => void

  // Feature flags
  enablePatientLinks?: boolean
  enableStatusEdit?: boolean

  // Event handlers
  onPatientClick?: (patient: PatientRosterItem) => void
  onStatusClick?: (patient: PatientRosterItem) => void
  onAppointmentClick?: (appointment: any, patientName: string) => void
  onCopyMeetLink?: (appointmentId: string, link: string) => void
  copiedAppointmentId?: string | null

  // Optional: Actions column content
  renderActions?: (patient: PatientRosterItem) => React.ReactNode
}

export function RosterTable({
  patients,
  userType,
  sortColumn,
  sortDirection,
  onSort,
  onResetWidths,
  enablePatientLinks = false,
  enableStatusEdit = false,
  onStatusClick,
  onAppointmentClick,
  onCopyMeetLink,
  copiedAppointmentId,
  renderActions
}: RosterTableProps) {
  // Resizable columns with role-specific defaults
  const defaultWidths = {
    patient: 200,
    status: 120,
    previous: 160,
    next: 140,
    provider: 150,
    payer: 150,
    caseManager: 150,
    organization: 180,
    contact: 200,
    actions: 180
  }

  const storageKey = `${userType}-patient-roster`
  const { columnWidths, handleMouseDown, resetWidths } = useResizableColumns(
    storageKey,
    defaultWidths
  )

  // Sort icon helper
  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="w-4 h-4 text-gray-400" />
    }
    if (sortDirection === 'asc') {
      return <ArrowUp className="w-4 h-4 text-moonlit-brown" />
    }
    return <ArrowDown className="w-4 h-4 text-moonlit-brown" />
  }

  // Header button component
  const SortableHeader = ({
    column,
    label,
    width
  }: {
    column: SortColumn
    label: string
    width: number
  }) => (
    <th
      style={{ width }}
      className="relative px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
    >
      <button
        onClick={() => onSort(column)}
        className="flex items-center gap-2 hover:text-moonlit-brown transition-colors"
      >
        {label}
        {getSortIcon(column)}
      </button>
      <div
        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-moonlit-brown"
        onMouseDown={(e) => handleMouseDown(column, e)}
      />
    </th>
  )

  if (patients.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="p-12 text-center">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 font-['Newsreader']">No patients to display.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="overflow-x-auto max-h-[calc(100vh-300px)] overflow-y-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
            <tr>
              {/* Patient Name - All roles */}
              <SortableHeader column="name" label="Patient" width={columnWidths.patient} />

              {/* Engagement Status - All roles */}
              <SortableHeader
                column="status"
                label="Engagement Status"
                width={columnWidths.status}
              />

              {/* Previous Appointment - All roles */}
              <SortableHeader
                column="previous"
                label="Previous Appointment"
                width={columnWidths.previous}
              />

              {/* Next Appointment - All roles */}
              <SortableHeader
                column="next"
                label="Next Appointment"
                width={columnWidths.next}
              />

              {/* Provider - All roles */}
              <SortableHeader
                column="provider"
                label="Provider"
                width={columnWidths.provider}
              />

              {/* Contact - All roles */}
              <SortableHeader column="contact" label="Contact" width={columnWidths.contact} />

              {/* Actions - If renderActions provided */}
              {renderActions && (
                <th
                  style={{ width: columnWidths.actions }}
                  className="relative px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Actions
                  <div
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-moonlit-brown"
                    onMouseDown={(e) => handleMouseDown('actions', e)}
                  />
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {patients.map((patient) => (
              <tr key={patient.id} className="hover:bg-gray-50">
                {/* Patient Name */}
                <td style={{ width: columnWidths.patient }} className="px-6 py-4 whitespace-nowrap">
                  <PatientNameCell
                    patient={patient}
                    userType={userType}
                    enablePatientLinks={enablePatientLinks}
                  />
                </td>

                {/* Engagement Status */}
                <td style={{ width: columnWidths.status }} className="px-6 py-4 whitespace-nowrap">
                  <EngagementStatusCell
                    patient={patient}
                    editable={enableStatusEdit}
                    onClick={() => onStatusClick?.(patient)}
                  />
                </td>

                {/* Previous Appointment */}
                <td style={{ width: columnWidths.previous }} className="px-6 py-4">
                  <AppointmentCell
                    appointment={patient.previous_appointment}
                    type="previous"
                    onAppointmentClick={() =>
                      onAppointmentClick?.(
                        patient.previous_appointment,
                        `${patient.first_name} ${patient.last_name}`
                      )
                    }
                  />
                </td>

                {/* Next Appointment */}
                <td style={{ width: columnWidths.next }} className="px-6 py-4">
                  <AppointmentCell
                    appointment={patient.next_appointment}
                    type="next"
                    onAppointmentClick={() =>
                      onAppointmentClick?.(
                        patient.next_appointment,
                        `${patient.first_name} ${patient.last_name}`
                      )
                    }
                    onCopyMeetLink={onCopyMeetLink}
                    copiedAppointmentId={copiedAppointmentId}
                  />
                </td>

                {/* Provider */}
                <td style={{ width: columnWidths.provider }} className="px-6 py-4 whitespace-nowrap">
                  <ProviderCell provider={patient.primary_provider} />
                </td>

                {/* Contact */}
                <td style={{ width: columnWidths.contact }} className="px-6 py-4">
                  <ContactCell patient={patient} />
                </td>

                {/* Actions */}
                {renderActions && (
                  <td style={{ width: columnWidths.actions }} className="px-6 py-4 whitespace-nowrap">
                    {renderActions(patient)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
