'use client'

import { useState, useEffect } from 'react'
import { 
  Search, 
  Plus, 
  Filter, 
  MoreHorizontal, 
  Building2, 
  Mail, 
  Phone, 
  ExternalLink,
  Calendar,
  Users,
  TrendingUp,
  AlertCircle,
  CheckCircle
} from 'lucide-react'
import { Partner, Organization } from '@/types/partner-types'

interface PartnerWithOrg extends Partner {
  organization_name: string
  organization_type: string | null
  organization_status: string | null
  location: string | null
}

interface PaginationInfo {
  page: number
  per_page: number
  total: number
  total_pages: number
}

const STAGE_COLORS = {
  lead: 'bg-blue-100 text-blue-800',
  qualified: 'bg-yellow-100 text-yellow-800', 
  contract_sent: 'bg-orange-100 text-orange-800',
  live: 'bg-green-100 text-green-800',
  dormant: 'bg-gray-100 text-gray-800'
}

const STATUS_COLORS = {
  prospect: 'bg-blue-100 text-blue-800',
  active: 'bg-green-100 text-green-800',
  paused: 'bg-yellow-100 text-yellow-800',
  terminated: 'bg-red-100 text-red-800'
}

export default function AdminPartnersPage() {
  const [partners, setPartners] = useState<PartnerWithOrg[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    per_page: 25,
    total: 0,
    total_pages: 0
  })
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Fetch partners data
  const fetchPartners = async () => {
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        per_page: pagination.per_page.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter && { status: statusFilter }),
        ...(stageFilter && { stage: stageFilter })
      })

      const response = await fetch(`/api/admin/partners?${params}`)
      const result = await response.json()

      if (result.success) {
        setPartners(result.data)
        setPagination(result.pagination)
      } else {
        console.error('Failed to fetch partners:', result.error)
      }
    } catch (error) {
      console.error('Error fetching partners:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPartners()
  }, [pagination.page, searchTerm, statusFilter, stageFilter])

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString()
  }

  const getStageIcon = (stage: string) => {
    switch (stage) {
      case 'lead': return <Users className="h-4 w-4" />
      case 'qualified': return <CheckCircle className="h-4 w-4" />
      case 'contract_sent': return <Calendar className="h-4 w-4" />
      case 'live': return <TrendingUp className="h-4 w-4" />
      case 'dormant': return <AlertCircle className="h-4 w-4" />
      default: return <Building2 className="h-4 w-4" />
    }
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
          Partner CRM
        </h1>
        <p className="text-[#091747]/70">
          Manage treatment center partnerships and referral relationships
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm p-6 border border-stone-200">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Building2 className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Partners</p>
              <p className="text-2xl font-bold text-[#091747]">{pagination.total}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-6 border border-stone-200">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Live Partners</p>
              <p className="text-2xl font-bold text-[#091747]">
                {partners.filter(p => p.stage === 'live').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-stone-200">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Calendar className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">In Pipeline</p>
              <p className="text-2xl font-bold text-[#091747]">
                {partners.filter(p => ['qualified', 'contract_sent'].includes(p.stage)).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-stone-200">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-[#BF9C73]/20 rounded-lg">
              <Users className="h-6 w-6 text-[#BF9C73]" />
            </div>
            <div>
              <p className="text-sm text-gray-600">New Leads</p>
              <p className="text-2xl font-bold text-[#091747]">
                {partners.filter(p => p.stage === 'lead').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search partners..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent w-full"
            />
          </div>

          {/* Filters and Actions */}
          <div className="flex items-center space-x-4">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-stone-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent"
            >
              <option value="">All Status</option>
              <option value="prospect">Prospect</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="terminated">Terminated</option>
            </select>

            {/* Stage Filter */}
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="border border-stone-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent"
            >
              <option value="">All Stages</option>
              <option value="lead">Lead</option>
              <option value="qualified">Qualified</option>
              <option value="contract_sent">Contract Sent</option>
              <option value="live">Live</option>
              <option value="dormant">Dormant</option>
            </select>

            {/* Add Partner Button */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-[#BF9C73] hover:bg-[#BF9C73]/90 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Add Partner</span>
            </button>
          </div>
        </div>
      </div>

      {/* Partners Table */}
      <div className="bg-white rounded-lg shadow-sm border border-stone-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-stone-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Partner
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Organization
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stage
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Contact
                </th>
                <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-stone-200">
              {partners.map((partner) => (
                <tr key={partner.id} className="hover:bg-stone-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-[#091747]">
                        {partner.name}
                      </div>
                      {partner.contact_person && (
                        <div className="text-sm text-gray-500">
                          {partner.contact_person}
                          {partner.title && ` • ${partner.title}`}
                        </div>
                      )}
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-[#091747]">
                        {partner.organization_name}
                      </div>
                      {partner.location && (
                        <div className="text-sm text-gray-500">
                          {partner.location}
                        </div>
                      )}
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${STAGE_COLORS[partner.stage as keyof typeof STAGE_COLORS] || 'bg-gray-100 text-gray-800'}`}>
                      {getStageIcon(partner.stage)}
                      <span className="capitalize">{partner.stage.replace('_', ' ')}</span>
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[partner.status as keyof typeof STATUS_COLORS] || 'bg-gray-100 text-gray-800'}`}>
                      {partner.status}
                    </span>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col space-y-1">
                      {partner.contact_email && (
                        <a 
                          href={`mailto:${partner.contact_email}`}
                          className="text-sm text-[#BF9C73] hover:text-[#BF9C73]/80 flex items-center space-x-1"
                        >
                          <Mail className="h-3 w-3" />
                          <span className="truncate max-w-[150px]">{partner.contact_email}</span>
                        </a>
                      )}
                      {partner.contact_phone && (
                        <a 
                          href={`tel:${partner.contact_phone}`}
                          className="text-sm text-[#BF9C73] hover:text-[#BF9C73]/80 flex items-center space-x-1"
                        >
                          <Phone className="h-3 w-3" />
                          <span>{partner.contact_phone}</span>
                        </a>
                      )}
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(partner.last_contact_date)}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      {partner.website && (
                        <a
                          href={partner.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#BF9C73] hover:text-[#BF9C73]/80"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                      <button className="text-gray-400 hover:text-gray-600">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.total_pages > 1 && (
          <div className="bg-stone-50 px-6 py-4 flex items-center justify-between border-t border-stone-200">
            <div className="text-sm text-gray-700">
              Showing {((pagination.page - 1) * pagination.per_page) + 1} to{' '}
              {Math.min(pagination.page * pagination.per_page, pagination.total)} of{' '}
              {pagination.total} results
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page <= 1}
                className="px-3 py-1 border border-stone-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-stone-100"
              >
                Previous
              </button>
              
              <span className="text-sm text-gray-700">
                Page {pagination.page} of {pagination.total_pages}
              </span>
              
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page >= pagination.total_pages}
                className="px-3 py-1 border border-stone-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-stone-100"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Empty State */}
      {partners.length === 0 && !loading && (
        <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-12 text-center">
          <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-[#091747] mb-2">
            No partners found
          </h3>
          <p className="text-gray-500 mb-6">
            Get started by adding your first treatment center partner.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-[#BF9C73] hover:bg-[#BF9C73]/90 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Add First Partner
          </button>
        </div>
      )}
    </div>
  )
}