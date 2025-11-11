/**
 * ContactCell Component
 *
 * Displays patient contact information (email and phone).
 */

import { PatientRosterItem } from '@/types/patient-roster'
import { formatPhone } from '@/utils/patient-roster-helpers'

interface ContactCellProps {
  patient: PatientRosterItem
}

export function ContactCell({ patient }: ContactCellProps) {
  return (
    <div className="text-sm text-gray-900">
      {patient.email && <div>{patient.email}</div>}
      {patient.phone && <div className="text-gray-500">{formatPhone(patient.phone)}</div>}
      {!patient.email && !patient.phone && <span className="text-gray-400">—</span>}
    </div>
  )
}
