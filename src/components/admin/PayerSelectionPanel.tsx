'use client'

import { useState, useEffect } from 'react'
import { Building2, Users, UserCheck, Activity, CheckCircle2, AlertTriangle, Clock, Loader2 } from 'lucide-react'

interface PayerSelectionPanelProps {
  providerId: string
  onPayersSelected?: (payerIds: string[]) => void
  showGenerateButton?: boolean
}

interface PayerStat {
  id: string
  name: string
  payer_type: string
  state: string

  // Credentialing requirements
  requires_individual_contract: boolean
  allows_supervised: boolean
  requires_attending: boolean
  supervision_level: string | null

  // Statistics
  total_contracts: number
  bookable_providers: number
  current_census: number

  // Workflow info
  workflow_type: string | null
  typical_approval_days: number | null

  // Provider-specific
  already_credentialing: boolean
  already_contracted: boolean
  is_recommended: boolean
}

export default function PayerSelectionPanel({
  providerId,
  onPayersSelected,
  showGenerateButton = true
}: PayerSelectionPanelProps) {
  const [payers, setPayers] = useState<PayerStat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPayerIds, setSelectedPayerIds] = useState<Set<string>>(new Set())
  const [filterText, setFilterText] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'contracts' | 'census' | 'bookable'>('name')
  const [sortDesc, setSortDesc] = useState(false)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    loadPayerStats()
  }, [providerId])

  const loadPayerStats = async () => {
    try {
      setLoading(true)
      setError(null)

      const url = providerId
        ? `/api/admin/payers/selection-stats?providerId=${providerId}`
        : '/api/admin/payers/selection-stats'

      const res = await fetch(url)
      if (!res.ok) {
        throw new Error('Failed to fetch payer statistics')
      }

      const data = await res.json()
      setPayers(data.data || [])
    } catch (err: any) {
      console.error('Error loading payer stats:', err)
      setError(err.message || 'Failed to load payer statistics')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectAll = () => {
    if (selectedPayerIds.size === filteredPayers.length) {
      setSelectedPayerIds(new Set())
    } else {
      const allIds = filteredPayers
        .filter(p => !p.already_contracted)
        .map(p => p.id)
      setSelectedPayerIds(new Set(allIds))
    }
  }

  const handleTogglePayer = (payerId: string) => {
    const newSelection = new Set(selectedPayerIds)
    if (newSelection.has(payerId)) {
      newSelection.delete(payerId)
    } else {
      newSelection.add(payerId)
    }
    setSelectedPayerIds(newSelection)
  }

  const handleGenerateTasks = async () => {
    if (selectedPayerIds.size === 0) {
      alert('Please select at least one payer')
      return
    }

    try {
      setGenerating(true)
      setError(null)

      const res = await fetch(`/api/admin/providers/${providerId}/credential-payers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payerIds: Array.from(selectedPayerIds) })
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to generate credentialing tasks')
      }

      const result = await res.json()
      console.log('✅ Credentialing tasks created:', result.data)

      // Notify parent component
      if (onPayersSelected) {
        onPayersSelected(Array.from(selectedPayerIds))
      }

      // Clear selection
      setSelectedPayerIds(new Set())

      // Reload data to refresh flags
      await loadPayerStats()

      alert(`Successfully created ${result.data.tasksCreated} tasks for ${result.data.applicationsCreated} payers!`)
    } catch (err: any) {
      console.error('Error generating tasks:', err)
      setError(err.message || 'Failed to generate credentialing tasks')
    } finally {
      setGenerating(false)
    }
  }

  // Filter payers
  const filteredPayers = payers.filter(payer => {
    if (!filterText) return true
    const searchText = filterText.toLowerCase()
    return (
      payer.name.toLowerCase().includes(searchText) ||
      payer.payer_type.toLowerCase().includes(searchText) ||
      payer.state.toLowerCase().includes(searchText)
    )
  })

  // Sort payers
  const sortedPayers = [...filteredPayers].sort((a, b) => {
    let comparison = 0

    switch (sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name)
        break
      case 'contracts':
        comparison = a.total_contracts - b.total_contracts
        break
      case 'census':
        comparison = a.current_census - b.current_census
        break
      case 'bookable':
        comparison = a.bookable_providers - b.bookable_providers
        break
    }

    return sortDesc ? -comparison : comparison
  })

  const getWorkflowBadge = (workflowType: string | null) => {
    if (!workflowType) return null

    const badges = {
      instant_network: { label: 'Instant', color: 'bg-green-100 text-green-700 border-green-300' },
      excel_submission: { label: 'Excel', color: 'bg-blue-100 text-blue-700 border-blue-300' },
      online_portal: { label: 'Portal', color: 'bg-purple-100 text-purple-700 border-purple-300' }
    }

    const badge = badges[workflowType as keyof typeof badges]
    if (!badge) return null

    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded border ${badge.color}`}>
        {badge.label}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
        <span className="ml-2 text-gray-600">Loading payer statistics...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Select Payers to Credential</h3>
          <p className="text-sm text-gray-600">
            Choose which payers to prioritize for credentialing this provider
          </p>
        </div>

        {showGenerateButton && (
          <button
            onClick={handleGenerateTasks}
            disabled={selectedPayerIds.size === 0 || generating}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Generate Tasks ({selectedPayerIds.size})
              </>
            )}
          </button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Error</p>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Filters and controls */}
      <div className="flex items-center gap-4">
        <input
          type="text"
          placeholder="Search payers..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="name">Sort by Name</option>
          <option value="contracts">Sort by Contracts</option>
          <option value="bookable">Sort by Bookable</option>
          <option value="census">Sort by Census</option>
        </select>

        <button
          onClick={() => setSortDesc(!sortDesc)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
        >
          {sortDesc ? '↓' : '↑'}
        </button>

        <button
          onClick={handleSelectAll}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
        >
          {selectedPayerIds.size === filteredPayers.length ? 'Deselect All' : 'Select All'}
        </button>
      </div>

      {/* Payer table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left w-12">
                  <input
                    type="checkbox"
                    checked={selectedPayerIds.size > 0 && selectedPayerIds.size === filteredPayers.filter(p => !p.already_contracted).length}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">Payer</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">Type</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-900">Requirements</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-900">Workflow</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-900">
                  <div className="flex items-center justify-center gap-1">
                    <Building2 className="w-4 h-4" />
                    Contracts
                  </div>
                </th>
                <th className="px-4 py-3 text-center font-semibold text-gray-900">
                  <div className="flex items-center justify-center gap-1">
                    <UserCheck className="w-4 h-4" />
                    Bookable
                  </div>
                </th>
                <th className="px-4 py-3 text-center font-semibold text-gray-900">
                  <div className="flex items-center justify-center gap-1">
                    <Users className="w-4 h-4" />
                    Census
                  </div>
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedPayers.map((payer) => {
                const isSelected = selectedPayerIds.has(payer.id)
                const isDisabled = payer.already_contracted

                return (
                  <tr
                    key={payer.id}
                    className={`hover:bg-gray-50 ${isDisabled ? 'opacity-50' : ''} ${payer.is_recommended ? 'bg-yellow-50' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isDisabled}
                        onChange={() => handleTogglePayer(payer.id)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:cursor-not-allowed"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900">{payer.name}</span>
                        {payer.is_recommended && (
                          <span className="text-xs text-yellow-700 font-medium">⭐ Recommended for Attendings</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      <div className="flex flex-col">
                        <span>{payer.payer_type}</span>
                        <span className="text-xs text-gray-500">{payer.state}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1 items-center">
                        {payer.requires_individual_contract && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 border border-orange-300 rounded">
                            Individual Contract
                          </span>
                        )}
                        {payer.requires_attending && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 border border-blue-300 rounded">
                            Attending Required
                          </span>
                        )}
                        {payer.allows_supervised && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 border border-green-300 rounded">
                            Allows Supervised
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {getWorkflowBadge(payer.workflow_type)}
                      {payer.typical_approval_days && (
                        <div className="text-xs text-gray-500 mt-1">
                          ~{payer.typical_approval_days} days
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center font-medium text-gray-900">
                      {payer.total_contracts}
                    </td>
                    <td className="px-4 py-3 text-center font-medium text-gray-900">
                      {payer.bookable_providers}
                    </td>
                    <td className="px-4 py-3 text-center font-medium text-gray-900">
                      {payer.current_census}
                    </td>
                    <td className="px-4 py-3">
                      {payer.already_contracted ? (
                        <span className="flex items-center gap-1 text-green-700">
                          <CheckCircle2 className="w-4 h-4" />
                          Contracted
                        </span>
                      ) : payer.already_credentialing ? (
                        <span className="flex items-center gap-1 text-blue-700">
                          <Clock className="w-4 h-4" />
                          In Progress
                        </span>
                      ) : (
                        <span className="text-gray-500">Not Started</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-gray-50 rounded-lg p-4 flex items-center justify-between text-sm">
        <div className="flex gap-6">
          <div>
            <span className="text-gray-600">Total Payers:</span>
            <span className="ml-2 font-semibold text-gray-900">{filteredPayers.length}</span>
          </div>
          <div>
            <span className="text-gray-600">Selected:</span>
            <span className="ml-2 font-semibold text-indigo-600">{selectedPayerIds.size}</span>
          </div>
          <div>
            <span className="text-gray-600">Already Contracted:</span>
            <span className="ml-2 font-semibold text-green-700">
              {filteredPayers.filter(p => p.already_contracted).length}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
