'use client'

import { useState } from 'react'
import { AlertTriangle, FileText, X } from 'lucide-react'

interface ChangeItem {
  field: string
  oldValue: any
  newValue: any
}

interface ConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (note: string) => Promise<void>
  title: string
  description: string
  changes: ChangeItem[]
  warnings?: string[]
  loading?: boolean
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  changes,
  warnings = [],
  loading = false
}: ConfirmationModalProps) {
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleConfirm = async () => {
    if (!note.trim()) return

    setSubmitting(true)
    try {
      await onConfirm(note.trim())
      setNote('')
      onClose()
    } catch (error) {
      console.error('Confirmation error:', error)
    } finally {
      setSubmitting(false)
    }
  }

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return '(none)'
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    if (typeof value === 'string' && value.includes('T')) {
      // Likely a date string
      try {
        return new Date(value).toLocaleDateString()
      } catch {
        return value
      }
    }
    return String(value)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-[#091747] font-['Newsreader']">{title}</h2>
          <button
            onClick={onClose}
            disabled={submitting}
            className="text-gray-400 hover:text-gray-600 p-2 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Description */}
          <p className="text-[#091747]/70 mb-6">{description}</p>

          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="text-amber-800 font-medium mb-2">Warnings</h4>
                  <ul className="text-amber-700 text-sm space-y-1">
                    {warnings.map((warning, index) => (
                      <li key={index}>• {warning}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Changes */}
          <div className="mb-6">
            <h4 className="text-[#091747] font-medium mb-3 flex items-center">
              <FileText className="h-4 w-4 mr-2" />
              Changes to be applied
            </h4>

            {changes.length === 0 ? (
              <p className="text-[#091747]/60 text-sm">No changes detected</p>
            ) : (
              <div className="space-y-3">
                {changes.map((change, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded-lg">
                    <div className="font-medium text-[#091747] mb-2 capitalize">
                      {change.field.replace(/_/g, ' ')}
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Current:</span>
                        <div className="text-[#091747] font-mono">
                          {formatValue(change.oldValue)}
                        </div>
                      </div>
                      <div>
                        <span className="text-green-600">New:</span>
                        <div className="text-green-700 font-mono font-medium">
                          {formatValue(change.newValue)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Audit Note */}
          <div className="mb-6">
            <label htmlFor="audit-note" className="block text-sm font-medium text-[#091747] mb-2">
              Edit Note <span className="text-red-500">*</span>
            </label>
            <textarea
              id="audit-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={submitting}
              placeholder="Describe the reason for this change (required for audit trail)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20 focus:border-[#BF9C73] disabled:opacity-50"
              rows={3}
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              This note will be stored in the audit log and cannot be changed later.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!note.trim() || submitting || loading}
            className="px-4 py-2 bg-[#BF9C73] hover:bg-[#BF9C73]/90 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center"
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                Applying...
              </>
            ) : (
              'Confirm & Apply'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}