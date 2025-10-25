/**
 * Appointment Status Indicator Component
 *
 * Shows whether a patient has a future appointment scheduled.
 * Factual display only - no prescriptive messaging about when they "should" be seen.
 */

'use client'

import { Calendar, CheckCircle2, XCircle } from 'lucide-react'

interface AppointmentStatusIndicatorProps {
  hasFutureAppointment: boolean
  nextAppointmentDate?: string | null
  lastSeenDate?: string | null
  className?: string
}

export function AppointmentStatusIndicator({
  hasFutureAppointment,
  nextAppointmentDate,
  lastSeenDate,
  className = ''
}: AppointmentStatusIndicatorProps) {

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = date.getTime() - now.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays < 0) {
      const absDays = Math.abs(diffDays)
      return `${absDays} ${absDays === 1 ? 'day' : 'days'} ago`
    } else if (diffDays === 0) {
      return 'Today'
    } else if (diffDays === 1) {
      return 'Tomorrow'
    } else {
      return `in ${diffDays} days`
    }
  }

  return (
    <div className={`flex flex-col space-y-1 ${className}`}>
      {/* Next Appointment */}
      {hasFutureAppointment && nextAppointmentDate ? (
        <div className="flex items-center space-x-2 text-sm">
          <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
          <div className="flex flex-col">
            <span className="text-gray-900 font-medium">
              {formatDate(nextAppointmentDate)}
            </span>
            <span className="text-gray-500 text-xs">
              {formatRelativeTime(nextAppointmentDate)}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex items-center space-x-2 text-sm">
          <XCircle className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <span className="text-gray-500">No future appointment</span>
        </div>
      )}

      {/* Last Seen */}
      {lastSeenDate && (
        <div className="flex items-center space-x-2 text-xs text-gray-500">
          <Calendar className="w-3 h-3 flex-shrink-0" />
          <span>Last seen: {formatDate(lastSeenDate)}</span>
        </div>
      )}
    </div>
  )
}
