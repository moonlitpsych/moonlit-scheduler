'use client'

import { useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

interface SyncAppointmentsButtonProps {
  patientId: string
  patientName: string
  lastSyncAt?: string | null
  onSyncComplete?: () => void
}

interface SyncResult {
  success: boolean
  patientName: string
  syncedAt: string
  summary: {
    new: number
    updated: number
    unchanged: number
    errors: number
  }
  warnings: string[]
}

export default function SyncAppointmentsButton({
  patientId,
  patientName,
  lastSyncAt,
  onSyncComplete
}: SyncAppointmentsButtonProps) {
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const formatLastSync = (timestamp: string | null | undefined) => {
    if (!timestamp) return 'Never'

    const syncDate = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - syncDate.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'Just now'
    if (diffMins === 1) return '1 minute ago'
    if (diffMins < 60) return `${diffMins} minutes ago`

    const diffHours = Math.floor(diffMins / 60)
    if (diffHours === 1) return '1 hour ago'
    if (diffHours < 24) return `${diffHours} hours ago`

    const diffDays = Math.floor(diffHours / 24)
    if (diffDays === 1) return '1 day ago'
    return `${diffDays} days ago`
  }

  const handleSync = async () => {
    setIsSyncing(true)
    setError(null)
    setSyncResult(null)

    try {
      // Get Supabase client with auth (using auth-helpers for browser cookie access)
      const supabase = createClientComponentClient()

      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        throw new Error('Not authenticated')
      }

      // Call sync API
      const response = await fetch(`/api/partner-dashboard/patients/${patientId}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to sync appointments')
      }

      const result: SyncResult = await response.json()
      setSyncResult(result)

      // Show warnings if any
      if (result.warnings.length > 0) {
        console.warn('⚠️ Sync warnings:', result.warnings)
      }

      // Notify parent component
      if (onSyncComplete) {
        onSyncComplete()
      }
    } catch (err: any) {
      console.error('Sync error:', err)
      setError(err.message || 'Failed to sync appointments')
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div className="space-y-2">
      {/* Sync Button */}
      <button
        onClick={handleSync}
        disabled={isSyncing}
        className={`
          flex items-center gap-2 px-3 py-1.5 text-sm rounded-md
          transition-colors
          ${isSyncing
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
          }
        `}
      >
        {isSyncing ? (
          <>
            <svg
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Syncing...
          </>
        ) : (
          <>
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Sync from PracticeQ
          </>
        )}
      </button>

      {/* Last Sync Time */}
      {lastSyncAt && !syncResult && !error && (
        <p className="text-xs text-gray-500">
          Last synced: {formatLastSync(lastSyncAt)}
        </p>
      )}

      {/* Success Result */}
      {syncResult && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-md">
          <div className="flex items-start gap-2">
            <svg
              className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-green-900">
                Synced successfully
              </p>
              <p className="text-xs text-green-700 mt-1">
                {syncResult.summary.new > 0 && `${syncResult.summary.new} new • `}
                {syncResult.summary.updated > 0 && `${syncResult.summary.updated} updated • `}
                {syncResult.summary.unchanged} unchanged
                {syncResult.summary.errors > 0 && ` • ${syncResult.summary.errors} errors`}
              </p>
              {syncResult.warnings.length > 0 && (
                <p className="text-xs text-yellow-700 mt-1">
                  ⚠️ {syncResult.warnings.length} warning(s) - check console
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-start gap-2">
            <svg
              className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-red-900">
                Sync failed
              </p>
              <p className="text-xs text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
