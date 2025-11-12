/**
 * AppointmentCell Component
 *
 * Displays appointment details with optional Google Meet link.
 * Handles both previous and upcoming appointments.
 */

import { Copy, CheckCircle, AlertCircle } from 'lucide-react'
import { AppointmentDetails } from '@/types/patient-roster'
import { formatDate, formatDateShort, formatRelativeTime } from '@/utils/patient-roster-helpers'

interface AppointmentCellProps {
  appointment: AppointmentDetails | null | undefined
  type: 'previous' | 'next'
  onAppointmentClick?: () => void
  onCopyMeetLink?: (appointmentId: string, link: string) => void
  copiedAppointmentId?: string | null
}

export function AppointmentCell({
  appointment,
  type,
  onAppointmentClick,
  onCopyMeetLink,
  copiedAppointmentId
}: AppointmentCellProps) {
  if (!appointment) {
    return <span className="text-sm text-gray-400">—</span>
  }

  const isFuture = type === 'next'
  const relativeTime = (() => {
    const appointmentDate = new Date(appointment.start_time)
    const now = new Date()
    const diffMs = isFuture
      ? appointmentDate.getTime() - now.getTime()
      : now.getTime() - appointmentDate.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (isFuture) {
      return `in ${diffDays} ${diffDays === 1 ? 'day' : 'days'}`
    } else {
      return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`
    }
  })()

  return (
    <div className="space-y-1">
      <div
        onClick={onAppointmentClick}
        className="cursor-pointer hover:bg-gray-50 rounded px-2 py-1 -mx-2 -my-1 transition-colors"
      >
        <div className="flex flex-col space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-900">
              {formatDateShort(appointment.start_time)}
            </span>
            {appointment.status === 'no_show' && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                No-show
              </span>
            )}
          </div>
          <span className="text-xs text-gray-500">{relativeTime}</span>
        </div>
        {appointment.providers && (
          <div className="text-xs text-gray-500">
            Dr. {appointment.providers.last_name}
          </div>
        )}
      </div>

      {/* Google Meet Link Chip */}
      {type === 'next' && (
        <div className="mt-2 px-2">
          {appointment.practiceq_generated_google_meet ? (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onCopyMeetLink?.(
                  appointment.id,
                  appointment.practiceq_generated_google_meet!
                )
              }}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100"
            >
              {copiedAppointmentId === appointment.id ? (
                <>
                  <CheckCircle className="w-3 h-3" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  Copy Meet Link
                </>
              )}
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600">
              <AlertCircle className="w-3 h-3" />
              No meet link
            </span>
          )}
        </div>
      )}
    </div>
  )
}
