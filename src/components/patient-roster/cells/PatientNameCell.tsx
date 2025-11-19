/**
 * PatientNameCell Component
 *
 * Displays patient name with optional link and badges.
 */

import Link from 'next/link'
import { PatientRosterItem, UserRole } from '@/types/patient-roster'
import { formatPatientName } from '@/utils/patient-roster-helpers'

interface PatientNameCellProps {
  patient: PatientRosterItem
  userType: UserRole
  enablePatientLinks?: boolean
}

export function PatientNameCell({
  patient,
  userType,
  enablePatientLinks = false
}: PatientNameCellProps) {
  const patientName = formatPatientName(patient)
  const linkPath = userType === 'partner'
    ? `/partner-dashboard/patients/${patient.id}`
    : userType === 'provider'
    ? `/dashboard/patients/${patient.id}`
    : `/admin/patients/${patient.id}`

  return (
    <div className="flex items-center">
      <div>
        {enablePatientLinks ? (
          <Link
            href={linkPath}
            className="text-sm font-medium text-moonlit-brown hover:text-moonlit-brown/80 hover:underline"
          >
            {patientName}
          </Link>
        ) : (
          <span className="text-sm font-medium text-gray-900">{patientName}</span>
        )}

        {/* Partner-specific badges */}
        {userType === 'partner' && patient.is_assigned_to_me && (
          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
            Assigned
          </span>
        )}

        {/* Insurance payer info */}
        {patient.primary_payer && (
          <div className="text-sm text-gray-500 mt-1">{patient.primary_payer.name}</div>
        )}
      </div>
    </div>
  )
}
