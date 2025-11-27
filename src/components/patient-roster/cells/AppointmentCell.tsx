/**
 * AppointmentCell Component
 *
 * Displays appointment details with optional Google Meet link.
 * Handles both previous and upcoming appointments.
 *
 * Meeting URL Priority:
 * 1. practiceq_generated_google_meet (manually entered from IntakeQ UI)
 * 2. meeting_url (auto-generated or from other sources)
 */

import { Copy, CheckCircle, Video } from 'lucide-react'
import { AppointmentDetails } from '@/types/patient-roster'
import { formatDate, formatDateShort, formatRelativeTime } from '@/utils/patient-roster-helpers'

interface AppointmentCellProps {
  appointment: AppointmentDetails | null | undefined
  type: 'previous' | 'next'
  onAppointmentClick?: () => void
  onCopyMeetLink?: (appointmentId: string, link: string) => void
  copiedAppointmentId?: string | null
}

/**
 * Get the best available meeting URL for an appointment
 * Prioritizes practiceq_generated_google_meet over meeting_url
 */
function getMeetingUrl(appointment: AppointmentDetails): string | null {
  // Priority 1: Manually entered link from IntakeQ UI
  if (appointment.practiceq_generated_google_meet) {
    return appointment.practiceq_generated_google_meet
  }
  // Priority 2: Auto-generated or other meeting URL
  if (appointment.meeting_url) {
    return appointment.meeting_url
  }
  return null
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

      {/* Google Meet Link Chip - Show for future telehealth appointments */}
      {type === 'next' && (
        <div className="mt-2 px-2">
          {(() => {
            const meetingUrl = getMeetingUrl(appointment)
            const isTelehealth = appointment.location_info?.locationType === 'telehealth' ||
                                 appointment.location_info?.placeOfService === '02' ||
                                 appointment.location_info?.placeOfService === '10'

            if (meetingUrl) {
              return (
                <div className="flex items-center gap-1">
                  {/* Join button */}
                  <a
                    href={meetingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100"
                    title="Open video call"
                  >
                    <Video className="w-3 h-3" />
                    Join
                  </a>
                  {/* Copy button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onCopyMeetLink?.(appointment.id, meetingUrl)
                    }}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100"
                    title="Copy meeting link"
                  >
                    {copiedAppointmentId === appointment.id ? (
                      <>
                        <CheckCircle className="w-3 h-3" />
                        Copied!
                      </>
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              )
            } else if (isTelehealth) {
              // Telehealth appointment but no link yet
              return (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-500">
                  <Video className="w-3 h-3" />
                  No link
                </span>
              )
            } else {
              // In-person appointment - no meeting link needed
              return null
            }
          })()}
        </div>
      )}
    </div>
  )
}
