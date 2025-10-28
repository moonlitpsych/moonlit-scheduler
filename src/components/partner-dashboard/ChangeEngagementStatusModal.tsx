/**
 * Change Engagement Status Modal
 *
 * Allows case managers to update patient engagement status.
 * Requires reason for changes to non-active states.
 * Notifies Moonlit admin when case manager changes status to non-active.
 */

'use client'

import { useState } from 'react'
import { X, AlertTriangle } from 'lucide-react'

interface ChangeEngagementStatusModalProps {
  patient: {
    id: string
    first_name: string
    last_name: string
  }
  currentStatus: string
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  userEmail: string
  userType?: 'admin' | 'provider' | 'partner'  // NEW: Determines if notification warning shows
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active', description: 'Patient is actively engaged in treatment' },
  { value: 'discharged', label: 'Discharged', description: 'Patient completed treatment program' },
  { value: 'transferred', label: 'Transferred', description: 'Patient transferred to another provider/facility' },
  { value: 'inactive', label: 'Inactive', description: 'Patient no longer seeking care' },
  { value: 'deceased', label: 'Deceased', description: 'Patient is deceased' }
]

export function ChangeEngagementStatusModal({
  patient,
  currentStatus,
  isOpen,
  onClose,
  onSuccess,
  userEmail,
  userType = 'partner'
}: ChangeEngagementStatusModalProps) {
  const [selectedStatus, setSelectedStatus] = useState(currentStatus)
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0])
  const [changeReason, setChangeReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validate reason for non-active statuses
    if (selectedStatus !== 'active' && !changeReason.trim()) {
      setError('Please provide a reason for this status change')
      return
    }

    setLoading(true)

    try {
      const response = await fetch(`/api/patients/${patient.id}/engagement-status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: selectedStatus,
          effective_date: new Date(effectiveDate).toISOString(),
          change_reason: changeReason.trim() || null,
          changed_by_email: userEmail,
          changed_by_type: userType === 'admin' ? 'admin' : 'partner_user'
        })
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('Status update failed:', data)
        throw new Error(data.error || 'Failed to update engagement status')
      }

      console.log('✅ Status update successful:', {
        patient_id: patient.id,
        previous_status: data.previous_status,
        new_status: data.new_status,
        changed: data.changed,
        needs_admin_notification: data.needs_admin_notification
      })

      // Show notification if admin will be notified (only for partner users)
      if (data.needs_admin_notification && userType === 'partner') {
        alert('Status updated. Moonlit admin has been notified of this change.')
      } else if (userType === 'admin') {
        // For admin users, just show a simple success message
        alert(`Status updated successfully to "${STATUS_OPTIONS.find(o => o.value === selectedStatus)?.label}".`)
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      console.error('Error updating engagement status:', err)
      setError(err.message || 'Failed to update status')
    } finally {
      setLoading(false)
    }
  }

  const willNotifyAdmin = selectedStatus !== 'active'

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-moonlit-navy font-['Newsreader']">
            Change Engagement Status
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Patient Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-700">
              Patient: <span className="text-moonlit-navy">{patient.first_name} {patient.last_name}</span>
            </p>
            <p className="text-sm text-gray-600 mt-1">
              Current Status: <span className="font-medium capitalize">{currentStatus}</span>
            </p>
          </div>

          {/* Status Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              New Status
            </label>
            <div className="space-y-2">
              {STATUS_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex items-start p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedStatus === option.value
                      ? 'border-moonlit-brown bg-moonlit-brown/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="status"
                    value={option.value}
                    checked={selectedStatus === option.value}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="mt-0.5 mr-3 text-moonlit-brown focus:ring-moonlit-brown"
                  />
                  <div>
                    <div className="font-medium text-gray-900">{option.label}</div>
                    <div className="text-sm text-gray-600">{option.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Effective Date */}
          <div>
            <label htmlFor="effectiveDate" className="block text-sm font-medium text-gray-700 mb-2">
              Effective Date
            </label>
            <input
              type="date"
              id="effectiveDate"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-moonlit-brown focus:border-transparent"
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              The date this status became effective (not necessarily today)
            </p>
          </div>

          {/* Change Reason */}
          <div>
            <label htmlFor="changeReason" className="block text-sm font-medium text-gray-700 mb-2">
              Reason for Change {selectedStatus !== 'active' && <span className="text-red-500">*</span>}
            </label>
            <textarea
              id="changeReason"
              value={changeReason}
              onChange={(e) => setChangeReason(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-moonlit-brown focus:border-transparent"
              placeholder="Briefly explain why this status is changing..."
              required={selectedStatus !== 'active'}
            />
          </div>

          {/* Admin Notification Warning - Only show for partner users */}
          {willNotifyAdmin && userType === 'partner' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium">Moonlit admin will be notified</p>
                <p className="mt-1">
                  Changing status to "{STATUS_OPTIONS.find(o => o.value === selectedStatus)?.label}"
                  will trigger an email notification to Moonlit administrative staff.
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || selectedStatus === currentStatus}
              className="px-4 py-2 bg-moonlit-brown text-white rounded-lg hover:bg-moonlit-brown/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Updating...' : 'Update Status'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
