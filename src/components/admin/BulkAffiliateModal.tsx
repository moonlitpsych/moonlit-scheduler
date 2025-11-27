/**
 * BulkAffiliateModal Component
 *
 * Modal for associating multiple patients with an organization.
 * Admin-only feature for bulk patient-organization affiliations.
 */

'use client'

import { useState, useEffect } from 'react'
import { X, Building2, Users, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import OrganizationSelector from './OrganizationSelector'
import { PatientRosterItem } from '@/types/patient-roster'

interface Organization {
  id: string
  name: string
  slug: string
  type: string
  status: string
  default_case_manager_id?: string | null
  stats?: {
    partners_count: number
    active_users_count: number
    active_patients_count: number
  }
}

interface CaseManager {
  id: string
  first_name: string
  last_name: string
  email: string
}

interface BulkAffiliateModalProps {
  selectedPatientIds: string[]
  patients: PatientRosterItem[]
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

interface AffiliationResult {
  patient_id: string
  status: 'created' | 'skipped' | 'error'
  reason?: string
}

export function BulkAffiliateModal({
  selectedPatientIds,
  patients,
  isOpen,
  onClose,
  onSuccess
}: BulkAffiliateModalProps) {
  // Form state
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null)
  const [caseManagers, setCaseManagers] = useState<CaseManager[]>([])
  const [selectedCaseManagerId, setSelectedCaseManagerId] = useState<string | null>(null)
  const [loadingCaseManagers, setLoadingCaseManagers] = useState(false)

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    created: number
    skipped: number
    errors: number
    results: AffiliationResult[]
  } | null>(null)

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedOrg(null)
      setSelectedCaseManagerId(null)
      setCaseManagers([])
      setError(null)
      setResult(null)
    }
  }, [isOpen])

  // Load case managers when organization changes
  useEffect(() => {
    if (selectedOrg) {
      loadCaseManagers(selectedOrg.id)
      // Pre-select the org's default case manager
      setSelectedCaseManagerId(selectedOrg.default_case_manager_id || null)
    } else {
      setCaseManagers([])
      setSelectedCaseManagerId(null)
    }
  }, [selectedOrg])

  const loadCaseManagers = async (orgId: string) => {
    setLoadingCaseManagers(true)
    try {
      const response = await fetch(`/api/organizations/${orgId}/users?role=case_manager&status=active`)
      const data = await response.json()
      if (data.success && data.data) {
        setCaseManagers(data.data)
      }
    } catch (err) {
      console.error('Failed to load case managers:', err)
    } finally {
      setLoadingCaseManagers(false)
    }
  }

  const handleOrganizationChange = (orgId: string | null, org: Organization | null) => {
    setSelectedOrg(org)
    setError(null)
    setResult(null)
  }

  const handleSubmit = async () => {
    if (!selectedOrg) {
      setError('Please select an organization')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/patients/bulk-affiliate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_ids: selectedPatientIds,
          organization_id: selectedOrg.id,
          primary_contact_user_id: selectedCaseManagerId
        })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create affiliations')
      }

      setResult({
        created: data.created,
        skipped: data.skipped,
        errors: data.errors,
        results: data.results
      })

      // If all successful, close after a delay
      if (data.errors === 0) {
        setTimeout(() => {
          onSuccess()
          onClose()
        }, 2000)
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  // Find the selected case manager details
  const selectedCaseManager = caseManagers.find(cm => cm.id === selectedCaseManagerId)

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose} />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-moonlit-brown/10 rounded-lg">
                <Building2 className="w-5 h-5 text-moonlit-brown" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Associate with Organization
                </h2>
                <p className="text-sm text-gray-500">
                  Create affiliations for {selectedPatientIds.length} patient{selectedPatientIds.length === 1 ? '' : 's'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Success/Error Result */}
            {result && (
              <div className={`p-4 rounded-lg ${
                result.errors > 0 ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'
              }`}>
                <div className="flex items-start gap-3">
                  <CheckCircle className={`w-5 h-5 mt-0.5 ${
                    result.errors > 0 ? 'text-yellow-600' : 'text-green-600'
                  }`} />
                  <div>
                    <h4 className={`font-medium ${
                      result.errors > 0 ? 'text-yellow-800' : 'text-green-800'
                    }`}>
                      Affiliation Complete
                    </h4>
                    <div className="mt-1 text-sm text-gray-600 space-y-1">
                      <p>✅ Created: {result.created} new affiliation{result.created === 1 ? '' : 's'}</p>
                      {result.skipped > 0 && (
                        <p>⏭️ Skipped: {result.skipped} (already affiliated)</p>
                      )}
                      {result.errors > 0 && (
                        <p>❌ Errors: {result.errors}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-red-800">Error</h4>
                    <p className="mt-1 text-sm text-red-600">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Selected Patients Preview */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Selected Patients ({selectedPatientIds.length})
              </label>
              <div className="bg-gray-50 rounded-lg p-3 max-h-32 overflow-y-auto">
                <div className="flex flex-wrap gap-2">
                  {patients.slice(0, 10).map(patient => (
                    <span
                      key={patient.id}
                      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-700"
                    >
                      {patient.first_name} {patient.last_name}
                    </span>
                  ))}
                  {patients.length > 10 && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-300 text-gray-600">
                      +{patients.length - 10} more
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Organization Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Organization <span className="text-red-500">*</span>
              </label>
              <OrganizationSelector
                value={selectedOrg?.id}
                onChange={handleOrganizationChange}
                placeholder="Select an organization..."
                disabled={isSubmitting || !!result}
              />
            </div>

            {/* Case Manager Selector */}
            {selectedOrg && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Case Manager
                  {selectedOrg.default_case_manager_id && (
                    <span className="text-gray-500 font-normal ml-1">(pre-filled from org default)</span>
                  )}
                </label>
                {loadingCaseManagers ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500 py-3">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading case managers...
                  </div>
                ) : caseManagers.length === 0 ? (
                  <p className="text-sm text-gray-500 py-3">
                    No case managers found for this organization
                  </p>
                ) : (
                  <select
                    value={selectedCaseManagerId || ''}
                    onChange={(e) => setSelectedCaseManagerId(e.target.value || null)}
                    disabled={isSubmitting || !!result}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-moonlit-brown focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed"
                  >
                    <option value="">No case manager assigned</option>
                    {caseManagers.map(cm => (
                      <option key={cm.id} value={cm.id}>
                        {cm.first_name} {cm.last_name} ({cm.email})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Summary */}
            {selectedOrg && !result && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-800 mb-2">Summary of Changes</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>
                    • {selectedPatientIds.length} patient{selectedPatientIds.length === 1 ? ' will' : 's will'} be affiliated with <strong>{selectedOrg.name}</strong>
                  </li>
                  <li>
                    • Affiliation type: <strong>Case Management</strong>
                  </li>
                  {selectedCaseManager ? (
                    <li>
                      • Assigned case manager: <strong>{selectedCaseManager.first_name} {selectedCaseManager.last_name}</strong>
                    </li>
                  ) : selectedOrg.default_case_manager_id ? (
                    <li>
                      • Assigned case manager: <strong>Organization default</strong>
                    </li>
                  ) : (
                    <li>
                      • No case manager will be assigned
                    </li>
                  )}
                  <li className="text-blue-600">
                    • Patients already affiliated with this organization will be skipped
                  </li>
                </ul>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50 rounded-b-lg">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {result ? 'Close' : 'Cancel'}
            </button>
            {!result && (
              <button
                onClick={handleSubmit}
                disabled={!selectedOrg || isSubmitting}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-moonlit-brown rounded-lg hover:bg-moonlit-brown/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating Affiliations...
                  </>
                ) : (
                  <>
                    <Users className="w-4 h-4 mr-2" />
                    Create Affiliations
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
