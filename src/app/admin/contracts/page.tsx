'use client'

import { useState, useEffect } from 'react'
import {
  Activity,
  Plus,
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  Pause,
  Calendar,
  User,
  Building2,
  Zap,
  Info
} from 'lucide-react'
import { ProviderPayerContract } from '@/types/admin-operations'
import PayerEditorModalEnhanced from '@/components/admin/PayerEditorModalEnhanced'

interface PayerOption {
  id: string
  name: string
  state: string
  payer_type: string
  status_code: string | null
  effective_date: string | null
  requires_attending: boolean
  allows_supervised: boolean
  supervision_level: string | null
  requires_individual_contract: boolean
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
  { value: 'in_network', label: 'Active', color: 'bg-green-100 text-green-800' },
  { value: 'pending', label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'inactive', label: 'Inactive', color: 'bg-gray-100 text-gray-800' }
] as const

export default function ContractsPage() {
  const [contracts, setContracts] = useState<ContractWithDetails[]>([])
  const [payers, setPayers] = useState<PayerOption[]>([])
  const [loading, setLoading] = useState(true)
  const [rebuilding, setRebuilding] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showPayerSelector, setShowPayerSelector] = useState(false)
  const [showPayerEditor, setShowPayerEditor] = useState(false)
  const [selectedPayer, setSelectedPayer] = useState<PayerOption | null>(null)
  const [lastRebuildTime, setLastRebuildTime] = useState<string | null>(null)

  // Fetch data
  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [contractsResponse, payersResponse] = await Promise.all([
        fetch('/api/admin/contracts'),
        fetch('/api/admin/payers')
      ])

      if (contractsResponse.ok) {
        const contractsResult = await contractsResponse.json()
        setContracts(contractsResult.data || [])
        setLastRebuildTime(contractsResult.meta?.last_rebuild || null)
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
        fetchData()
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

  const handleAddContract = () => {
    setShowPayerSelector(true)
  }

  const handlePayerSelected = (payer: PayerOption) => {
    setSelectedPayer(payer)
    setShowPayerSelector(false)
    setShowPayerEditor(true)
  }

  const handlePayerEditorClose = () => {
    setShowPayerEditor(false)
    setSelectedPayer(null)
  }

  const handleContractUpdate = () => {
    console.log('✅ Contract updated successfully')
    fetchData() // Refresh the contracts list
    setShowPayerEditor(false)
    setSelectedPayer(null)
  }

  const filteredContracts = contracts.filter(contract => {
    const matchesSearch =
      contract.provider_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contract.payer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (contract.notes && contract.notes.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesStatus = !statusFilter || contract.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'in_network': return <CheckCircle className="h-4 w-4" />
      case 'pending': return <Clock className="h-4 w-4" />
      case 'inactive': return <XCircle className="h-4 w-4" />
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
          Contract Management
        </h1>
        <p className="text-[#091747]/70">
          Manage provider-payer network contracts with comprehensive setup
        </p>
        {lastRebuildTime && (
          <p className="text-sm text-gray-500 mt-1">
            Last roster rebuild: {new Date(lastRebuildTime).toLocaleString()}
          </p>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start space-x-3">
          <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Comprehensive Contract Setup</p>
            <p>When you add a contract, you'll configure: provider relationships, supervision, service instances, EMR mappings, and validation—all in one workflow.</p>
          </div>
        </div>
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
                {contracts.filter(c => c.status === 'in_network').length}
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

            {/* Status Filter */}
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
              onClick={handleAddContract}
              className="bg-[#BF9C73] hover:bg-[#BF9C73]/90 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Set Up Payer Contract</span>
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
              Set up your first payer contract with comprehensive configuration.
            </p>
            <button
              onClick={handleAddContract}
              className="bg-[#BF9C73] hover:bg-[#BF9C73]/90 text-white px-6 py-2 rounded-lg transition-colors"
            >
              Setup First Contract
            </button>
          </div>
        )}
      </div>

      {/* Payer Selector Modal */}
      {showPayerSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-stone-200">
              <h2 className="text-xl font-semibold text-[#091747] font-['Newsreader']">
                Select Payer
              </h2>
              <p className="text-sm text-[#091747]/60 mt-1">
                Choose the payer to configure contract relationships
              </p>
            </div>

            <div className="p-6">
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {payers.map(payer => (
                  <button
                    key={payer.id}
                    onClick={() => handlePayerSelected(payer)}
                    className="w-full text-left p-4 border-2 border-stone-200 rounded-lg hover:border-[#BF9C73] hover:bg-[#BF9C73]/5 transition-all"
                  >
                    <div className="font-medium text-[#091747]">{payer.name}</div>
                    <div className="text-sm text-gray-600 mt-1">
                      {payer.payer_type} • {payer.state}
                      {payer.status_code && ` • ${payer.status_code}`}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6 border-t border-stone-200">
              <button
                onClick={() => setShowPayerSelector(false)}
                className="w-full px-4 py-2 border border-stone-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payer Editor Modal */}
      {showPayerEditor && selectedPayer && (
        <PayerEditorModalEnhanced
          payer={selectedPayer}
          isOpen={showPayerEditor}
          onClose={handlePayerEditorClose}
          onUpdate={handleContractUpdate}
        />
      )}
    </div>
  )
}
