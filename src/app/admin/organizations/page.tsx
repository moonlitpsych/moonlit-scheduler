'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Search,
  Plus,
  Building2,
  Mail,
  Phone,
  MapPin,
  MoreHorizontal,
  Users,
  Briefcase,
  Calendar,
  Shield,
  Pencil,
  Trash2,
  AlertTriangle
} from 'lucide-react'
import OrganizationEditorModal from '@/components/admin/OrganizationEditorModal'

interface OrganizationWithStats {
  id: string
  name: string
  slug: string
  type: string
  status: string
  primary_contact_email?: string
  primary_contact_phone?: string
  primary_contact_name?: string
  address_line_1?: string
  address_line_2?: string
  city?: string
  state?: string
  zip_code?: string
  tax_id?: string
  license_number?: string
  accreditation_details?: string
  allowed_domains?: string[]
  settings?: Record<string, any>
  created_at: string
  updated_at: string
  partner_count: number
  user_count: number
  last_activity: string
  location?: string
}

interface PaginationInfo {
  page: number
  per_page: number
  total: number
  total_pages: number
}

const TYPE_COLORS = {
  healthcare_partner: 'bg-blue-100 text-blue-800',
  treatment_center: 'bg-green-100 text-green-800',
  rehabilitation: 'bg-purple-100 text-purple-800',
  mental_health: 'bg-indigo-100 text-indigo-800',
  substance_abuse: 'bg-orange-100 text-orange-800',
  other: 'bg-gray-100 text-gray-800'
}

const STATUS_COLORS = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800',
  suspended: 'bg-red-100 text-red-800'
}

