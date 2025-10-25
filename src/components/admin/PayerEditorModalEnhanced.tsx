'use client'

import { useState, useEffect } from 'react'
import { X, Save, AlertTriangle, Plus, Trash2, FileText, Users, Settings, Shield, CheckCircle, Package } from 'lucide-react'
import ConfirmationModal from './ConfirmationModal'
import SupervisionSetupPanel from './SupervisionSetupPanel'
import PracticeQMappingForm, { PracticeQMapping } from './PracticeQMappingForm'
import ServiceInstancesPanel, { ServiceInstance } from './ServiceInstancesPanel'
import ContractValidationSummary from './ContractValidationSummary'
import { SanityCheckResults } from '@/lib/services/payerSanityCheckService'

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
  isNew?: boolean
  needsUpdate?: boolean
  updateReason?: string
}

interface SupervisionMapping {
  resident_id: string
  resident_name: string
  attending_id: string
  attending_name: string
  supervision_type: string
  start_date: string
}

interface PayerEditorModalEnhancedProps {
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

type TabType = 'basic' | 'contracts' | 'supervision' | 'service_instances' | 'practiceq'

export default function PayerEditorModalEnhanced({
  payer,
  isOpen,
  onClose,
  onUpdate
}: PayerEditorModalEnhancedProps) {
  const [formData, setFormData] = useState<Payer>(payer)
  const [contracts, setContracts] = useState<Contract[]>([])
  const [initialContractCount, setInitialContractCount] = useState<number>(0)
  const [providers, setProviders] = useState<Array<{ id: string, name: string }>>([])
  const [supervisionMappings, setSupervisionMappings] = useState<SupervisionMapping[]>([])
  const [initialSupervisionCount, setInitialSupervisionCount] = useState<number>(0)
  const [serviceInstances, setServiceInstances] = useState<ServiceInstance[]>([])
  const [initialServiceInstanceCount, setInitialServiceInstanceCount] = useState<number>(0)
  const [practiceQMapping, setPracticeQMapping] = useState<PracticeQMapping | null>(null)
  const [validationResults, setValidationResults] = useState<SanityCheckResults | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('basic')
  const [loading, setLoading] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)

  const isNewPayer = !payer.id

