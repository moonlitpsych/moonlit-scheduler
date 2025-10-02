'use client'

import { useState, useEffect } from 'react'
import { X, Save, AlertTriangle, Plus, Trash2, Edit3, Eye } from 'lucide-react'
import ConfirmationModal from './ConfirmationModal'

interface Payer {
  id?: string
  name: string
  payer_type: string
  state: string
  status_code: string | null
  effective_date: string | null
  requires_attending: boolean
  allows_supervised: boolean
  supervision_level: string | null
  requires_individual_contract: boolean
}

interface Contract {
  id?: string
  provider_id: string
  provider_name: string
  effective_date: string | null
  expiration_date: string | null
  status: string
  billing_provider_id: string | null
  isNew?: boolean
  needsUpdate?: boolean
  updateReason?: string
}

interface ChangeSet {
  payerChanges: Record<string, any>
  contractUpdates: Contract[]
  newContracts: Contract[]
  contractDeletes: string[]
}

interface PayerEditorModalProps {
  payer: Payer
  isOpen: boolean
  onClose: () => void
  onUpdate: () => void
}

const PAYER_TYPES = [
  { value: 'Private', label: 'Private Insurance' },
  { value: 'Medicare', label: 'Medicare' },
  { value: 'Medicaid', label: 'Medicaid' },
  { value: 'Self-Pay', label: 'Self-Pay' },
  { value: 'Other', label: 'Other' }
]

const SUPERVISION_LEVELS = [
  { value: 'none', label: 'None' },
  { value: 'sign_off_only', label: 'Sign-off Only' },
  { value: 'first_visit_in_person', label: 'First Visit In-Person' },
  { value: 'co_visit_required', label: 'Co-visit Required' }
]

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
]

