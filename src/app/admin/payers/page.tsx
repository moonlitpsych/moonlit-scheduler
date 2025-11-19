'use client'

import { useState, useEffect } from 'react'
import { Search, Plus, Edit, Eye, FileText, Users, Calendar, AlertCircle } from 'lucide-react'
import PayerDetailModal from '@/components/admin/PayerDetailModal'
import PayerEditorModalEnhanced from '@/components/admin/PayerEditorModalEnhanced'
import AddOONPayerModal from '@/components/admin/AddOONPayerModal'

interface Payer {
  id: string
  name: string
  payer_type: string
  state: string
  status_code: string | null
  effective_date: string | null
  requires_attending: boolean
  allows_supervised: boolean
  supervision_level: string | null
  requires_individual_contract: boolean
  created_at: string
  updated_at: string
  contract_count?: number
  supervision_count?: number
}

export default function PayersPage() {
  const [payers, setPayers] = useState<Payer[]>([])
  const [filteredPayers, setFilteredPayers] = useState<Payer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPayer, setSelectedPayer] = useState<Payer | null>(null)
  const [editingPayer, setEditingPayer] = useState<Payer | null>(null)
  const [showOONModal, setShowOONModal] = useState(false)

  // Fetch payers data
  const fetchPayers = async () => {
    try {
      setLoading(true)
      console.log('🔍 Fetching payers data...')

      const response = await fetch('/api/admin/payers')
      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to fetch payers')
      }

      console.log(`✅ Found ${result.data?.length || 0} payers`)
      setPayers(result.data || [])
      setFilteredPayers(result.data || [])

    } catch (error: any) {
      console.error('❌ Error fetching payers:', error)
    } finally {
      setLoading(false)
    }
  }

  // Apply search filter
  useEffect(() => {
    let filtered = payers

    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      filtered = filtered.filter(payer =>
        payer.name.toLowerCase().includes(search) ||
        payer.payer_type.toLowerCase().includes(search) ||
        payer.state?.toLowerCase().includes(search) ||
        payer.status_code?.toLowerCase().includes(search)
      )
    }

    setFilteredPayers(filtered)
  }, [searchTerm, payers])

  // Load data on mount
  useEffect(() => {
    fetchPayers()
  }, [])

  const handlePayerClick = (payer: Payer) => {
    setSelectedPayer(payer)
  }

  const handleEditPayer = (payer: Payer) => {
    setEditingPayer(payer)
  }

  const handlePayerUpdate = () => {
    fetchPayers() // Refresh data after updates
  }

  const getStatusBadge = (statusCode: string | null) => {
    if (!statusCode) return null

    const colorMap: Record<string, string> = {
      'approved': 'bg-green-100 text-green-800',
      'pending': 'bg-yellow-100 text-yellow-800',
      'rejected': 'bg-red-100 text-red-800',
      'suspended': 'bg-gray-100 text-gray-800'
    }

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colorMap[statusCode] || 'bg-gray-100 text-gray-800'}`}>
        {statusCode}
      </span>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#091747] font-['Newsreader'] mb-2">
          Payer Management
        </h1>
        <p className="text-[#091747]/70">
          Manage payer information, contracts, and supervision relationships. Click any payer to view details or edit.
        </p>
      </div>

      {/* Controls */}
      <div className="mb-6 flex items-center justify-between">
        {/* Search */}
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#091747]/40" />
            <input
              type="text"
              placeholder="Search payers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20 focus:border-[#BF9C73]"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-3">
          {/* Add Out-of-Network Button */}
          <button
            onClick={() => setShowOONModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
          >
            <AlertCircle className="h-4 w-4" />
            <span>Add Out-of-Network</span>
          </button>

          {/* Create New Payer Button */}
          <button
            onClick={() => setEditingPayer({} as Payer)} // Empty object for new payer
            className="flex items-center space-x-2 px-4 py-2 bg-[#BF9C73] hover:bg-[#BF9C73]/90 text-white rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>New Payer</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border border-stone-200">
          <div className="text-2xl font-bold text-[#091747]">{filteredPayers.length}</div>
          <div className="text-sm text-[#091747]/60">Total Payers</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-stone-200">
          <div className="text-2xl font-bold text-[#091747]">
            {filteredPayers.filter(p => p.status_code === 'approved').length}
          </div>
          <div className="text-sm text-[#091747]/60">Approved</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-stone-200">
          <div className="text-2xl font-bold text-[#091747]">
            {filteredPayers.filter(p => p.requires_attending).length}
          </div>
          <div className="text-sm text-[#091747]/60">Requires Attending</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-stone-200">
          <div className="text-2xl font-bold text-[#091747]">
            {filteredPayers.filter(p => p.allows_supervised).length}
          </div>
          <div className="text-sm text-[#091747]/60">Allows Supervised</div>
        </div>
      </div>

      {/* Payers Table */}
      <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-stone-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#091747]/70 uppercase tracking-wider">
                  Payer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#091747]/70 uppercase tracking-wider">
                  Type & State
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#091747]/70 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#091747]/70 uppercase tracking-wider">
                  Effective Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#091747]/70 uppercase tracking-wider">
                  Requirements
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#091747]/70 uppercase tracking-wider">
                  Relationships
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#091747]/70 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-stone-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-[#091747]/60">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[#BF9C73] mr-3"></div>
                    Loading payers...
                  </td>
                </tr>
              ) : filteredPayers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-[#091747]/60">
                    {searchTerm ? 'No payers match your search.' : 'No payers found.'}
                  </td>
                </tr>
              ) : (
                filteredPayers.map((payer) => (
                  <tr
                    key={payer.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => handlePayerClick(payer)}
                  >
                    <td className="px-6 py-4">
                      <div className="font-medium text-[#091747]">{payer.name}</div>
                      <div className="text-sm text-[#091747]/60">{payer.id.slice(0, 8)}...</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-[#091747]">{payer.payer_type}</div>
                      <div className="text-sm text-[#091747]/60">{payer.state}</div>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(payer.status_code)}
                    </td>
                    <td className="px-6 py-4 text-sm text-[#091747]">
                      {payer.effective_date ? new Date(payer.effective_date).toLocaleDateString() : 'Not set'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col space-y-1">
                        <span className={`text-xs px-2 py-1 rounded ${payer.requires_attending ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-600'}`}>
                          {payer.requires_attending ? 'Attending Required' : 'No Attending Required'}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded ${payer.allows_supervised ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}`}>
                          {payer.allows_supervised ? 'Supervised Allowed' : 'No Supervision'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex space-x-4 text-sm text-[#091747]/60">
                        <div className="flex items-center">
                          <FileText className="h-4 w-4 mr-1" />
                          {payer.contract_count || 0}
                        </div>
                        <div className="flex items-center">
                          <Users className="h-4 w-4 mr-1" />
                          {payer.supervision_count || 0}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handlePayerClick(payer)
                          }}
                          className="p-1 text-[#091747]/60 hover:text-[#BF9C73] transition-colors"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEditPayer(payer)
                          }}
                          className="p-1 text-[#091747]/60 hover:text-[#BF9C73] transition-colors"
                          title="Edit Payer"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payer Detail Modal */}
      {selectedPayer && (
        <PayerDetailModal
          payer={selectedPayer}
          isOpen={!!selectedPayer}
          onClose={() => setSelectedPayer(null)}
          onEdit={() => {
            setEditingPayer(selectedPayer)
            setSelectedPayer(null)
          }}
        />
      )}

      {/* Payer Editor Modal */}
      {editingPayer && (
        <PayerEditorModalEnhanced
          payer={editingPayer}
          isOpen={!!editingPayer}
          onClose={() => setEditingPayer(null)}
          onUpdate={handlePayerUpdate}
        />
      )}

      {/* Add Out-of-Network Payer Modal */}
      <AddOONPayerModal
        isOpen={showOONModal}
        onClose={() => setShowOONModal(false)}
        onSuccess={handlePayerUpdate}
      />
    </div>
  )
}