/**
 * Generate Medication Report Modal
 * Allows partner users to generate and email medication reports
 */

'use client'

import { useState, useEffect } from 'react'
import { FileText, Download, Mail, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

interface Patient {
  id: string
  first_name: string
  last_name: string
}

interface CompletedAppointment {
  id: string
  start_time: string
  status: string
  providers?: {
    first_name: string
    last_name: string
  }
}

interface GenerateMedicationReportModalProps {
  patient: Patient
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  partnerUserId?: string // For admin impersonation
}

export function GenerateMedicationReportModal({
  patient,
  isOpen,
  onClose,
  onSuccess,
  partnerUserId
}: GenerateMedicationReportModalProps) {
  const [completedAppointments, setCompletedAppointments] = useState<CompletedAppointment[]>([])
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string>('')
  const [sendEmail, setSendEmail] = useState(false)
  const [customEmail, setCustomEmail] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [loadingAppointments, setLoadingAppointments] = useState(true)

  // Fetch completed appointments when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchCompletedAppointments()
    } else {
      // Reset state when modal closes
      setSelectedAppointmentId('')
      setSendEmail(false)
      setCustomEmail('')
      setError(null)
      setSuccess(null)
      setPdfUrl(null)
    }
  }, [isOpen, patient.id])

  const fetchCompletedAppointments = async () => {
    setLoadingAppointments(true)
    setError(null)

    try {
      // Build URL with optional partner_user_id for impersonation
      const params = new URLSearchParams({
        status: 'completed',
        limit: '10'
      })
      if (partnerUserId) {
        params.append('partner_user_id', partnerUserId)
      }

      const response = await fetch(
        `/api/partner-dashboard/patients/${patient.id}/appointments?${params.toString()}`
      )

      if (!response.ok) {
        throw new Error('Failed to fetch appointments')
      }

      const data = await response.json()

      if (data.success) {
        setCompletedAppointments(data.data || [])
        // Auto-select most recent appointment
        if (data.data && data.data.length > 0) {
          setSelectedAppointmentId(data.data[0].id)
        }
      } else {
        throw new Error(data.error || 'Failed to load appointments')
      }
    } catch (err: any) {
      console.error('Error fetching appointments:', err)
      setError(err.message || 'Failed to load completed appointments')
    } finally {
      setLoadingAppointments(false)
    }
  }

  const handleGenerateReport = async () => {
    if (!selectedAppointmentId) {
      setError('Please select an appointment')
      return
    }

    // Validate email if sending
    if (sendEmail && !customEmail) {
      setError('Please enter an email address')
      return
    }

    if (sendEmail && customEmail && !customEmail.includes('@')) {
      setError('Please enter a valid email address')
      return
    }

    setIsGenerating(true)
    setError(null)
    setSuccess(null)
    setPdfUrl(null)

    try {
      const response = await fetch(
        `/api/partner-dashboard/patients/${patient.id}/medication-report`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            appointment_id: selectedAppointmentId,
            send_email: sendEmail,
            custom_email: sendEmail ? customEmail : undefined
          })
        }
      )

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate report')
      }

      setSuccess(
        sendEmail
          ? 'Medication report generated and emailed successfully!'
          : 'Medication report generated successfully!'
      )
      setPdfUrl(data.data?.pdfUrl || null)

      if (onSuccess) {
        onSuccess()
      }

      // Auto-close after 3 seconds if email was sent
      if (sendEmail) {
        setTimeout(() => {
          onClose()
        }, 3000)
      }
    } catch (err: any) {
      console.error('Error generating report:', err)
      setError(err.message || 'Failed to generate medication report')
    } finally {
      setIsGenerating(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-moonlit-brown/10 rounded-lg">
                <FileText className="w-6 h-6 text-moonlit-brown" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-moonlit-navy font-['Newsreader']">
                  Generate Medication Report
                </h2>
                <p className="text-sm text-gray-600 font-['Newsreader'] font-light">
                  {patient.first_name} {patient.last_name}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              disabled={isGenerating}
            >
              <span className="text-2xl">&times;</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {loadingAppointments ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-moonlit-brown animate-spin" />
            </div>
          ) : completedAppointments.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 font-['Newsreader']">
                No completed appointments found for this patient.
              </p>
            </div>
          ) : (
            <>
              {/* Select Appointment */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Completed Appointment
                </label>
                <select
                  value={selectedAppointmentId}
                  onChange={(e) => setSelectedAppointmentId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-moonlit-brown focus:border-transparent"
                  disabled={isGenerating}
                >
                  <option value="">Select an appointment...</option>
                  {completedAppointments.map((appt) => (
                    <option key={appt.id} value={appt.id}>
                      {new Date(appt.start_time).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                      {appt.providers && ` - Dr. ${appt.providers.last_name}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Email Options */}
              <div className="mb-6">
                <label className="flex items-center space-x-3 mb-3">
                  <input
                    type="checkbox"
                    checked={sendEmail}
                    onChange={(e) => setSendEmail(e.target.checked)}
                    className="w-4 h-4 text-moonlit-brown border-gray-300 rounded focus:ring-moonlit-brown"
                    disabled={isGenerating}
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Email report
                  </span>
                </label>

                {sendEmail && (
                  <div className="ml-7">
                    <input
                      type="email"
                      value={customEmail}
                      onChange={(e) => setCustomEmail(e.target.value)}
                      placeholder="recipient@example.com"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-moonlit-brown focus:border-transparent"
                      disabled={isGenerating}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Enter the email address where you want to send the report
                    </p>
                  </div>
                )}
              </div>

              {/* Success Message */}
              {success && (
                <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-800">{success}</p>
                    {pdfUrl && (
                      <a
                        href={pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center mt-2 text-sm text-green-700 hover:text-green-900 underline"
                      >
                        <Download className="w-4 h-4 mr-1" />
                        Download PDF
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> This report will include medication changes detected from
                  the selected appointment. The report is generated from clinical notes and
                  formatted on moonlit letterhead.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!loadingAppointments && completedAppointments.length > 0 && (
          <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
            <button
              onClick={onClose}
              disabled={isGenerating}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleGenerateReport}
              disabled={isGenerating || !selectedAppointmentId || !!success}
              className="px-4 py-2 bg-moonlit-brown text-white rounded-lg hover:bg-moonlit-brown/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : sendEmail ? (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Generate & Email Report
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  Generate Report
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
