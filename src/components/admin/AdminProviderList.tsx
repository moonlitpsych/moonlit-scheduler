/**
 * Admin Provider List Component
 *
 * Comprehensive provider management interface with:
 * - Filtering by status, bookability, role
 * - Search by name, email, NPI
 * - Sortable columns
 * - CSV export
 * - Create, edit, view, archive actions
 */

'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Users, Search, Download, RotateCcw, Plus, Edit, Eye, Archive, Upload, Loader2 } from 'lucide-react'
import { useResizableColumns } from '@/hooks/useResizableColumns'
import { exportToCSV, formatDateForCSV } from '@/utils/csvExport'
import { formatPhoneNumber } from '@/lib/utils/phoneNormalizer'
import ProviderForm from './ProviderForm'
import ProviderDetailModal from './ProviderDetailModal'
import ProviderImportModal from './ProviderImportModal'

const fetcher = (url: string) => fetch(url).then(res => res.json())

interface Provider {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone_number: string | null
  auth_user_id: string | null
  is_active: boolean | null
  is_bookable: boolean | null
  list_on_provider_page: boolean | null
  accepts_new_patients: boolean | null
  role: string | null
  title: string | null
  provider_type: string | null
  npi: string | null
  profile_image_url: string | null
  created_date: string | null
  profile_completed: boolean | null
  telehealth_enabled: boolean | null
  languages_spoken: string[] | null
  med_school_org: string | null
  med_school_grad_year: number | null
  residency_org: string | null
  auth_metadata?: {
    email_confirmed: boolean
    last_sign_in_at: string | null
    created_at: string
    user_metadata: {
      temp_password?: boolean
      password_set_at?: string
      [key: string]: any
    }
  } | null
}

interface AdminProviderListProps {
  providers?: Provider[]
  roles?: any[]
}