export default function AdminOrganizationsPage() {
  const [organizations, setOrganizations] = useState<OrganizationWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortBy, setSortBy] = useState('updated_at_desc')
  // Dynamic dropdown options
  const [dropdownOptions, setDropdownOptions] = useState<{
    types: string[]
    statuses: string[]
  }>({ types: [], statuses: [] })
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    per_page: 25,
    total: 0,
    total_pages: 0
  })
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedOrganization, setSelectedOrganization] = useState<OrganizationWithStats | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [organizationToDelete, setOrganizationToDelete] = useState<OrganizationWithStats | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fetch dropdown options
  const fetchDropdownOptions = async () => {
    try {
      const response = await fetch('/api/admin/dropdown-options')
      const result = await response.json()
      
      if (result.success) {
        setDropdownOptions({
          types: result.data.actual_options.types,
          statuses: result.data.actual_options.statuses
        })
        
        // Log schema mismatch warnings
        if (result.data.analysis.schema_mismatch.types || result.data.analysis.schema_mismatch.statuses) {
          console.warn('⚠️ Schema mismatch detected:', result.data.analysis.recommendations)
        }
      }
    } catch (error) {
      console.error('Error fetching dropdown options:', error)
    }
  }

  // Fetch organizations data
  const fetchOrganizations = async () => {
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        per_page: pagination.per_page.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(typeFilter && { type: typeFilter }),
        ...(statusFilter && { status: statusFilter }),
        ...(sortBy && { sort: sortBy })
      })

      const response = await fetch(`/api/admin/organizations?${params}`)
      const result = await response.json()

      if (result.success) {
        setOrganizations(result.data)
        setPagination(result.pagination)
      } else {
        console.error('Failed to fetch organizations:', result.error)
      }
    } catch (error) {
      console.error('Error fetching organizations:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDropdownOptions()
    fetchOrganizations()
  }, [pagination.page, searchTerm, typeFilter, statusFilter, sortBy])

  // Fetch dropdown options on mount
  useEffect(() => {
    fetchDropdownOptions()
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdownId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleEdit = (org: OrganizationWithStats) => {
    setSelectedOrganization(org)
    setShowCreateModal(true)
    setOpenDropdownId(null)
  }

  const handleDeleteClick = (org: OrganizationWithStats) => {
    setOrganizationToDelete(org)
    setShowDeleteConfirm(true)
    setDeleteError(null)
    setOpenDropdownId(null)
  }

  const handleDeleteConfirm = async () => {
    if (!organizationToDelete) return

    setDeleting(true)
    setDeleteError(null)

    try {
      const response = await fetch(`/api/admin/organizations/${organizationToDelete.id}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to deactivate organization')
      }

      // Close modal and refresh
      setShowDeleteConfirm(false)
      setOrganizationToDelete(null)
      fetchOrganizations()
    } catch (err: any) {
      console.error('Delete error:', err)
      setDeleteError(err.message || 'Failed to deactivate organization')
    } finally {
      setDeleting(false)
    }
  }

  const handleModalSuccess = () => {
    setSelectedOrganization(null)
    fetchOrganizations()
  }

  const handleModalClose = () => {
    setShowCreateModal(false)
    setSelectedOrganization(null)
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString()
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'healthcare_partner': return <Shield className="h-4 w-4" />
      case 'treatment_center': return <Building2 className="h-4 w-4" />
      case 'rehabilitation': return <Briefcase className="h-4 w-4" />
      case 'mental_health': return <Users className="h-4 w-4" />
      case 'substance_abuse': return <Shield className="h-4 w-4" />
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
          Organization Management
        </h1>
        <p className="text-[#091747]/70">
          Manage treatment centers, healthcare partners, and referral organizations
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
              <p className="text-sm text-gray-600">Total Organizations</p>
              <p className="text-2xl font-bold text-[#091747]">{pagination.total}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-6 border border-stone-200">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <Shield className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Active Organizations</p>
              <p className="text-2xl font-bold text-[#091747]">
                {organizations.filter(o => o.status === 'active').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-stone-200">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Users className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Users</p>
              <p className="text-2xl font-bold text-[#091747]">
                {organizations.reduce((sum, org) => sum + org.user_count, 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-stone-200">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-[#BF9C73]/20 rounded-lg">
              <Briefcase className="h-6 w-6 text-[#BF9C73]" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Treatment Centers</p>
              <p className="text-2xl font-bold text-[#091747]">
                {organizations.filter(o => o.type === 'treatment_center').length}
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
              placeholder="Search organizations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent w-full"
            />
          </div>

          {/* Filters and Actions */}
          <div className="flex items-center space-x-4">
            {/* Type Filter - Dynamic */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="border border-stone-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent"
            >
              <option value="">All Types</option>
              {dropdownOptions.types.map(type => (
                <option key={type} value={type}>
                  {type === 'None' ? 'Unspecified' : type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </option>
              ))}
            </select>

            {/* Status Filter - Dynamic */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-stone-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent"
            >
              <option value="">All Status</option>
              {dropdownOptions.statuses.map(status => (
                <option key={status} value={status}>
                  {status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </option>
              ))}
            </select>

            {/* Sort By */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="border border-stone-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent"
            >
              <option value="updated_at_desc">Most Recently Updated</option>
              <option value="last_activity_desc">Most Recent Activity</option>
              <option value="created_at_desc">Newest First</option>
              <option value="created_at_asc">Oldest First</option>
              <option value="name_asc">Name A-Z</option>
              <option value="name_desc">Name Z-A</option>
              <option value="user_count_desc">Most Users</option>
              <option value="partner_count_desc">Most Partners</option>
            </select>

            {/* Add Organization Button */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-[#BF9C73] hover:bg-[#BF9C73]/90 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Add Organization</span>
            </button>
          </div>
        </div>
      </div>

      {/* Organizations Table */}
      <div className="bg-white rounded-lg shadow-sm border border-stone-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-stone-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Organization
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Users/Partners
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-stone-200">
              {organizations.map((org) => (
                <tr key={org.id} className="hover:bg-stone-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-[#091747]">
                        {org.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {org.slug}
                      </div>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[org.type as keyof typeof TYPE_COLORS] || 'bg-gray-100 text-gray-800'}`}>
                      {getTypeIcon(org.type || 'other')}
                      <span className="capitalize">{(org.type || 'unspecified').replace('_', ' ')}</span>
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[org.status as keyof typeof STATUS_COLORS] || 'bg-gray-100 text-gray-800'}`}>
                      {org.status || 'unknown'}
                    </span>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="space-y-1">
                      {org.primary_contact_name && (
                        <div className="text-sm font-medium text-[#091747]">
                          {org.primary_contact_name}
                        </div>
                      )}
                      {org.primary_contact_email && (
                        <a 
                          href={`mailto:${org.primary_contact_email}`}
                          className="text-sm text-[#BF9C73] hover:text-[#BF9C73]/80 flex items-center space-x-1"
                        >
                          <Mail className="h-3 w-3" />
                          <span className="truncate max-w-[150px]">{org.primary_contact_email}</span>
                        </a>
                      )}
                      {org.primary_contact_phone && (
                        <a 
                          href={`tel:${org.primary_contact_phone}`}
                          className="text-sm text-[#BF9C73] hover:text-[#BF9C73]/80 flex items-center space-x-1"
                        >
                          <Phone className="h-3 w-3" />
                          <span>{org.primary_contact_phone}</span>
                        </a>
                      )}
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    {org.location && (
                      <div className="text-sm text-gray-900 flex items-center space-x-1">
                        <MapPin className="h-3 w-3 text-gray-400" />
                        <span>{org.location}</span>
                      </div>
                    )}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-4">
                      <div className="text-sm text-gray-900">
                        <span className="font-medium">{org.user_count}</span>
                        <span className="text-gray-500"> users</span>
                      </div>
                      <div className="text-sm text-gray-900">
                        <span className="font-medium">{org.partner_count}</span>
                        <span className="text-gray-500"> partners</span>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(org.created_at)}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="relative" ref={openDropdownId === org.id ? dropdownRef : null}>
                      <button
                        onClick={() => setOpenDropdownId(openDropdownId === org.id ? null : org.id)}
                        className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>

                      {openDropdownId === org.id && (
                        <div className="absolute right-0 mt-1 w-36 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                          <button
                            onClick={() => handleEdit(org)}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                          >
                            <Pencil className="h-4 w-4" />
                            <span>Edit</span>
                          </button>
                          {org.status !== 'inactive' && (
                            <button
                              onClick={() => handleDeleteClick(org)}
                              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                            >
                              <Trash2 className="h-4 w-4" />
                              <span>Deactivate</span>
                            </button>
                          )}
                        </div>
                      )}
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
      {organizations.length === 0 && !loading && (
        <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-12 text-center">
          <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-[#091747] mb-2">
            No organizations found
          </h3>
          <p className="text-gray-500 mb-6">
            Get started by adding your first organization.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-[#BF9C73] hover:bg-[#BF9C73]/90 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Add First Organization
          </button>
        </div>
      )}

      {/* Organization Editor Modal */}
      <OrganizationEditorModal
        isOpen={showCreateModal}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
        organization={selectedOrganization}
        dropdownOptions={dropdownOptions}
      />

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && organizationToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={() => !deleting && setShowDeleteConfirm(false)}
          />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-start space-x-4">
                <div className="p-3 bg-red-100 rounded-full">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 font-['Newsreader']">
                    Deactivate Organization
                  </h3>
                  <p className="mt-2 text-sm text-gray-600">
                    Are you sure you want to deactivate <strong>{organizationToDelete.name}</strong>?
                  </p>
                  <p className="mt-2 text-sm text-gray-500">
                    This will set the organization status to inactive and deactivate all {organizationToDelete.user_count} team member{organizationToDelete.user_count !== 1 ? 's' : ''}.
                  </p>

                  {deleteError && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-800">{deleteError}</p>
                    </div>
                  )}

                  <div className="mt-6 flex space-x-3">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={deleting}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteConfirm}
                      disabled={deleting}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center"
                    >
                      {deleting ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Deactivating...
                        </>
                      ) : (
                        'Deactivate'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}