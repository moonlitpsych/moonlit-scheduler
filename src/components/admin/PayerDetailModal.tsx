'use client'

import { useState, useEffect } from 'react'
import { X, Edit, FileText, Users, Calendar, Shield, Building, MapPin } from 'lucide-react'

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

interface Contract {
  id: string
  provider_id: string
  provider_name: string
  effective_date: string | null
  expiration_date: string | null
  status: string
  billing_provider_id: string | null
}

interface SupervisionRelationship {
  id: string
  supervising_provider_id: string
  supervised_provider_id: string
  supervising_provider_name: string
  supervised_provider_name: string
  effective_date: string | null
  expiration_date: string | null
}

interface PayerDetailModalProps {
  payer: Payer
  isOpen: boolean
  onClose: () => void
  onEdit: () => void
}

export default function PayerDetailModal({
  payer,
  isOpen,
  onClose,
  onEdit
}: PayerDetailModalProps) {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [supervisionRelationships, setSupervisionRelationships] = useState<SupervisionRelationship[]>([])
  const [loading, setLoading] = useState(false)

  // Fetch detailed data for this payer
  const fetchPayerDetails = async () => {
    if (!payer.id) return

    try {
      setLoading(true)
      console.log('🔍 Fetching details for payer:', payer.id)

      // Fetch contracts
      const contractsResponse = await fetch(`/api/admin/payers/${payer.id}/contracts`, {
        credentials: 'omit'
      })
      const contractsResult = await contractsResponse.json()

      if (contractsResponse.ok && contractsResult.success) {
        setContracts(contractsResult.data || [])
      }

      // Fetch supervision relationships
      const supervisionResponse = await fetch(`/api/admin/payers/${payer.id}/supervision`, {
        credentials: 'omit'
      })
      const supervisionResult = await supervisionResponse.json()

      if (supervisionResponse.ok && supervisionResult.success) {
        setSupervisionRelationships(supervisionResult.data || [])
      }

    } catch (error) {
      console.error('❌ Error fetching payer details:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen && payer.id) {
      fetchPayerDetails()
    }
  }, [isOpen, payer.id])

  if (!isOpen) return null

  const getStatusBadge = (statusCode: string | null) => {
    if (!statusCode) return <span className="text-[#091747]/60">No status</span>

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
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-[#BF9C73] rounded-lg">
              <Building className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#091747] font-['Newsreader']">
                {payer.name}
              </h2>
              <p className="text-sm text-[#091747]/60">
                {payer.payer_type} • {payer.state}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={onEdit}
              className="flex items-center space-x-2 px-3 py-2 bg-[#BF9C73] hover:bg-[#BF9C73]/90 text-white rounded-lg transition-colors"
            >
              <Edit className="h-4 w-4" />
              <span>Edit</span>
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-2"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[70vh]">
          {/* Payer Information */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-[#091747] mb-4">Payer Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#091747]/70">Status</label>
                  <div className="mt-1">
                    {getStatusBadge(payer.status_code)}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#091747]/70">Effective Date</label>
                  <div className="mt-1 text-sm text-[#091747]">
                    {payer.effective_date ? new Date(payer.effective_date).toLocaleDateString() : 'Not set'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#091747]/70">Requires Individual Contract</label>
                  <div className="mt-1">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      payer.requires_individual_contract
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {payer.requires_individual_contract ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#091747]/70">Requires Attending</label>
                  <div className="mt-1">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      payer.requires_attending
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {payer.requires_attending ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#091747]/70">Allows Supervised</label>
                  <div className="mt-1">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      payer.allows_supervised
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {payer.allows_supervised ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#091747]/70">Supervision Level</label>
                  <div className="mt-1 text-sm text-[#091747]">
                    {payer.supervision_level ? payer.supervision_level.replace('_', ' ') : 'Not set'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Provider Contracts */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-[#091747] mb-4 flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Provider Contracts ({contracts.length})
            </h3>

            {loading ? (
              <div className="text-center py-4">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[#BF9C73]"></div>
              </div>
            ) : contracts.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <FileText className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">No provider contracts found</p>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-[#091747]/70">Provider</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-[#091747]/70">Status</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-[#091747]/70">Effective Date</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-[#091747]/70">Expiration Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {contracts.map((contract) => (
                        <tr key={contract.id} className="hover:bg-white">
                          <td className="px-4 py-3 text-sm text-[#091747]">{contract.provider_name}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              contract.status === 'active'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              {contract.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-[#091747]">
                            {contract.effective_date ? new Date(contract.effective_date).toLocaleDateString() : 'Not set'}
                          </td>
                          <td className="px-4 py-3 text-sm text-[#091747]">
                            {contract.expiration_date ? new Date(contract.expiration_date).toLocaleDateString() : 'No expiration'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Supervision Relationships */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-[#091747] mb-4 flex items-center">
              <Users className="h-5 w-5 mr-2" />
              Supervision Relationships ({supervisionRelationships.length})
            </h3>

            {loading ? (
              <div className="text-center py-4">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[#BF9C73]"></div>
              </div>
            ) : supervisionRelationships.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <Users className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">No supervision relationships found</p>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-[#091747]/70">Supervising Provider</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-[#091747]/70">Supervised Provider</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-[#091747]/70">Effective Date</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-[#091747]/70">Expiration Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {supervisionRelationships.map((relationship) => (
                        <tr key={relationship.id} className="hover:bg-white">
                          <td className="px-4 py-3 text-sm text-[#091747]">{relationship.supervising_provider_name}</td>
                          <td className="px-4 py-3 text-sm text-[#091747]">{relationship.supervised_provider_name}</td>
                          <td className="px-4 py-3 text-sm text-[#091747]">
                            {relationship.effective_date ? new Date(relationship.effective_date).toLocaleDateString() : 'Not set'}
                          </td>
                          <td className="px-4 py-3 text-sm text-[#091747]">
                            {relationship.expiration_date ? new Date(relationship.expiration_date).toLocaleDateString() : 'No expiration'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Metadata */}
          <div>
            <h3 className="text-lg font-semibold text-[#091747] mb-4 flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              Metadata
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <label className="block font-medium text-[#091747]/70">Created</label>
                <div className="text-[#091747]">{new Date(payer.created_at).toLocaleString()}</div>
              </div>
              <div>
                <label className="block font-medium text-[#091747]/70">Last Updated</label>
                <div className="text-[#091747]">{new Date(payer.updated_at).toLocaleString()}</div>
              </div>
              <div>
                <label className="block font-medium text-[#091747]/70">Payer ID</label>
                <div className="text-[#091747]/60 font-mono text-xs">{payer.id}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}