/**
 * Send Notification Modal Component
 * Allows case managers to send reminders and forms to patients
 */

'use client'

import { useState, useEffect } from 'react'
import { X, Send, AlertCircle, CheckCircle } from 'lucide-react'

interface Patient {
  id: string
  first_name: string
  last_name: string
  email?: string
}

interface Appointment {
  id: string
  start_time: string
  status: string
  providers?: {
    first_name: string
    last_name: string
  }
}

interface SendNotificationModalProps {
  patient: Patient
  appointments?: Appointment[]
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function SendNotificationModal({
  patient,
  appointments = [],
  isOpen,
  onClose,
  onSuccess
}: SendNotificationModalProps) {
  const [notificationType, setNotificationType] = useState<'appointment_reminder' | 'intake_form' | 'general_message'>('appointment_reminder')
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string>('')
  const [message, setMessage] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (isOpen && appointments.length > 0) {
      // Auto-select first upcoming appointment
      setSelectedAppointmentId(appointments[0].id)
    }
  }, [isOpen, appointments])

  useEffect(() => {
    if (!isOpen) {
      // Reset form when modal closes
      setNotificationType('appointment_reminder')
      setSelectedAppointmentId('')
      setMessage('')
      setError(null)
      setSuccess(false)
    }
  }, [isOpen])

  const handleSend = async () => {
    setLoading(true)
    setError(null)
    setSuccess(false)

    // Validate
    if ((notificationType === 'appointment_reminder' || notificationType === 'intake_form') && !selectedAppointmentId) {
      setError('Please select an appointment')
      setLoading(false)
      return
    }

    if (notificationType === 'general_message' && !message.trim()) {
      setError('Please enter a message')
      setLoading(false)
      return
    }

    try {
      const response = await fetch(`/api/partner-dashboard/patients/${patient.id}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notification_type: notificationType,
          appointment_id: selectedAppointmentId || null,
          message: message.trim() || null
        })
      })

      const data = await response.json()

      if (data.success) {
        setSuccess(true)
        setTimeout(() => {
          onSuccess()
          onClose()
        }, 1500)
      } else {
        setError(data.error || 'Failed to send notification')
      }
    } catch (err: any) {
      console.error('Error sending notification:', err)
      setError('Failed to send notification')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const formatAppointmentDisplay = (appt: Appointment) => {
    const date = new Date(appt.start_time)
    const dateStr = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
    const timeStr = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
    const providerName = appt.providers ? `Dr. ${appt.providers.last_name}` : 'Provider'
    return `${dateStr} at ${timeStr} - ${providerName}`
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 font-['Newsreader']">
                Send Notification
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {patient.first_name} {patient.last_name}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Success Message */}
          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <p className="text-sm text-green-800">Notification sent successfully!</p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Patient email warning */}
          {!patient.email && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-yellow-800">
                No email address on file for this patient
              </p>
            </div>
          )}

          {/* Notification Type */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notification Type
            </label>
            <select
              value={notificationType}
              onChange={(e) => setNotificationType(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading || success}
            >
              <option value="appointment_reminder">Appointment Reminder</option>
              <option value="intake_form">Intake Form Reminder</option>
              <option value="general_message">General Message</option>
            </select>
          </div>

          {/* Appointment Select (for reminders and forms) */}
          {(notificationType === 'appointment_reminder' || notificationType === 'intake_form') && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Appointment
              </label>
              {appointments.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No upcoming appointments</p>
              ) : (
                <select
                  value={selectedAppointmentId}
                  onChange={(e) => setSelectedAppointmentId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading || success}
                >
                  <option value="">Select an appointment...</option>
                  {appointments.map((appt) => (
                    <option key={appt.id} value={appt.id}>
                      {formatAppointmentDisplay(appt)}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Message */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {notificationType === 'general_message' ? 'Message' : 'Additional Message (optional)'}
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                notificationType === 'general_message'
                  ? 'Enter your message...'
                  : 'Add any additional information...'
              }
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              disabled={loading || success}
            />
          </div>

          {/* Actions */}
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              disabled={loading || success}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={loading || success || !patient.email}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {loading ? (
                <span>Sending...</span>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Send Notification</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
