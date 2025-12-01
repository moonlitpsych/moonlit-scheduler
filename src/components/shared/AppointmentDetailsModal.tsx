'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { GoogleMeetLinkEditor } from './GoogleMeetLinkEditor'

interface Provider {
  id: string
  first_name: string
  last_name: string
}

interface Appointment {
  id: string
  start_time: string
  status: string
  meeting_url?: string | null
  location_info?: string | null
  practiceq_generated_google_meet?: string | null
  providers?: Provider
}

interface AppointmentDetailsModalProps {
  appointment: Appointment
  patientName: string
  isOpen: boolean
  onClose: () => void
  onUpdate?: (appointmentId: string, newLink: string | null) => void
}

export function AppointmentDetailsModal({
  appointment,
  patientName,
  isOpen,
  onClose,
  onUpdate
}: AppointmentDetailsModalProps) {
  // Track the Google Meet link locally so it updates immediately after save
  const [localGoogleMeetLink, setLocalGoogleMeetLink] = useState<string | null>(
    appointment.practiceq_generated_google_meet || null
  )

  // Sync local state when appointment prop changes (e.g., modal reopened with different appointment)
  useEffect(() => {
    setLocalGoogleMeetLink(appointment.practiceq_generated_google_meet || null)
  }, [appointment.id, appointment.practiceq_generated_google_meet])

  if (!isOpen) return null

  const appointmentDate = new Date(appointment.start_time)
  const formattedDate = appointmentDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
  const formattedTime = appointmentDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            Appointment Details
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Patient Info */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Patient</h3>
            <p className="text-base text-gray-900">{patientName}</p>
          </div>

          {/* Provider Info */}
          {appointment.providers && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Provider</h3>
              <p className="text-base text-gray-900">
                Dr. {appointment.providers.first_name} {appointment.providers.last_name}
              </p>
            </div>
          )}

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Date</h3>
              <p className="text-base text-gray-900">{formattedDate}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Time</h3>
              <p className="text-base text-gray-900">{formattedTime}</p>
            </div>
          </div>

          {/* Status */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Status</h3>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              appointment.status === 'confirmed' || appointment.status === 'scheduled'
                ? 'bg-green-100 text-green-800'
                : appointment.status === 'completed'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-gray-100 text-gray-800'
            }`}>
              {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
            </span>
          </div>

          {/* Location Info */}
          {appointment.location_info && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Location</h3>
              <p className="text-base text-gray-900">
                {typeof appointment.location_info === 'string'
                  ? appointment.location_info
                  : appointment.location_info.locationName || 'Telehealth'}
              </p>
            </div>
          )}

          {/* Google Meet Link Editor */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">PracticeQ Google Meet Link</h3>
            <GoogleMeetLinkEditor
              appointmentId={appointment.id}
              currentLink={localGoogleMeetLink}
              onUpdate={(newLink) => {
                // Update local state immediately for instant feedback
                setLocalGoogleMeetLink(newLink)
                // Also notify parent for data refresh
                if (onUpdate) {
                  onUpdate(appointment.id, newLink)
                }
              }}
            />
          </div>

          {/* Legacy Meeting URL (if exists) */}
          {appointment.meeting_url && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Legacy Meeting URL</h3>
              <a
                href={appointment.meeting_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-800 hover:underline break-all"
              >
                {appointment.meeting_url}
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