  // Load initial data
  useEffect(() => {
    if (isOpen) {
      setFormData(payer)
      if (!isNewPayer) {
        fetchContracts()
        fetchExistingMappings()
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
        const fetchedContracts = result.data || []
        setContracts(fetchedContracts)
        setInitialContractCount(fetchedContracts.length)
        console.log(`📊 Loaded ${fetchedContracts.length} existing contracts`)
      }
    } catch (error) {
      console.error('❌ Error fetching contracts:', error)
    }
  }

  const fetchProviders = async () => {
    try {
      const response = await fetch('/api/admin/providers', {
        credentials: 'include' // Changed from 'omit' to 'include' to send cookies
      })
      const result = await response.json()

      if (response.ok && result.success) {
        // Map the provider data to include a 'name' field
        const mappedProviders = (result.data || []).map((p: any) => ({
          id: p.id,
          name: `${p.first_name} ${p.last_name}`,
          first_name: p.first_name,
          last_name: p.last_name,
          role: p.role,
          is_active: p.is_active,
          is_bookable: p.is_bookable
        }))
        setProviders(mappedProviders)
      } else {
        console.error('Failed to fetch providers:', result.error)
      }
    } catch (error) {
      console.error('❌ Error fetching providers:', error)
    }
  }

  const fetchExistingMappings = async () => {
    if (!payer.id) return

    try {
      // Fetch existing supervision relationships
      const supervisionResponse = await fetch(`/api/admin/payers/${payer.id}/supervision`, {
        credentials: 'omit'
      })
      if (supervisionResponse.ok) {
        const supervisionResult = await supervisionResponse.json()
        if (supervisionResult.success && supervisionResult.data) {
          setInitialSupervisionCount(supervisionResult.data.length)
          console.log(`📊 Loaded ${supervisionResult.data.length} existing supervision relationships`)
        }
      }

      // Fetch existing service instances
      const instancesResponse = await fetch(`/api/admin/payers/${payer.id}/service-instances`, {
        credentials: 'include'
      })
      if (instancesResponse.ok) {
        const instancesResult = await instancesResponse.json()
        if (instancesResult.success && instancesResult.data) {
          setInitialServiceInstanceCount(instancesResult.data.length)
          console.log(`📊 Loaded ${instancesResult.data.length} existing service instances`)
        }
      }

      // Fetch existing PracticeQ mappings
      const response = await fetch(`/api/admin/payers/${payer.id}/external-mappings?system=practiceq`, {
        credentials: 'omit'
      })
      if (response.ok) {
        const result = await response.json()
        if (result.data) {
          const mappings = result.data
          const practiceQData: PracticeQMapping = {
            insurance_company_name: mappings.insurance_company_name || '',
            payer_code: mappings.payer_code || '',
            aliases: Object.keys(mappings)
              .filter(k => k.startsWith('alias_'))
              .map(k => mappings[k])
          }
          setPracticeQMapping(practiceQData)
        }
      }
    } catch (error) {
      console.error('❌ Error fetching existing mappings:', error)
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
      status: 'in_network',
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

  const handleSave = () => {
    // Show confirmation modal directly
    setShowConfirmation(true)
  }

  const handleConfirmSave = async (note: string) => {
    if (!payer.id && !isNewPayer) return

    try {
      setLoading(true)

      const endpoint = isNewPayer
        ? '/api/admin/payers/create-with-contract'
        : `/api/admin/payers/${payer.id}/apply-contract`

      // Only send fields that exist in the payers table
      const cleanPayerUpdates = {
        status_code: formData.status_code,
        effective_date: formData.effective_date,
        allows_supervised: formData.allows_supervised,
        supervision_level: formData.supervision_level,
        requires_attending: formData.requires_attending,
        requires_individual_contract: formData.requires_individual_contract
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Fixed: was 'omit', should be 'include'
        body: JSON.stringify({
          payerUpdates: cleanPayerUpdates,
          providerContracts: contracts.filter(c => c.provider_id),
          supervisionSetup: supervisionMappings,
          serviceInstances: serviceInstances.filter(si => si.service_id),
          practiceQMapping,
          auditNote: note,
          runValidation: true
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Save failed')
      }

      // Show success message
      if (result.results?.validationResults) {
        setValidationResults(result.results.validationResults)
        setActiveTab('validation')
      }

      // Refresh parent and close after a delay
      setTimeout(() => {
        onUpdate()
        onClose()
      }, 2000)

    } catch (error: any) {
      console.error('❌ Save error:', error)
      alert(`Error: ${error.message}`)
    } finally {
      setLoading(false)
      setShowConfirmation(false)
    }
  }

  const getTabIcon = (tab: TabType) => {
    switch (tab) {
      case 'basic': return <Settings className="h-4 w-4" />
      case 'contracts': return <FileText className="h-4 w-4" />
      case 'supervision': return <Users className="h-4 w-4" />
      case 'service_instances': return <Package className="h-4 w-4" />
      case 'practiceq': return <Shield className="h-4 w-4" />
    }
  }

  const getTabLabel = (tab: TabType) => {
    switch (tab) {
      case 'basic': return 'Basic Info'
      case 'contracts': return 'Provider Contracts'
      case 'supervision': return 'Supervision'
      case 'service_instances': return 'Service Instances'
      case 'practiceq': return 'PracticeQ'
    }
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full max-h-[95vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-[#091747] font-['Newsreader']">
              {isNewPayer ? 'Create New Payer with Contract' : `Configure Payer Contract: ${payer.name}`}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-2"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <nav className="flex space-x-1 px-6">
              {(['basic', 'contracts', 'supervision', 'service_instances', 'practiceq'] as TabType[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-3 flex items-center space-x-2 border-b-2 transition-colors ${
                    activeTab === tab
                      ? 'border-[#BF9C73] text-[#BF9C73]'
                      : 'border-transparent text-gray-600 hover:text-gray-800'
                  }`}
                >
                  {getTabIcon(tab)}
                  <span>{getTabLabel(tab)}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="h-[70vh] overflow-y-auto">
            {/* Basic Info Tab */}
            {activeTab === 'basic' && (
              <div className="p-6 space-y-4">
                <h3 className="text-lg font-semibold text-[#091747] mb-4">Payer Information</h3>

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
                <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-700">Requirements</h4>
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
                    {formData.allows_supervised && (
                      <span className="text-xs text-green-600">
                        ✓ Enable supervision setup in the Supervision tab
                      </span>
                    )}
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

                  {/* Supervision Level */}
                  {formData.allows_supervised && (
                    <div>
                      <label className="block text-sm font-medium text-[#091747] mb-2">
                        Supervision Level
                      </label>
                      <select
                        value={formData.supervision_level || 'sign_off_only'}
                        onChange={(e) => handleFieldChange('supervision_level', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20 focus:border-[#BF9C73]"
                      >
                        {SUPERVISION_LEVELS.map(level => (
                          <option key={level.value} value={level.value}>
                            {level.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Contracts Tab */}
            {activeTab === 'contracts' && (
              <div className="p-6">
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
                        contract.isNew ? 'border-green-300 bg-green-50' : 'border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        {contract.isNew && (
                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                            New
                          </span>
                        )}
                        <button
                          onClick={() => removeContract(index)}
                          className="ml-auto text-red-600 hover:text-red-800 p-1"
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
            )}

            {/* Supervision Tab */}
            {activeTab === 'supervision' && (
              <div className="p-6">
                <SupervisionSetupPanel
                  payerId={payer.id || 'new'}
                  effectiveDate={formData.effective_date}
                  allowsSupervised={formData.allows_supervised}
                  supervisionLevel={formData.supervision_level}
                  onSupervisionChange={setSupervisionMappings}
                  existingSupervision={supervisionMappings}
                />
              </div>
            )}

            {/* Service Instances Tab */}
            {activeTab === 'service_instances' && (
              <div className="p-6">
                <ServiceInstancesPanel
                  payerId={payer.id || 'new'}
                  onInstancesChange={setServiceInstances}
                  existingInstances={serviceInstances}
                />
              </div>
            )}

            {/* PracticeQ Tab */}
            {activeTab === 'practiceq' && (
              <div className="p-6">
                <PracticeQMappingForm
                  payerId={payer.id || 'new'}
                  payerName={formData.name}
                  existingMapping={practiceQMapping}
                  onMappingChange={setPracticeQMapping}
                  optional={true}
                />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
            </div>
            <div className="flex items-center space-x-3">
              {/* Next Button - shown on all tabs except last */}
              {activeTab !== 'practiceq' && (
                <button
                  onClick={() => {
                    const tabs: TabType[] = ['basic', 'contracts', 'supervision', 'service_instances', 'practiceq']
                    const currentIndex = tabs.indexOf(activeTab)
                    if (currentIndex < tabs.length - 1) {
                      setActiveTab(tabs[currentIndex + 1])
                    }
                  }}
                  className="px-4 py-2 text-[#BF9C73] border border-[#BF9C73] rounded-lg hover:bg-[#BF9C73]/10 transition-colors"
                >
                  Next →
                </button>
              )}
              {/* Apply Contract Button - shown on all tabs */}
              <button
                onClick={handleSave}
                disabled={loading}
                className="px-4 py-2 bg-[#BF9C73] hover:bg-[#BF9C73]/90 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center"
              >
                <Save className="h-4 w-4 mr-2" />
                {loading ? 'Applying...' : 'Apply Contract'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmation && (
        <ConfirmationModal
          isOpen={showConfirmation}
          onClose={() => setShowConfirmation(false)}
          onConfirm={handleConfirmSave}
          title={`Apply Payer Contract`}
          description={`You are about to apply a comprehensive contract configuration for ${formData.name}. This will update the payer, create/update ${contracts.length} provider contracts, ${supervisionMappings.length} supervision relationships, and ${serviceInstances.length} service instances.`}
          changes={[
            {
              field: 'Payer Status',
              oldValue: payer.status_code || 'Not set',
              newValue: formData.status_code || 'Not set'
            },
            {
              field: 'Provider Contracts',
              oldValue: `${initialContractCount} contract(s)`,
              newValue: `${contracts.length} contract(s)`
            },
            {
              field: 'Supervision Relationships',
              oldValue: `${initialSupervisionCount} relationship(s)`,
              newValue: `${supervisionMappings.length} relationship(s)`
            },
            {
              field: 'Service Instances',
              oldValue: `${initialServiceInstanceCount} instance(s)`,
              newValue: `${serviceInstances.length} instance(s)`
            },
            {
              field: 'PracticeQ Mapping',
              oldValue: '—',
              newValue: practiceQMapping ? 'Configured' : 'Not configured'
            }
          ]}
          warnings={
            validationResults?.hasWarnings
              ? ['There are validation warnings. You can proceed but review them first.']
              : []
          }
        />
      )}
    </>
  )
}