export default function PayerEditorModal({
  payer,
  isOpen,
  onClose,
  onUpdate
}: PayerEditorModalProps) {
  const [formData, setFormData] = useState<Payer>(payer)
  const [contracts, setContracts] = useState<Contract[]>([])
  const [providers, setProviders] = useState<Array<{ id: string, name: string }>>([])
  const [loading, setLoading] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [changeSet, setChangeSet] = useState<ChangeSet | null>(null)

  const isNewPayer = !payer.id

  // Load initial data
  useEffect(() => {
    if (isOpen) {
      setFormData(payer)
      if (!isNewPayer) {
        fetchContracts()
      }
      fetchProviders()
    }
  }, [isOpen, payer])

  const fetchContracts = async () => {
    if (!payer.id) return

    try {
      const response = await fetch(`/api/admin/payers/${payer.id}/contracts`, {
        credentials: 'omit'
      })
      const result = await response.json()

      if (response.ok && result.success) {
        setContracts(result.data || [])
      }
    } catch (error) {
      console.error('❌ Error fetching contracts:', error)
    }
  }

  const fetchProviders = async () => {
    try {
      const response = await fetch('/api/admin/providers', {
        credentials: 'omit'
      })
      const result = await response.json()

      if (response.ok && result.success) {
        setProviders(result.data || [])
      }
    } catch (error) {
      console.error('❌ Error fetching providers:', error)
    }
  }

  const handleFieldChange = (field: keyof Payer, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const addNewContract = () => {
    const newContract: Contract = {
      provider_id: '',
      provider_name: '',
      effective_date: formData.effective_date,
      expiration_date: null,
      status: 'active',
      billing_provider_id: null,
      isNew: true
    }
    setContracts(prev => [...prev, newContract])
  }

  const updateContract = (index: number, field: keyof Contract, value: any) => {
    setContracts(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }

      // Update provider name when provider_id changes
      if (field === 'provider_id') {
        const provider = providers.find(p => p.id === value)
        updated[index].provider_name = provider?.name || ''
      }

      return updated
    })
  }

  const removeContract = (index: number) => {
    setContracts(prev => prev.filter((_, i) => i !== index))
  }

  const detectChanges = (): ChangeSet => {
    const payerChanges: Record<string, any> = {}

    // Detect payer changes
    Object.keys(formData).forEach(key => {
      if (formData[key as keyof Payer] !== payer[key as keyof Payer]) {
        payerChanges[key] = formData[key as keyof Payer]
      }
    })

    // Detect contract changes
    const contractUpdates: Contract[] = []
    const newContracts: Contract[] = []

    contracts.forEach(contract => {
      if (contract.isNew) {
        newContracts.push(contract)
      } else if (contract.needsUpdate ||
                 (formData.effective_date !== payer.effective_date && contract.effective_date === payer.effective_date)) {
        contractUpdates.push({
          ...contract,
          needsUpdate: true,
          updateReason: formData.effective_date !== payer.effective_date
            ? 'Payer effective date changed'
            : 'Manual update'
        })
      }
    })

    return {
      payerChanges,
      contractUpdates,
      newContracts,
      contractDeletes: []
    }
  }

  const handlePreview = () => {
    const changes = detectChanges()
    setChangeSet(changes)
    setShowConfirmation(true)
  }

  const handleConfirmSave = async (note: string) => {
    if (!changeSet) return

    try {
      setLoading(true)

      const response = await fetch(isNewPayer
        ? '/api/admin/payers/comprehensive-update'
        : `/api/admin/payers/${payer.id}/comprehensive-update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'omit',
        body: JSON.stringify({
          payerData: formData,
          contractUpdates: changeSet.contractUpdates,
          newContracts: changeSet.newContracts,
          contractDeletes: changeSet.contractDeletes,
          isNewPayer,
          note
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Save failed')
      }

      onUpdate()
      onClose()

    } catch (error) {
      console.error('❌ Save error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const getChangeSummary = () => {
    if (!changeSet) return []

    const changes = []

    if (Object.keys(changeSet.payerChanges).length > 0) {
      changes.push({
        field: 'Payer Information',
        oldValue: 'Various fields',
        newValue: `${Object.keys(changeSet.payerChanges).length} field(s) updated`
      })
    }

    if (changeSet.contractUpdates.length > 0) {
      changes.push({
        field: 'Contract Updates',
        oldValue: `${changeSet.contractUpdates.length} contracts`,
        newValue: 'Updated due to payer changes'
      })
    }

    if (changeSet.newContracts.length > 0) {
      changes.push({
        field: 'New Contracts',
        oldValue: 'None',
        newValue: `${changeSet.newContracts.length} new contract(s)`
      })
    }

    return changes
  }

  const hasUnsavedChanges = () => {
    const changes = detectChanges()
    return Object.keys(changes.payerChanges).length > 0 ||
           changes.contractUpdates.length > 0 ||
           changes.newContracts.length > 0
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full max-h-[95vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-[#091747] font-['Newsreader']">
              {isNewPayer ? 'Create New Payer' : `Edit Payer: ${payer.name}`}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-2"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex h-[80vh]">
            {/* Left Side - Payer Information */}
            <div className="w-1/2 p-6 border-r border-gray-200 overflow-y-auto">
              <h3 className="text-lg font-semibold text-[#091747] mb-4">Payer Information</h3>

              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-[#091747] mb-2">
                    Payer Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20 focus:border-[#BF9C73]"
                    required
                  />
                </div>

                {/* Type and State */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#091747] mb-2">
                      Payer Type *
                    </label>
                    <select
                      value={formData.payer_type}
                      onChange={(e) => handleFieldChange('payer_type', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20 focus:border-[#BF9C73]"
                      required
                    >
                      <option value="">Select type...</option>
                      {PAYER_TYPES.map(type => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#091747] mb-2">
                      State
                    </label>
                    <select
                      value={formData.state}
                      onChange={(e) => handleFieldChange('state', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20 focus:border-[#BF9C73]"
                    >
                      <option value="">Select state...</option>
                      {US_STATES.map(state => (
                        <option key={state} value={state}>
                          {state}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Status and Effective Date */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#091747] mb-2">
                      Status Code
                    </label>
                    <select
                      value={formData.status_code || ''}
                      onChange={(e) => handleFieldChange('status_code', e.target.value || null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20 focus:border-[#BF9C73]"
                    >
                      <option value="">No status</option>
                      <option value="approved">Approved</option>
                      <option value="pending">Pending</option>
                      <option value="rejected">Rejected</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#091747] mb-2">
                      Effective Date
                    </label>
                    <input
                      type="date"
                      value={formData.effective_date || ''}
                      onChange={(e) => handleFieldChange('effective_date', e.target.value || null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20 focus:border-[#BF9C73]"
                    />
                  </div>
                </div>

                {/* Requirements */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <input
                      id="requires_attending"
                      type="checkbox"
                      checked={formData.requires_attending}
                      onChange={(e) => handleFieldChange('requires_attending', e.target.checked)}
                      className="w-4 h-4 text-[#BF9C73] border-gray-300 rounded focus:ring-[#BF9C73]/20"
                    />
                    <label htmlFor="requires_attending" className="text-sm font-medium text-[#091747]">
                      Requires Attending Physician
                    </label>
                  </div>

                  <div className="flex items-center space-x-3">
                    <input
                      id="allows_supervised"
                      type="checkbox"
                      checked={formData.allows_supervised}
                      onChange={(e) => handleFieldChange('allows_supervised', e.target.checked)}
                      className="w-4 h-4 text-[#BF9C73] border-gray-300 rounded focus:ring-[#BF9C73]/20"
                    />
                    <label htmlFor="allows_supervised" className="text-sm font-medium text-[#091747]">
                      Allows Supervised Care
                    </label>
                  </div>

                  <div className="flex items-center space-x-3">
                    <input
                      id="requires_individual_contract"
                      type="checkbox"
                      checked={formData.requires_individual_contract}
                      onChange={(e) => handleFieldChange('requires_individual_contract', e.target.checked)}
                      className="w-4 h-4 text-[#BF9C73] border-gray-300 rounded focus:ring-[#BF9C73]/20"
                    />
                    <label htmlFor="requires_individual_contract" className="text-sm font-medium text-[#091747]">
                      Requires Individual Provider Contracts
                    </label>
                  </div>
                </div>

                {/* Supervision Level */}
                <div>
                  <label className="block text-sm font-medium text-[#091747] mb-2">
                    Supervision Level
                  </label>
                  <select
                    value={formData.supervision_level || 'none'}
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
                      Enable "Allows Supervised Care" to set supervision level
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Right Side - Provider Contracts */}
            <div className="w-1/2 p-6 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-[#091747]">Provider Contracts</h3>
                <button
                  onClick={addNewContract}
                  className="flex items-center space-x-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Contract</span>
                </button>
              </div>

              <div className="space-y-4">
                {contracts.map((contract, index) => (
                  <div
                    key={contract.id || index}
                    className={`p-4 border rounded-lg ${
                      contract.isNew ? 'border-green-300 bg-green-50' :
                      contract.needsUpdate ? 'border-yellow-300 bg-yellow-50' :
                      'border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        {contract.isNew && (
                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                            New
                          </span>
                        )}
                        {contract.needsUpdate && (
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                            Update Required
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => removeContract(index)}
                        className="text-red-600 hover:text-red-800 p-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-[#091747] mb-1">
                          Provider *
                        </label>
                        <select
                          value={contract.provider_id}
                          onChange={(e) => updateContract(index, 'provider_id', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20 focus:border-[#BF9C73]"
                          required
                        >
                          <option value="">Select provider...</option>
                          {providers.map(provider => (
                            <option key={provider.id} value={provider.id}>
                              {provider.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-[#091747] mb-1">
                            Effective Date
                          </label>
                          <input
                            type="date"
                            value={contract.effective_date || ''}
                            onChange={(e) => updateContract(index, 'effective_date', e.target.value || null)}
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20 focus:border-[#BF9C73]"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[#091747] mb-1">
                            Expiration Date
                          </label>
                          <input
                            type="date"
                            value={contract.expiration_date || ''}
                            onChange={(e) => updateContract(index, 'expiration_date', e.target.value || null)}
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20 focus:border-[#BF9C73]"
                          />
                        </div>
                      </div>

                      {contract.updateReason && (
                        <div className="text-sm text-yellow-700 bg-yellow-100 p-2 rounded">
                          <strong>Update Reason:</strong> {contract.updateReason}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {contracts.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No contracts added yet. Click "Add Contract" to create one.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
            <div className="text-sm text-gray-600">
              {hasUnsavedChanges() ? (
                <span className="text-yellow-600">⚠️ You have unsaved changes</span>
              ) : (
                <span>No changes detected</span>
              )}
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePreview}
                disabled={!hasUnsavedChanges() || loading}
                className="px-4 py-2 bg-[#BF9C73] hover:bg-[#BF9C73]/90 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center"
              >
                <Save className="h-4 w-4 mr-2" />
                {loading ? 'Saving...' : 'Preview & Save'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmation && changeSet && (
        <ConfirmationModal
          isOpen={showConfirmation}
          onClose={() => setShowConfirmation(false)}
          onConfirm={handleConfirmSave}
          title={`${isNewPayer ? 'Create' : 'Update'} Payer & Contracts`}
          description={`You are about to ${isNewPayer ? 'create a new payer' : `update ${payer.name}`} and ${changeSet.contractUpdates.length + changeSet.newContracts.length} associated contracts. This change will be applied immediately and logged in the audit trail.`}
          changes={getChangeSummary()}
          warnings={[]}
        />
      )}
    </>
  )
}