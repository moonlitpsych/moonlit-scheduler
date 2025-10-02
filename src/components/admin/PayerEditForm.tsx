'use client'

import { useState } from 'react'
import { Edit, Eye, X, Save } from 'lucide-react'
import ConfirmationModal from './ConfirmationModal'

interface PayerData {
  id: string
  name: string
  status_code: string | null
  effective_date: string | null
  requires_attending: boolean
  allows_supervised: boolean
  supervision_level: string | null
}

interface PayerEditFormProps {
  payer: PayerData
  isOpen: boolean
  onClose: () => void
  onUpdate: (updatedPayer: PayerData) => void
  onError: (error: string) => void
}

const SUPERVISION_LEVELS = [
  { value: 'none', label: 'None' },
  { value: 'sign_off_only', label: 'Sign-off Only' },
  { value: 'first_visit_in_person', label: 'First Visit In-Person' },
  { value: 'co_visit_required', label: 'Co-visit Required' }
]

export default function PayerEditForm({
  payer,
  isOpen,
  onClose,
  onUpdate,
  onError
}: PayerEditFormProps) {
  const [formData, setFormData] = useState({
    status_code: payer.status_code || '',
    effective_date: payer.effective_date || '',
    requires_attending: payer.requires_attending,
    allows_supervised: payer.allows_supervised,
    supervision_level: payer.supervision_level || 'none'
  })

  const [previewData, setPreviewData] = useState<any>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)

  const handleFieldChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setPreviewData(null) // Clear preview when form changes
  }

  const handlePreview = async () => {
    setPreviewLoading(true)
    try {
      const params = new URLSearchParams()
      Object.entries(formData).forEach(([key, value]) => {
        // Always send the value, even if empty (to allow clearing fields)
        if (value !== null && value !== undefined) {
          params.append(key, String(value))
        }
      })

      const response = await fetch(`/api/admin/payers/${payer.id}/preview?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'omit' // Don't send cookies/auth automatically
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Preview failed')
      }

      setPreviewData(result)
    } catch (error) {
      console.error('Preview error:', error)
      onError('Failed to generate preview')
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleSave = () => {
    if (!previewData) {
      onError('Please preview changes first')
      return
    }
    setShowConfirmation(true)
  }

  const handleConfirmUpdate = async (note: string) => {
    try {
      const response = await fetch(`/api/admin/payers/${payer.id}/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'omit', // Don't send cookies/auth automatically
        body: JSON.stringify({
          ...formData,
          note
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Update failed')
      }

      onUpdate(result.updated)
      onClose()
    } catch (error) {
      console.error('Update error:', error)
      onError(error instanceof Error ? error.message : 'Update failed')
      throw error // Re-throw to keep modal open
    }
  }

  const getChanges = () => {
    if (!previewData) return []

    const changes = []
    const { current, proposed } = previewData

    Object.keys(formData).forEach(key => {
      if (current[key] !== proposed[key]) {
        changes.push({
          field: key,
          oldValue: current[key],
          newValue: proposed[key]
        })
      }
    })

    return changes
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-[#091747] font-['Newsreader']">
              Edit Payer: {payer.name}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-2"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto max-h-[60vh]">
            {/* Form Fields */}
            <div className="space-y-6">
              {/* Status Code */}
              <div>
                <label htmlFor="status_code" className="block text-sm font-medium text-[#091747] mb-2">
                  Status Code
                </label>
                <input
                  id="status_code"
                  type="text"
                  value={formData.status_code}
                  onChange={(e) => handleFieldChange('status_code', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20 focus:border-[#BF9C73]"
                  placeholder="e.g., approved, pending"
                />
              </div>

              {/* Effective Date */}
              <div>
                <label htmlFor="effective_date" className="block text-sm font-medium text-[#091747] mb-2">
                  Effective Date
                </label>
                <input
                  id="effective_date"
                  type="date"
                  value={formData.effective_date}
                  onChange={(e) => handleFieldChange('effective_date', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20 focus:border-[#BF9C73]"
                />
              </div>

              {/* Requires Attending */}
              <div className="flex items-center space-x-3">
                <input
                  id="requires_attending"
                  type="checkbox"
                  checked={formData.requires_attending}
                  onChange={(e) => handleFieldChange('requires_attending', e.target.checked)}
                  className="w-4 h-4 text-[#BF9C73] border-gray-300 rounded focus:ring-[#BF9C73]/20"
                />
                <label htmlFor="requires_attending" className="text-sm font-medium text-[#091747]">
                  Requires Attending
                </label>
              </div>

              {/* Allows Supervised */}
              <div className="flex items-center space-x-3">
                <input
                  id="allows_supervised"
                  type="checkbox"
                  checked={formData.allows_supervised}
                  onChange={(e) => handleFieldChange('allows_supervised', e.target.checked)}
                  className="w-4 h-4 text-[#BF9C73] border-gray-300 rounded focus:ring-[#BF9C73]/20"
                />
                <label htmlFor="allows_supervised" className="text-sm font-medium text-[#091747]">
                  Allows Supervised
                </label>
              </div>

              {/* Supervision Level */}
              <div>
                <label htmlFor="supervision_level" className="block text-sm font-medium text-[#091747] mb-2">
                  Supervision Level
                </label>
                <select
                  id="supervision_level"
                  value={formData.supervision_level}
                  onChange={(e) => handleFieldChange('supervision_level', e.target.value)}
                  disabled={!formData.allows_supervised}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20 focus:border-[#BF9C73] disabled:bg-gray-100 disabled:text-gray-500"
                >
                  {SUPERVISION_LEVELS.map(level => (
                    <option key={level.value} value={level.value}>
                      {level.label}
                    </option>
                  ))}
                </select>
                {!formData.allows_supervised && (
                  <p className="text-xs text-gray-500 mt-1">
                    Enable "Allows Supervised" to set supervision level
                  </p>
                )}
              </div>
            </div>

            {/* Preview Section */}
            {previewData && (
              <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="text-blue-800 font-medium mb-3">Preview Changes</h4>

                {previewData.warnings && previewData.warnings.length > 0 && (
                  <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded">
                    <h5 className="text-amber-800 font-medium mb-2">Warnings:</h5>
                    <ul className="text-amber-700 text-sm space-y-1">
                      {previewData.warnings.map((warning: string, index: number) => (
                        <li key={index}>• {warning}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="text-sm text-blue-700">
                  {getChanges().length} change(s) detected
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handlePreview}
              disabled={previewLoading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg transition-colors flex items-center"
            >
              <Eye className="h-4 w-4 mr-2" />
              {previewLoading ? 'Loading...' : 'Preview'}
            </button>
            <button
              onClick={handleSave}
              disabled={!previewData}
              className="px-4 py-2 bg-[#BF9C73] hover:bg-[#BF9C73]/90 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center"
            >
              <Save className="h-4 w-4 mr-2" />
              Save
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        onConfirm={handleConfirmUpdate}
        title="Confirm Payer Update"
        description={`You are about to update ${payer.name}. This change will be applied immediately and logged in the audit trail.`}
        changes={getChanges()}
        warnings={previewData?.warnings || []}
      />
    </>
  )
}