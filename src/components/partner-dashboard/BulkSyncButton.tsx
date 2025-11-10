'use client'

import { useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react'
import { partnerImpersonationManager } from '@/lib/partner-impersonation'

interface BulkSyncButtonProps {
  onSyncComplete?: () => void
}

interface BulkSyncResult {
  success: boolean
  organizationName: string
  patientsProcessed: number
  totalSummary: {
    new: number
    updated: number
    unchanged: number
    errors: number
  }
  patientResults: Array<{
    patientName: string
    status: 'success' | 'error'
    errorMessage?: string
  }>
}

export default function BulkSyncButton({ onSyncComplete }: BulkSyncButtonProps) {
  const [isSyncing, setIsSyncing] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [result, setResult] = useState<BulkSyncResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSync = async () => {
    setIsSyncing(true)
    setError(null)
    setResult(null)
    setShowModal(true)

    try {
      const supabase = createClientComponentClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        throw new Error('Not authenticated')
      }

      // Check for admin impersonation
      const impersonation = partnerImpersonationManager.getImpersonatedPartner()
      const url = impersonation
        ? `/api/partner-dashboard/patients/sync-all?partner_user_id=${impersonation.partner.id}`
        : '/api/partner-dashboard/patients/sync-all'

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to sync patients')
      }

      const syncResult: BulkSyncResult = await response.json()
      setResult(syncResult)

      if (onSyncComplete) {
        onSyncComplete()
      }
    } catch (err: any) {
      console.error('Bulk sync error:', err)
      setError(err.message || 'Failed to sync patients')
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <>
      {/* Bulk Sync Button */}
      <button
        onClick={handleSync}
        disabled={isSyncing}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm
          transition-all duration-200
          ${isSyncing
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md'
          }
        `}
        title="Refresh all patient appointments from PracticeQ"
      >
        <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
        {isSyncing ? 'Syncing All Patients...' : 'Refresh All Appointments'}
      </button>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 font-['Newsreader']">
                {isSyncing ? 'Syncing Appointments...' : result ? 'Sync Complete' : 'Sync Failed'}
              </h2>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {isSyncing && (
                <div className="flex flex-col items-center justify-center py-12">
                  <RefreshCw className="w-16 h-16 text-blue-600 animate-spin mb-4" />
                  <p className="text-lg text-gray-700 mb-2">Fetching latest appointments from PracticeQ...</p>
                  <p className="text-sm text-gray-500">This may take 30-60 seconds</p>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-lg font-semibold text-red-900 mb-2">Sync Failed</p>
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              {result && (
                <div className="space-y-6">
                  {/* Success Summary */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-lg font-semibold text-green-900 mb-2">
                          Successfully Synced {result.patientsProcessed} Patients
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                          <div>
                            <p className="text-sm text-gray-600">New</p>
                            <p className="text-2xl font-bold text-green-700">{result.totalSummary.new}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Updated</p>
                            <p className="text-2xl font-bold text-blue-700">{result.totalSummary.updated}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Unchanged</p>
                            <p className="text-2xl font-bold text-gray-600">{result.totalSummary.unchanged}</p>
                          </div>
                          {result.totalSummary.errors > 0 && (
                            <div>
                              <p className="text-sm text-gray-600">Errors</p>
                              <p className="text-2xl font-bold text-red-700">{result.totalSummary.errors}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Patient Results (show only if there were errors) */}
                  {result.patientResults.some(p => p.status === 'error') && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <h3 className="font-semibold text-yellow-900 mb-3">
                        ⚠️ Some Patients Failed to Sync
                      </h3>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {result.patientResults
                          .filter(p => p.status === 'error')
                          .map((patient, idx) => (
                            <div key={idx} className="text-sm text-yellow-800">
                              <span className="font-medium">{patient.patientName}:</span>{' '}
                              <span>{patient.errorMessage}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* What This Means */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="font-semibold text-blue-900 mb-2">✨ What Just Happened</h3>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>✅ All patient appointment data is now up-to-date</li>
                      <li>✅ You're seeing the latest from PracticeQ</li>
                      <li>✅ Next appointment times, providers, and statuses are current</li>
                      {result.totalSummary.new > 0 && (
                        <li className="font-medium">🆕 {result.totalSummary.new} new appointment(s) discovered</li>
                      )}
                      {result.totalSummary.updated > 0 && (
                        <li className="font-medium">📝 {result.totalSummary.updated} appointment(s) updated with changes</li>
                      )}
                    </ul>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              {!isSyncing && (
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
