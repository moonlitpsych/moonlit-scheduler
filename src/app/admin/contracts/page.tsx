'use client'

import { useState, useEffect } from 'react'
import {
  Activity,
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  Pause,
  Calendar,
  User,
  Building2,
  Zap
} from 'lucide-react'
import { ProviderPayerContract } from '@/types/admin-operations'

interface ProviderOption {
  id: string
  name: string
  email: string
  is_active: boolean
}

interface PayerOption {
  id: string
  name: string
  state: string
  payer_type: string
}

interface ContractWithDetails extends ProviderPayerContract {
  supervision_details?: {
    supervision_level: string
    supervising_provider_name: string
  }
  needs_roster_rebuild?: boolean
}

const CONTRACT_TYPES = [
  { value: 'direct', label: 'Direct Contract', description: 'Provider has direct contract with payer' },
  { value: 'supervised', label: 'Supervised Contract', description: 'Provider bills under supervising physician' }
] as const

const CONTRACT_STATUSES = [
  { value: 'pending', label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'active', label: 'Active', color: 'bg-green-100 text-green-800' },
  { value: 'terminated', label: 'Terminated', color: 'bg-red-100 text-red-800' },
  { value: 'suspended', label: 'Suspended', color: 'bg-gray-100 text-gray-800' }
] as const

