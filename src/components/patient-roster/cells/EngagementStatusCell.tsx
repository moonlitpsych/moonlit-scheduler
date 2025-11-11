/**
 * EngagementStatusCell Component
 *
 * Displays patient engagement status as a colored chip.
 * Optionally clickable to change status (partner role).
 */

import { PatientRosterItem } from '@/types/patient-roster'
import {
  getEngagementStatusColor,
  getEngagementStatusLabel
} from '@/utils/patient-roster-helpers'

interface EngagementStatusCellProps {
  patient: PatientRosterItem
  onClick?: () => void
  editable?: boolean
}

export function EngagementStatusCell({
  patient,
  onClick,
  editable = false
}: EngagementStatusCellProps) {
  const statusColor = getEngagementStatusColor(patient.engagement_status)
  const statusLabel = getEngagementStatusLabel(patient.engagement_status)

  const content = (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${statusColor}`}
    >
      {statusLabel}
    </span>
  )

  if (editable && onClick) {
    return (
      <button
        onClick={onClick}
        className="hover:opacity-80 transition-opacity"
        title="Click to change status"
      >
        {content}
      </button>
    )
  }

  return content
}
