/**
 * DiscoverPatientsModal Component
 *
 * Modal for discovering new patients from PracticeQ/IntakeQ.
 * Scans IntakeQ appointments and creates patient records for any
 * that don't exist in the database yet.
 */

'use client'

import { useState } from 'react'
import { X, Search, Loader2, CheckCircle, AlertCircle, Users } from 'lucide-react'

interface DiscoveryStats {
  intakeq_clients: number
  new_patients_created: number
  existing_patients: number
  patients_synced: number
  errors: Array<{ email: string; error: string }>
}

interface DiscoveryResult {
  success: boolean
  message?: string
  error?: string
  stats?: DiscoveryStats
  created_patients?: Array<{
    id: string
    name: string
    email: string
    syncResult?: {
      new: number
      updated: number
      errors: number
    }
  }>
}

interface DiscoverPatientsModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function DiscoverPatientsModal({
  isOpen,
  onClose,
  onSuccess
}: DiscoverPatientsModalProps) {
  const [isDiscovering, setIsDiscovering] = useState(false)
  const [result, setResult] = useState<DiscoveryResult | null>(null)

  const handleDiscover = async () => {
    setIsDiscovering(true)
    setResult(null)

    try {
      const response = await fetch('/api/admin/patients/discover-from-practiceq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          syncAppointments: true
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.details || data.error || 'Discovery failed')
      }

      setResult(data)

      // If we created new patients, notify parent to refresh
      if (data.stats?.new_patients_created > 0) {
        onSuccess()
      }
    } catch (error: any) {
      console.error('Discovery failed:', error)
      setResult({
        success: false,
        error: error.message
      })
    } finally {
      setIsDiscovering(false)
    }
  }

  const handleClose = () => {
    setResult(null)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={handleClose} />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-moonlit-brown/10 rounded-lg">
                <Search className="w-5 h-5 text-moonlit-brown" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Discover New Patients
                </h2>
                <p className="text-sm text-gray-500">
                  Import patients from PracticeQ/IntakeQ
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Initial state - show explanation */}
            {!isDiscovering && !result && (
              <div className="space-y-6">
                <p className="text-gray-700">
                  This will scan all patients in PracticeQ (IntakeQ) and import any that don't exist in your database yet.
                </p>
                <ul className="list-disc list-inside text-gray-700 space-y-2 bg-gray-50 rounded-lg p-4">
                  <li>Searches appointments from the last 90 days to 90 days in the future</li>
                  <li>Creates patient records for any new patients found</li>
                  <li>Automatically syncs their appointment history</li>
                  <li>Does not modify existing patient records</li>
                </ul>
              </div>
            )}

            {/* Loading state */}
            {isDiscovering && (
              <div className="text-center py-12">
                <Loader2 className="w-16 h-16 text-moonlit-brown animate-spin mx-auto mb-4" />
                <p className="text-gray-700 text-lg">Scanning PracticeQ for new patients...</p>
                <p className="text-gray-500 text-sm mt-2">This may take 30-60 seconds</p>
              </div>
            )}

            {/* Results */}
            {result && (
              <div className="space-y-6">
                {result.success ? (
                  <>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <p className="text-green-800 font-medium">Discovery Complete!</p>
                      </div>
                    </div>

                    {result.stats && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-50 rounded-lg p-4">
                          <p className="text-sm text-gray-600">PracticeQ Clients Found</p>
                          <p className="text-2xl font-bold text-moonlit-navy">{result.stats.intakeq_clients}</p>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-4">
                          <p className="text-sm text-gray-600">Already in Database</p>
                          <p className="text-2xl font-bold text-blue-700">{result.stats.existing_patients}</p>
                        </div>
                        <div className="bg-green-50 rounded-lg p-4">
                          <p className="text-sm text-gray-600">New Patients Created</p>
                          <p className="text-2xl font-bold text-green-700">{result.stats.new_patients_created}</p>
                        </div>
                        <div className="bg-purple-50 rounded-lg p-4">
                          <p className="text-sm text-gray-600">Appointments Synced</p>
                          <p className="text-2xl font-bold text-purple-700">{result.stats.patients_synced}</p>
                        </div>
                      </div>
                    )}

                    {/* New patients list */}
                    {result.created_patients && result.created_patients.length > 0 && (
                      <div>
                        <h3 className="font-medium text-moonlit-navy mb-2 flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          New Patients Added ({result.created_patients.length})
                        </h3>
                        <div className="bg-gray-50 rounded-lg p-4 max-h-60 overflow-y-auto">
                          <ul className="space-y-2">
                            {result.created_patients.map((patient, idx) => (
                              <li key={idx} className="text-sm flex items-center justify-between">
                                <div>
                                  <span className="font-medium">{patient.name}</span>
                                  <span className="text-gray-600 ml-2">({patient.email})</span>
                                </div>
                                {patient.syncResult && (
                                  <span className="text-gray-500 text-xs">
                                    {patient.syncResult.new} appt{patient.syncResult.new !== 1 ? 's' : ''}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}

                    {/* Errors */}
                    {result.stats?.errors && result.stats.errors.length > 0 && (
                      <div>
                        <h3 className="font-medium text-red-800 mb-2 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4" />
                          Errors ({result.stats.errors.length})
                        </h3>
                        <div className="bg-red-50 rounded-lg p-4 max-h-40 overflow-y-auto">
                          <ul className="space-y-2">
                            {result.stats.errors.map((err, idx) => (
                              <li key={idx} className="text-sm text-red-700">
                                <span className="font-medium">{err.email}</span>: {err.error}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                      <div>
                        <p className="text-red-800 font-medium">Discovery Failed</p>
                        <p className="text-red-700 text-sm mt-1">{result.error}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50 rounded-b-lg">
            {!isDiscovering && !result && (
              <>
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDiscover}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-moonlit-brown rounded-lg hover:bg-moonlit-brown/90 transition-colors"
                >
                  <Search className="w-4 h-4 mr-2" />
                  Start Discovery
                </button>
              </>
            )}
            {result && (
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-white bg-moonlit-brown rounded-lg hover:bg-moonlit-brown/90 transition-colors"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
