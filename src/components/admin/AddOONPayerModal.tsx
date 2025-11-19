'use client'

import { useState } from 'react'
import { X, AlertCircle, CheckCircle } from 'lucide-react'

interface AddOONPayerModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

const STATES = [
  { value: 'UT', label: 'Utah (UT)' },
  { value: 'ID', label: 'Idaho (ID)' },
  { value: 'Other', label: 'Other' }
]

const PAYER_TYPES = [
  { value: 'medicaid', label: 'Medicaid' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'medicare', label: 'Medicare' },
  { value: 'other', label: 'Other' }
]

export default function AddOONPayerModal({ isOpen, onClose, onSuccess }: AddOONPayerModalProps) {
  const [name, setName] = useState('')
  const [state, setState] = useState('UT')
  const [payerType, setPayerType] = useState('medicaid')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      setError('Payer name is required')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/payers/add-oon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          state,
          payer_type: payerType
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add out-of-network payer')
      }

      // Show success state
      setSuccess(true)

      // Wait a moment to show success message, then close and refresh
      setTimeout(() => {
        setSuccess(false)
        setName('')
        setState('UT')
        setPayerType('medicaid')
        onSuccess()
        onClose()
      }, 1500)

    } catch (err: any) {
      console.error('Error adding OON payer:', err)
      setError(err.message || 'Failed to add payer. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      setName('')
      setState('UT')
      setPayerType('medicaid')
      setError(null)
      setSuccess(false)
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              Add Out-of-Network Payer
            </h2>
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Success Message */}
            {success && (
              <div className="flex items-center space-x-2 p-4 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                <p className="text-sm text-green-800 font-medium">
                  Out-of-network payer added successfully!
                </p>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="flex items-center space-x-2 p-4 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Payer Name */}
            <div>
              <label htmlFor="payerName" className="block text-sm font-medium text-gray-700 mb-1">
                Payer Name <span className="text-red-500">*</span>
              </label>
              <input
                id="payerName"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSubmitting || success}
                placeholder="e.g., Bear River Behavioral Health"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                required
              />
            </div>

            {/* State */}
            <div>
              <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-1">
                State <span className="text-red-500">*</span>
              </label>
              <select
                id="state"
                value={state}
                onChange={(e) => setState(e.target.value)}
                disabled={isSubmitting || success}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                {STATES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            {/* Payer Type */}
            <div>
              <label htmlFor="payerType" className="block text-sm font-medium text-gray-700 mb-1">
                Payer Type <span className="text-red-500">*</span>
              </label>
              <select
                id="payerType"
                value={payerType}
                onChange={(e) => setPayerType(e.target.value)}
                disabled={isSubmitting || success}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                {PAYER_TYPES.map(pt => (
                  <option key={pt.value} value={pt.value}>{pt.label}</option>
                ))}
              </select>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> This will create a payer entry that shows as "not accepted" in the booking flow.
                Patients searching for this payer will see it's out-of-network and can join a waitlist.
              </p>
            </div>

            {/* Actions */}
            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting || success}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || success || !name.trim()}
                className="flex-1 px-4 py-2 bg-[#BF9C73] text-white rounded-lg hover:bg-[#A8875F] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Adding...
                  </>
                ) : success ? (
                  'Added!'
                ) : (
                  'Add Out-of-Network Payer'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
