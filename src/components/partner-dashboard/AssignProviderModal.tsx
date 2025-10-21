/**
 * Assign Provider Modal Component
 * Allows admins to assign or change a patient's primary provider
 */

'use client'

import { useState, useEffect } from 'react'
import { X, UserCheck, AlertCircle } from 'lucide-react'

interface Provider {
  id: string
  first_name: string
  last_name: string
  title?: string
  is_active: boolean
}

interface Patient {
  id: string
  first_name: string
  last_name: string
  primary_provider?: {
    id: string
    first_name: string
    last_name: string
  }
}

interface AssignProviderModalProps {
  patient: Patient
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function AssignProviderModal({
  patient,
  isOpen,
  onClose,
  onSuccess
}: AssignProviderModalProps) {
  const [providers, setProviders] = useState<Provider[]>([])
  const [selectedProviderId, setSelectedProviderId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      fetchProviders()
    }
  }, [isOpen])

  const fetchProviders = async () => {
    try {
      // Fetch all providers directly from the database (not filtered by bookability)
      // For admin assignment, we want to see ALL providers
      const response = await fetch('/api/partner-dashboard/providers')
      const data = await response.json()

      if (data.success) {
        setProviders(data.data)
      } else {
        setError('Failed to load providers')
      }
    } catch (err) {
      console.error('Error fetching providers:', err)
      setError('Failed to load providers')
    }
  }

  const handleAssign = async () => {
    if (!selectedProviderId) {
      setError('Please select a provider')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/partner-dashboard/patients/${patient.id}/assign-provider`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider_id: selectedProviderId
        })
      })

      const data = await response.json()

      if (data.success) {
        onSuccess()
        onClose()
        setSelectedProviderId('')
      } else {
        setError(data.error || 'Failed to assign provider')
      }
    } catch (err: any) {
      console.error('Error assigning provider:', err)
      setError('Failed to assign provider')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const currentProvider = patient.primary_provider
    ? `Dr. ${patient.primary_provider.first_name} ${patient.primary_provider.last_name}`
    : 'Not assigned'

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
                Assign Primary Provider
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

          {/* Current Provider */}
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 mb-1">Current primary provider</p>
            <p className="text-sm font-medium text-gray-900">{currentProvider}</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Provider Select */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Assign to provider
            </label>
            <select
              value={selectedProviderId}
              onChange={(e) => setSelectedProviderId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            >
              <option value="">Select a provider...</option>
              {providers.map((provider) => (
                <option
                  key={provider.id}
                  value={provider.id}
                  disabled={provider.id === patient.primary_provider?.id}
                >
                  Dr. {provider.first_name} {provider.last_name}
                  {provider.title ? ` (${provider.title})` : ''}
                  {provider.id === patient.primary_provider?.id ? ' (Current)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Info Note */}
          <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-800">
              <span className="font-medium">Note:</span> The primary provider is the main clinician responsible for this patient's care.
            </p>
          </div>

          {/* Actions */}
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleAssign}
              disabled={loading || !selectedProviderId}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {loading ? (
                <span>Assigning...</span>
              ) : (
                <>
                  <UserCheck className="w-4 h-4" />
                  <span>Assign Provider</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