export default function AdminProviderList({ providers: initialProviders, roles }: AdminProviderListProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('active')
  const [bookableFilter, setBookableFilter] = useState<string>('all')
  const [listedFilter, setListedFilter] = useState<string>('all')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('last_name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const limit = 50

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null)

  // Build API URL with filters
  const buildApiUrl = () => {
    const params = new URLSearchParams()
    if (searchTerm && searchTerm.trim()) params.append('search', searchTerm.trim())
    if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter)
    if (bookableFilter && bookableFilter !== 'all') params.append('bookable', bookableFilter)
    if (listedFilter && listedFilter !== 'all') params.append('listed', listedFilter)
    if (roleFilter && roleFilter !== 'all') params.append('role', roleFilter)
    params.append('sortBy', sortBy)
    params.append('sortOrder', sortOrder)
    params.append('limit', limit.toString())
    params.append('offset', ((page - 1) * limit).toString())

    return `/api/admin/providers?${params.toString()}`
  }

  const { data, error, mutate, isLoading } = useSWR(buildApiUrl(), fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30000
  })

  const providers = data?.data || []
  const totalCount = data?.total || 0
  const loading = isLoading || (!data && !error)

  // Resizable columns
  const { columnWidths, handleMouseDown, resetWidths } = useResizableColumns('admin-provider-list', {
    name: 200,
    email: 220,
    phone: 140,
    role: 140,
    status: 100,
    bookable: 100,
    listed: 100,
    npi: 120,
    created: 120,
    actions: 180
  })

  // CSV Export function
  const handleExportCSV = async () => {
    try {
      const exportUrl = buildApiUrl().replace('/api/admin/providers', '/api/admin/providers/export')
      window.open(exportUrl, '_blank')
    } catch (error) {
      console.error('Export failed:', error)
      alert('Failed to export providers')
    }
  }

  // Get unique roles for filter
  const uniqueRoles = Array.from(new Set(providers.map((p: Provider) => p.role).filter(Boolean)))

  // Status badge component - matches logic in ProviderDetailModal
  const StatusBadge = ({ provider }: { provider: Provider }) => {
    if (!provider.is_active) {
      return <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">Archived</span>
    }
    if (!provider.profile_completed) {
      return <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">Onboarding</span>
    }
    return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">Active</span>
  }

  // Bookable badge
  const BookableBadge = ({ isBookable }: { isBookable: boolean | null }) => {
    if (isBookable) {
      return <span className="px-2 py-1 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700">Yes</span>
    }
    return <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">No</span>
  }

  // Listed badge
  const ListedBadge = ({ isListed }: { isListed: boolean | null }) => {
    if (isListed) {
      return <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-700">Yes</span>
    }
    return <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">No</span>
  }

  // Auth badge - shows if provider can log in
  const AuthBadge = ({ provider }: { provider: Provider }) => {
    if (provider.auth_user_id) {
      return (
        <span
          className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700 cursor-help"
          title="Can log in with email and temp password: TempPassword123!"
        >
          🔑 Can Login
        </span>
      )
    }
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700 cursor-help"
        title="No auth account - provider cannot log in yet"
      >
        ⚠️ No Auth
      </span>
    )
  }

  // Password status badge - shows if provider has temporary or custom password
  const PasswordStatusBadge = ({ provider }: { provider: Provider }) => {
    // Only show if provider has auth account
    if (!provider.auth_user_id || !provider.auth_metadata) {
      return null
    }

    const hasTempPassword = provider.auth_metadata.user_metadata?.temp_password === true
    const hasLoggedIn = provider.auth_metadata.last_sign_in_at !== null

    if (hasTempPassword && !hasLoggedIn) {
      // Has temp password and never logged in
      return (
        <span
          className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700 cursor-help"
          title="Using temporary password TempPassword123! - Never logged in"
        >
          🔐 Temp Password
        </span>
      )
    } else if (hasTempPassword && hasLoggedIn) {
      // Has temp password but has logged in (should change password)
      return (
        <span
          className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700 cursor-help"
          title={`Still using temporary password - Last login: ${new Date(provider.auth_metadata.last_sign_in_at!).toLocaleDateString()}`}
        >
          ⚠️ Needs Password Change
        </span>
      )
    } else {
      // Custom password set
      return (
        <span
          className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700 cursor-help"
          title={`Custom password set${provider.auth_metadata.last_sign_in_at ? ` - Last login: ${new Date(provider.auth_metadata.last_sign_in_at).toLocaleDateString()}` : ''}`}
        >
          ✅ Password Set
        </span>
      )
    }
  }

  // Handle actions
  const handleView = (provider: Provider) => {
    setSelectedProvider(provider)
    setShowDetailModal(true)
  }

  const handleEdit = (provider: Provider) => {
    setSelectedProvider(provider)
    setShowEditModal(true)
  }

  const handleArchive = async (provider: Provider) => {
    if (!confirm(`Archive ${provider.first_name} ${provider.last_name}? This will deactivate the provider and remove them from booking.`)) {
      return
    }

    try {
      const response = await fetch(`/api/admin/providers/${provider.id}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (result.success) {
        alert('Provider archived successfully')
        mutate()
      } else {
        alert(`Failed to archive provider: ${result.error}`)
      }
    } catch (error) {
      console.error('Archive error:', error)
      alert('Failed to archive provider')
    }
  }

  const handleCreateSuccess = () => {
    setShowCreateModal(false)
    mutate()
  }

  const handleEditSuccess = () => {
    setShowEditModal(false)
    setSelectedProvider(null)
    mutate()
  }

  const handleImportSuccess = () => {
    setShowImportModal(false)
    mutate()
  }

  if (error) {
    return (
      <div className="min-h-screen bg-moonlit-cream p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-800">Error loading providers: {error.message}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-moonlit-cream">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-moonlit-navy mb-2 font-['Newsreader']">
              Provider Management
            </h1>
            <p className="text-gray-600 font-['Newsreader'] font-light">
              Manage all providers and their settings
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowImportModal(true)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-moonlit-brown"
              title="Import providers from CSV"
            >
              <Upload className="w-4 h-4 mr-2" />
              Import CSV
            </button>
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-moonlit-brown"
              title="Export providers to CSV"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </button>
            <button
              onClick={resetWidths}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-moonlit-brown"
              title="Reset column widths"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-moonlit-brown hover:bg-moonlit-brown/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-moonlit-brown"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Provider
            </button>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
            {/* Search */}
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Name, email, or NPI..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-moonlit-brown focus:border-moonlit-brown"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-moonlit-brown focus:border-moonlit-brown"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Archived</option>
              </select>
            </div>

            {/* Bookable Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bookable
              </label>
              <select
                value={bookableFilter}
                onChange={(e) => setBookableFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-moonlit-brown focus:border-moonlit-brown"
              >
                <option value="all">All</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>

            {/* Listed Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Listed
              </label>
              <select
                value={listedFilter}
                onChange={(e) => setListedFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-moonlit-brown focus:border-moonlit-brown"
              >
                <option value="all">All</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Role Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:ring-moonlit-brown focus:border-moonlit-brown"
                >
                  <option value="all">All Roles</option>
                  {uniqueRoles.map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="text-sm text-gray-600">
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span>Showing {providers.length} of {totalCount} providers</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    style={{ width: columnWidths.name }}
                    className="relative px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Name
                    <div
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-moonlit-brown/20"
                      onMouseDown={(e) => handleMouseDown(e, 'name')}
                    />
                  </th>
                  <th
                    style={{ width: columnWidths.email }}
                    className="relative px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Email
                    <div
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-moonlit-brown/20"
                      onMouseDown={(e) => handleMouseDown(e, 'email')}
                    />
                  </th>
                  <th
                    style={{ width: columnWidths.phone }}
                    className="relative px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Phone
                    <div
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-moonlit-brown/20"
                      onMouseDown={(e) => handleMouseDown(e, 'phone')}
                    />
                  </th>
                  <th
                    style={{ width: columnWidths.role }}
                    className="relative px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Role
                    <div
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-moonlit-brown/20"
                      onMouseDown={(e) => handleMouseDown(e, 'role')}
                    />
                  </th>
                  <th
                    style={{ width: columnWidths.status }}
                    className="relative px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Status
                    <div
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-moonlit-brown/20"
                      onMouseDown={(e) => handleMouseDown(e, 'status')}
                    />
                  </th>
                  <th
                    style={{ width: columnWidths.bookable }}
                    className="relative px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Bookable
                    <div
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-moonlit-brown/20"
                      onMouseDown={(e) => handleMouseDown(e, 'bookable')}
                    />
                  </th>
                  <th
                    style={{ width: columnWidths.listed }}
                    className="relative px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Listed
                    <div
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-moonlit-brown/20"
                      onMouseDown={(e) => handleMouseDown(e, 'listed')}
                    />
                  </th>
                  <th
                    style={{ width: columnWidths.npi }}
                    className="relative px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    NPI
                    <div
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-moonlit-brown/20"
                      onMouseDown={(e) => handleMouseDown(e, 'npi')}
                    />
                  </th>
                  <th
                    style={{ width: columnWidths.created }}
                    className="relative px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Created
                    <div
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-moonlit-brown/20"
                      onMouseDown={(e) => handleMouseDown(e, 'created')}
                    />
                  </th>
                  <th
                    style={{ width: columnWidths.actions }}
                    className="relative px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-12 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="w-6 h-6 animate-spin text-moonlit-brown" />
                        <span className="text-gray-500">Loading providers...</span>
                      </div>
                    </td>
                  </tr>
                ) : providers.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-12 text-center text-gray-500">
                      No providers found
                    </td>
                  </tr>
                ) : (
                  providers.map((provider: Provider) => (
                    <tr key={provider.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {provider.title} {provider.first_name} {provider.last_name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{provider.email || '-'}</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <AuthBadge provider={provider} />
                          <PasswordStatusBadge provider={provider} />
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{formatPhoneNumber(provider.phone_number) || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{provider.role || '-'}</div>
                        {provider.provider_type && (
                          <div className="text-xs text-gray-500">{provider.provider_type}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge provider={provider} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <BookableBadge isBookable={provider.is_bookable} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <ListedBadge isListed={provider.list_on_provider_page} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{provider.npi || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {provider.created_date ? new Date(provider.created_date).toLocaleDateString() : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleView(provider)}
                            className="text-moonlit-brown hover:text-moonlit-brown/80"
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(provider)}
                            className="text-blue-600 hover:text-blue-800"
                            title="Edit provider"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          {provider.is_active && (
                            <button
                              onClick={() => handleArchive(provider)}
                              className="text-red-600 hover:text-red-800"
                              title="Archive provider"
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalCount > limit && (
            <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
              <div className="text-sm text-gray-700">
                Showing <span className="font-medium">{(page - 1) * limit + 1}</span> to{' '}
                <span className="font-medium">{Math.min(page * limit, totalCount)}</span> of{' '}
                <span className="font-medium">{totalCount}</span> results
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page * limit >= totalCount}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showCreateModal && (
        <ProviderForm
          mode="create"
          onSuccess={handleCreateSuccess}
          onCancel={() => setShowCreateModal(false)}
        />
      )}

      {showEditModal && selectedProvider && (
        <ProviderForm
          mode="edit"
          provider={selectedProvider}
          onSuccess={handleEditSuccess}
          onCancel={() => {
            setShowEditModal(false)
            setSelectedProvider(null)
          }}
        />
      )}

      {showDetailModal && selectedProvider && (
        <ProviderDetailModal
          providerId={selectedProvider.id}
          onClose={() => {
            setShowDetailModal(false)
            setSelectedProvider(null)
          }}
          onEdit={() => {
            setShowDetailModal(false)
            setShowEditModal(true)
          }}
        />
      )}

      {showImportModal && (
        <ProviderImportModal
          onSuccess={handleImportSuccess}
          onClose={() => setShowImportModal(false)}
        />
      )}
    </div>
  )
}