export default function ContractsPage() {
  const [contracts, setContracts] = useState<ContractWithDetails[]>([])
  const [providers, setProviders] = useState<ProviderOption[]>([])
  const [payers, setPayers] = useState<PayerOption[]>([])
  const [loading, setLoading] = useState(true)
  const [rebuilding, setRebuilding] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingContract, setEditingContract] = useState<ContractWithDetails | null>(null)
  const [lastRebuildTime, setLastRebuildTime] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    provider_id: '',
    payer_id: '',
    contract_type: 'direct' as 'direct' | 'supervised',
    effective_date: new Date().toISOString().split('T')[0],
    termination_date: '',
    status: 'pending' as 'pending' | 'active' | 'terminated' | 'suspended',
    notes: ''
  })

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [contractsResponse, providersResponse, payersResponse] = await Promise.all([
          fetch('/api/admin/contracts'),
          fetch('/api/admin/providers-list'),
          fetch('/api/admin/payers-list')
        ])

        if (contractsResponse.ok) {
          const contractsResult = await contractsResponse.json()
          setContracts(contractsResult.data || [])
          setLastRebuildTime(contractsResult.meta?.last_rebuild || null)
        }

        if (providersResponse.ok) {
          const providersResult = await providersResponse.json()
          const providersList = (providersResult.data || []).map((p: any) => ({
            id: p.id,
            name: `${p.first_name} ${p.last_name}`,
            email: p.email,
            is_active: p.is_active
          }))
          setProviders(providersList)
        }

        if (payersResponse.ok) {
          const payersResult = await payersResponse.json()
          setPayers(payersResult.data || [])
        }
      } catch (error) {
        console.error('Error fetching contracts data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const url = editingContract 
        ? `/api/admin/contracts/${editingContract.id}`
        : '/api/admin/contracts'
      
      const method = editingContract ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        // Refresh data
        window.location.reload()
      } else {
        const error = await response.json()
        alert(`Error: ${error.message || 'Failed to save contract'}`)
      }
    } catch (error) {
      console.error('Error saving contract:', error)
      alert('Error saving contract')
    }
  }

  const handleEdit = (contract: ContractWithDetails) => {
    setEditingContract(contract)
    setFormData({
      provider_id: contract.provider_id,
      payer_id: contract.payer_id,
      contract_type: contract.contract_type,
      effective_date: contract.effective_date,
      termination_date: contract.termination_date || '',
      status: contract.status,
      notes: contract.notes || ''
    })
    setShowCreateModal(true)
  }

  const handleDelete = async (contractId: string) => {
    if (!confirm('Are you sure you want to delete this contract? This will trigger a roster rebuild.')) return

    try {
      const response = await fetch(`/api/admin/contracts/${contractId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        window.location.reload()
      } else {
        alert('Error deleting contract')
      }
    } catch (error) {
      console.error('Error deleting contract:', error)
      alert('Error deleting contract')
    }
  }

  const handleRosterRebuild = async () => {
    setRebuilding(true)
    try {
      const response = await fetch('/api/admin/rebuild-roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger: 'manual' })
      })

      if (response.ok) {
        const result = await response.json()
        alert(`Roster rebuild completed successfully!\n\nEntries processed: ${result.data.entries_processed}\nEntries added: ${result.data.entries_added}\nEntries removed: ${result.data.entries_removed}\nExecution time: ${result.data.execution_time_ms}ms`)
        
        // Refresh contracts to update rebuild status
        window.location.reload()
      } else {
        const error = await response.json()
        alert(`Roster rebuild failed: ${error.message || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error rebuilding roster:', error)
      alert('Error rebuilding roster')
    } finally {
      setRebuilding(false)
    }
  }

  const resetForm = () => {
    setFormData({
      provider_id: '',
      payer_id: '',
      contract_type: 'direct',
      effective_date: new Date().toISOString().split('T')[0],
      termination_date: '',
      status: 'pending',
      notes: ''
    })
    setEditingContract(null)
    setShowCreateModal(false)
  }

  const filteredContracts = contracts.filter(contract => {
    const matchesSearch = 
      contract.provider_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contract.payer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (contract.notes && contract.notes.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesStatus = !statusFilter || contract.status === statusFilter
    const matchesType = !typeFilter || contract.contract_type === typeFilter
    
    return matchesSearch && matchesStatus && matchesType
  })

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="h-4 w-4" />
      case 'pending': return <Clock className="h-4 w-4" />
      case 'terminated': return <XCircle className="h-4 w-4" />
      case 'suspended': return <Pause className="h-4 w-4" />
      default: return <AlertTriangle className="h-4 w-4" />
    }
  }

  const getStatusConfig = (status: string) => {
    return CONTRACT_STATUSES.find(s => s.value === status) || CONTRACT_STATUSES[0]
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#091747] font-['Newsreader'] mb-2">
          Contract Tracker
        </h1>
        <p className="text-[#091747]/70">
          Manage provider↔payer network contracts and roster rebuilds
        </p>
        {lastRebuildTime && (
          <p className="text-sm text-gray-500 mt-1">
            Last roster rebuild: {new Date(lastRebuildTime).toLocaleString()}
          </p>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm p-6 border border-stone-200">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Activity className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Contracts</p>
              <p className="text-2xl font-bold text-[#091747]">{contracts.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-6 border border-stone-200">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Active</p>
              <p className="text-2xl font-bold text-[#091747]">
                {contracts.filter(c => c.status === 'active').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-stone-200">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-[#091747]">
                {contracts.filter(c => c.status === 'pending').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-stone-200">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-purple-100 rounded-lg">
              <User className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Supervised</p>
              <p className="text-2xl font-bold text-[#091747]">
                {contracts.filter(c => c.contract_type === 'supervised').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-stone-200">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-[#BF9C73]/20 rounded-lg">
              <Zap className="h-6 w-6 text-[#BF9C73]" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Need Rebuild</p>
              <p className="text-2xl font-bold text-[#091747]">
                {contracts.filter(c => c.requires_roster_rebuild).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-6 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search contracts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent w-full sm:w-64"
              />
            </div>

            {/* Filters */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-stone-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent"
            >
              <option value="">All Status</option>
              {CONTRACT_STATUSES.map(status => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="border border-stone-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent"
            >
              <option value="">All Types</option>
              <option value="direct">Direct</option>
              <option value="supervised">Supervised</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-3">
            <button
              onClick={handleRosterRebuild}
              disabled={rebuilding}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${rebuilding ? 'animate-spin' : ''}`} />
              <span>{rebuilding ? 'Rebuilding...' : 'Rebuild Roster'}</span>
            </button>

            <button
              onClick={() => {
                resetForm()
                setShowCreateModal(true)
              }}
              className="bg-[#BF9C73] hover:bg-[#BF9C73]/90 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Add Contract</span>
            </button>
          </div>
        </div>
      </div>

      {/* Contracts Table */}
      <div className="bg-white rounded-lg shadow-sm border border-stone-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-stone-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Provider
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payer
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contract Type
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Effective Period
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Supervision
                </th>
                <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-stone-200">
              {filteredContracts.map((contract) => {
                const statusConfig = getStatusConfig(contract.status)
                return (
                  <tr key={contract.id} className="hover:bg-stone-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-blue-100 rounded-full">
                          <User className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-[#091747]">
                            {contract.provider_name || 'Unknown Provider'}
                          </div>
                          {contract.requires_roster_rebuild && (
                            <div className="flex items-center space-x-1 text-xs text-orange-600">
                              <Zap className="h-3 w-3" />
                              <span>Rebuild needed</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-green-100 rounded-full">
                          <Building2 className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-[#091747]">
                            {contract.payer_name || 'Unknown Payer'}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        contract.contract_type === 'direct' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {contract.contract_type === 'direct' ? 'Direct' : 'Supervised'}
                      </span>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <div className={statusConfig.color.replace('bg-', 'text-').replace('text-', 'text-').split(' ')[0]}>
                          {getStatusIcon(contract.status)}
                        </div>
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
                          {statusConfig.label}
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div>
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-3 w-3" />
                          <span>{new Date(contract.effective_date).toLocaleDateString()}</span>
                        </div>
                        {contract.termination_date && (
                          <div className="text-xs text-gray-400 mt-1">
                            Until: {new Date(contract.termination_date).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {contract.supervision_details ? (
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {contract.supervision_details.supervising_provider_name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {contract.supervision_details.supervision_level.replace('_', ' ')}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">N/A</span>
                      )}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleEdit(contract)}
                          className="text-[#BF9C73] hover:text-[#BF9C73]/80"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(contract.id)}
                          className="text-red-600 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {filteredContracts.length === 0 && (
          <div className="p-12 text-center">
            <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-[#091747] mb-2">
              No contracts found
            </h3>
            <p className="text-gray-500 mb-6">
              Create your first provider-payer contract to start managing network relationships.
            </p>
            <button
              onClick={() => {
                resetForm()
                setShowCreateModal(true)
              }}
              className="bg-[#BF9C73] hover:bg-[#BF9C73]/90 text-white px-6 py-2 rounded-lg transition-colors"
            >
              Add First Contract
            </button>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-[#091747]">
                {editingContract ? 'Edit' : 'Create'} Provider Contract
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Configure a provider-payer network contract relationship
              </p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Provider and Payer Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Provider *
                  </label>
                  <select
                    value={formData.provider_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, provider_id: e.target.value }))}
                    required
                    disabled={!!editingContract}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent disabled:bg-gray-50"
                  >
                    <option value="">Select a provider...</option>
                    {providers.map(provider => (
                      <option key={provider.id} value={provider.id}>
                        {provider.name} ({provider.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payer *
                  </label>
                  <select
                    value={formData.payer_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, payer_id: e.target.value }))}
                    required
                    disabled={!!editingContract}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent disabled:bg-gray-50"
                  >
                    <option value="">Select a payer...</option>
                    {payers.map(payer => (
                      <option key={payer.id} value={payer.id}>
                        {payer.name} ({payer.state})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Contract Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Contract Type *
                </label>
                <div className="space-y-2">
                  {CONTRACT_TYPES.map(type => (
                    <div key={type.value} className="flex items-center space-x-3">
                      <input
                        type="radio"
                        id={type.value}
                        value={type.value}
                        checked={formData.contract_type === type.value}
                        onChange={(e) => setFormData(prev => ({ ...prev, contract_type: e.target.value as any }))}
                        className="h-4 w-4 text-[#BF9C73] focus:ring-[#BF9C73] border-gray-300"
                      />
                      <div className="flex-1">
                        <label htmlFor={type.value} className="text-sm font-medium text-gray-700">
                          {type.label}
                        </label>
                        <p className="text-xs text-gray-500">{type.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status *
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent"
                >
                  {CONTRACT_STATUSES.map(status => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Effective Date *
                  </label>
                  <input
                    type="date"
                    value={formData.effective_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, effective_date: e.target.value }))}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Termination Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={formData.termination_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, termination_date: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Optional notes about this contract..."
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#BF9C73] hover:bg-[#BF9C73]/90 text-white rounded-lg transition-colors"
                >
                  {editingContract ? 'Update' : 'Create'} Contract
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}