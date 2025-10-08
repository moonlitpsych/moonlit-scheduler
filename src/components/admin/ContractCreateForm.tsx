'use client'

import { useState, useEffect } from 'react'
import { X, Calendar, Building2, User, AlertCircle, Check } from 'lucide-react'

interface ContractCreateFormProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (contract: any) => void
  onError: (error: string) => void
}

interface Provider {
  id: string
  first_name: string
  last_name: string
  email: string | null
}

interface Payer {
  id: string
  name: string
  payer_type: string | null
  state: string | null
}

export default function ContractCreateForm({
  isOpen,
  onClose,
  onCreate,
  onError
}: ContractCreateFormProps) {
  const [providers, setProviders] = useState<Provider[]>([])
  const [payers, setPayers] = useState<Payer[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [providerId, setProviderId] = useState('')
  const [payerId, setPayerId] = useState('')
  const [effectiveDate, setEffectiveDate] = useState('')
  const [expirationDate, setExpirationDate] = useState('')
  const [status, setStatus] = useState('')  // Empty = let database use default
  const [notes, setNotes] = useState('')
  const [auditNote, setAuditNote] = useState('')

  // Load providers and payers
  useEffect(() => {
    if (isOpen) {
      loadFormData()
    }
  }, [isOpen])

  const loadFormData = async () => {
    try {
      setLoadingData(true)

      // Fetch ALL providers (use admin endpoint to get all providers, not just bookable ones)
      const providersRes = await fetch('/api/admin/providers')
      if (providersRes.ok) {
        const providersData = await providersRes.json()
        setProviders(providersData.data || [])
      }

      // Fetch payers
      const payersRes = await fetch('/api/payers')
      if (payersRes.ok) {
        const payersData = await payersRes.json()
        setPayers(payersData.data || [])
      }
    } catch (error) {
      console.error('Error loading form data:', error)
      onError('Failed to load providers and payers')
    } finally {
      setLoadingData(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate required fields
    if (!providerId || !payerId || !effectiveDate) {
      onError('Please fill in all required fields: Provider, Payer, and Effective Date')
      return
    }

    if (!auditNote.trim()) {
      onError('Please provide an audit note explaining this contract creation')
      return
    }

    // Validate dates
    if (expirationDate && new Date(expirationDate) <= new Date(effectiveDate)) {
      onError('Expiration date must be after effective date')
      return
    }

    try {
      setSubmitting(true)

      const response = await fetch('/api/admin/contracts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          provider_id: providerId,
          payer_id: payerId,
          effective_date: effectiveDate,
          expiration_date: expirationDate || null,
          status,
          notes: `${notes}\n\n[AUDIT] ${auditNote}`
        })
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        onError(result.details || result.error || 'Failed to create contract')
        return
      }

      // Success!
      onCreate(result.data)
      handleClose()
    } catch (error: any) {
      console.error('Error creating contract:', error)
      onError(error.message || 'Failed to create contract')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    // Reset form
    setProviderId('')
    setPayerId('')
    setEffectiveDate('')
    setExpirationDate('')
    setStatus('')
    setNotes('')
    setAuditNote('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-stone-200">
          <div>
            <h2 className="text-xl font-semibold text-[#091747] font-['Newsreader']">
              Save Payer Contract
            </h2>
            <p className="text-sm text-[#091747]/60 mt-1">
              Create or update a provider-payer network relationship
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={submitting}
            className="p-2 hover:bg-stone-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5 text-[#091747]/60" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {loadingData ? (
            <div className="py-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-[#BF9C73] border-t-transparent"></div>
              <p className="mt-4 text-[#091747]/60">Loading form data...</p>
            </div>
          ) : (
            <>
              {/* Provider Selection */}
              <div>
                <label className="flex items-center space-x-2 text-sm font-medium text-[#091747] mb-2">
                  <User className="h-4 w-4" />
                  <span>Provider *</span>
                </label>
                <select
                  value={providerId}
                  onChange={(e) => setProviderId(e.target.value)}
                  required
                  disabled={submitting}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20 focus:border-[#BF9C73] disabled:opacity-50"
                >
                  <option value="">Select a provider...</option>
                  {providers
                    .sort((a, b) => a.last_name.localeCompare(b.last_name))
                    .map(provider => (
                      <option key={provider.id} value={provider.id}>
                        {provider.first_name} {provider.last_name} {provider.email ? `(${provider.email})` : ''}
                      </option>
                    ))}
                </select>
              </div>

              {/* Payer Selection */}
              <div>
                <label className="flex items-center space-x-2 text-sm font-medium text-[#091747] mb-2">
                  <Building2 className="h-4 w-4" />
                  <span>Payer *</span>
                </label>
                <select
                  value={payerId}
                  onChange={(e) => setPayerId(e.target.value)}
                  required
                  disabled={submitting}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20 focus:border-[#BF9C73] disabled:opacity-50"
                >
                  <option value="">Select a payer...</option>
                  {payers
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(payer => (
                      <option key={payer.id} value={payer.id}>
                        {payer.name} {payer.state ? `(${payer.state})` : ''}
                      </option>
                    ))}
                </select>
              </div>

              {/* Effective Date */}
              <div>
                <label className="flex items-center space-x-2 text-sm font-medium text-[#091747] mb-2">
                  <Calendar className="h-4 w-4" />
                  <span>Effective Date *</span>
                </label>
                <input
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  required
                  disabled={submitting}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20 focus:border-[#BF9C73] disabled:opacity-50"
                />
                <p className="text-xs text-[#091747]/60 mt-1">
                  When this contract becomes effective
                </p>
              </div>

              {/* Expiration Date */}
              <div>
                <label className="flex items-center space-x-2 text-sm font-medium text-[#091747] mb-2">
                  <Calendar className="h-4 w-4" />
                  <span>Expiration Date (Optional)</span>
                </label>
                <input
                  type="date"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                  disabled={submitting}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20 focus:border-[#BF9C73] disabled:opacity-50"
                />
                <p className="text-xs text-[#091747]/60 mt-1">
                  Leave blank for ongoing contracts
                </p>
              </div>

              {/* Status - Optional field */}
              <div>
                <label className="flex items-center space-x-2 text-sm font-medium text-[#091747] mb-2">
                  <Check className="h-4 w-4" />
                  <span>Status (Optional)</span>
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  disabled={submitting}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20 focus:border-[#BF9C73] disabled:opacity-50"
                >
                  <option value="">Default (let database decide)</option>
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="inactive">Inactive</option>
                </select>
                <p className="text-xs text-[#091747]/60 mt-1">
                  Leave as default unless you need a specific status
                </p>
              </div>

              {/* Notes */}
              <div>
                <label className="text-sm font-medium text-[#091747] mb-2 block">
                  Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={submitting}
                  rows={3}
                  placeholder="Additional notes about this contract..."
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20 focus:border-[#BF9C73] disabled:opacity-50"
                />
              </div>

              {/* Audit Note */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <label className="flex items-center space-x-2 text-sm font-medium text-yellow-900 mb-2">
                  <AlertCircle className="h-4 w-4" />
                  <span>Audit Note * (Required for Compliance)</span>
                </label>
                <textarea
                  value={auditNote}
                  onChange={(e) => setAuditNote(e.target.value)}
                  required
                  disabled={submitting}
                  rows={2}
                  placeholder="e.g., 'New contract received from Molina on 10/7/2025, effective 11/1/2025' or 'Updating effective date per payer notification'"
                  className="w-full px-3 py-2 border border-yellow-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 disabled:opacity-50"
                />
                <p className="text-xs text-yellow-800 mt-2">
                  This note will be logged for audit purposes. Include the source and reason for this change.
                </p>
              </div>

              {/* Warning about data integrity */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-800">
                    <strong>What this does:</strong>
                    <ul className="list-disc ml-5 mt-2 space-y-1">
                      <li><strong>Creates or updates</strong> one row in the <code>provider_payer_networks</code> table</li>
                      <li>This establishes a <strong>direct contract</strong> between the provider and payer</li>
                      <li><strong>Bookability is automatically updated</strong> through the <code>v_bookable_provider_payer</code> view</li>
                      <li><strong>No supervision relationships</strong> are created - use the Supervision page for that</li>
                      <li>If a contract already exists for this provider-payer pair, it will be <strong>updated</strong> (not duplicated)</li>
                    </ul>
                    <p className="mt-3">
                      <strong>Impact:</strong> This immediately affects which providers patients can book with this payer.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Footer */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-stone-200">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="px-4 py-2 border border-stone-200 text-[#091747] rounded-lg hover:bg-stone-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || loadingData}
              className="px-4 py-2 bg-[#BF9C73] hover:bg-[#BF9C73]/90 disabled:bg-[#BF9C73]/50 text-white rounded-lg transition-colors flex items-center space-x-2"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  <span>Saving Contract...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>Save Contract</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
