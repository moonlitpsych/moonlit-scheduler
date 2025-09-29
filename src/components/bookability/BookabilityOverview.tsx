'use client'

import { useState, useEffect } from 'react'
import { Search, Filter, RefreshCw, Info, Download } from 'lucide-react'
import BookabilityTable from '@/app/admin/bookability/BookabilityTable'
import BookabilityFilters from '@/app/admin/bookability/BookabilityFilters'
import { BookabilityRow, FilterState } from '@/app/admin/bookability/page'
import { getRenderingProviderId } from '@/lib/bookability/mapRenderingProvider'

interface BookabilityOverviewProps {
  isReadOnly?: boolean
}

export default function BookabilityOverview({ isReadOnly = false }: BookabilityOverviewProps) {
  const [bookabilityRows, setBookabilityRows] = useState<BookabilityRow[]>([])
  const [filteredRows, setFilteredRows] = useState<BookabilityRow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<FilterState>({
    payers: [],
    providers: [],
    path: 'all',
    requiresAttending: 'all',
    state: 'all',
    activeToday: false
  })

  // Available filter options
  const [availablePayers, setAvailablePayers] = useState<{id: string, name: string}[]>([])
  const [availableProviders, setAvailableProviders] = useState<{id: string, name: string}[]>([])

  // Fetch bookability data using API endpoint
  const fetchBookabilityData = async () => {
    try {
      setLoading(true)
      console.log('🔍 Fetching bookability data via API...')

      const response = await fetch('/api/admin/bookability')
      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to fetch bookability data')
      }

      console.log(`✅ Found ${result.data?.length || 0} bookability relationships`)

      setBookabilityRows(result.data || [])
      setFilteredRows(result.data || [])

      // Set up filter options
      const transformedData = result.data || []
      const uniquePayers = [...new Map(transformedData.map((row: BookabilityRow) => [row.payer_id, {id: row.payer_id, name: row.payer_name}])).values()]
      const uniqueProviders = [...new Map(transformedData.map((row: BookabilityRow) => [row.provider_id, {id: row.provider_id, name: `${row.provider_first_name} ${row.provider_last_name}`}])).values()]

      setAvailablePayers(uniquePayers.sort((a, b) => a.name.localeCompare(b.name)))
      setAvailableProviders(uniqueProviders.sort((a, b) => a.name.localeCompare(b.name)))

    } catch (error: any) {
      console.error('❌ Error fetching bookability data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Apply filters
  useEffect(() => {
    let filtered = bookabilityRows

    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      filtered = filtered.filter(row =>
        row.provider_first_name.toLowerCase().includes(search) ||
        row.provider_last_name.toLowerCase().includes(search) ||
        row.payer_name.toLowerCase().includes(search)
      )
    }

    // Payer filter
    if (filters.payers.length > 0) {
      filtered = filtered.filter(row => filters.payers.includes(row.payer_id))
    }

    // Provider filter
    if (filters.providers.length > 0) {
      filtered = filtered.filter(row => filters.providers.includes(row.provider_id))
    }

    // Path filter
    if (filters.path !== 'all') {
      if (filters.path === 'direct') {
        filtered = filtered.filter(row => row.network_status === 'in_network')
      } else if (filters.path === 'supervised') {
        filtered = filtered.filter(row => row.network_status === 'supervised')
      }
    }

    // Requires attending filter
    if (filters.requiresAttending !== 'all') {
      if (filters.requiresAttending === 'yes') {
        filtered = filtered.filter(row => row.requires_attending === true)
      } else if (filters.requiresAttending === 'no') {
        filtered = filtered.filter(row => row.requires_attending === false)
      }
    }

    // State filter
    if (filters.state !== 'all') {
      filtered = filtered.filter(row => row.state === filters.state)
    }

    // Active today filter
    if (filters.activeToday) {
      const today = new Date()
      filtered = filtered.filter(row => {
        const effectiveDate = row.effective_date ? new Date(row.effective_date) : null
        const expirationDate = row.expiration_date ? new Date(row.expiration_date) : null

        if (!effectiveDate) return false
        if (effectiveDate > today) return false
        if (expirationDate && expirationDate < today) return false

        return true
      })
    }

    setFilteredRows(filtered)
  }, [searchTerm, filters, bookabilityRows])

  // Load data on mount
  useEffect(() => {
    fetchBookabilityData()
  }, [])

  const getActiveFiltersCount = () => {
    let count = 0
    if (filters.payers.length > 0) count++
    if (filters.providers.length > 0) count++
    if (filters.path !== 'all') count++
    if (filters.requiresAttending !== 'all') count++
    if (filters.state !== 'all') count++
    if (filters.activeToday) count++
    return count
  }

  // Export all bookability data to CSV
  const exportAllBookabilityData = () => {
    if (bookabilityRows.length === 0) return

    const headers = [
      'Provider Name',
      'Provider ID',
      'Payer Name',
      'Payer ID',
      'Network Status',
      'Path Type',
      'Requires Attending',
      'Rendering Provider ID',
      'Billing Provider ID',
      'State',
      'Effective Date',
      'Expiration Date',
      'Bookable From Date'
    ]

    const rows = bookabilityRows.map(row => [
      `${row.provider_first_name} ${row.provider_last_name}`,
      row.provider_id,
      row.payer_name,
      row.payer_id,
      row.network_status,
      row.network_status === 'in_network' ? 'Direct' : 'Supervised',
      row.requires_attending ? 'Yes' : 'No',
      getRenderingProviderId(row) || '',
      row.billing_provider_id || '',
      row.state || '',
      row.effective_date ? new Date(row.effective_date).toLocaleDateString() : '',
      row.expiration_date ? new Date(row.expiration_date).toLocaleDateString() : '',
      row.bookable_from_date ? new Date(row.bookable_from_date).toLocaleDateString() : ''
    ])

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bookability_overview_all_data_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-full">
      {/* Controls */}
      <div className="mb-6">
        <div className="flex items-center justify-end gap-3 mb-4">
          <button
            onClick={exportAllBookabilityData}
            disabled={loading || bookabilityRows.length === 0}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 text-white rounded-lg transition-colors"
            title={`Export all ${bookabilityRows.length} relationships to CSV`}
          >
            <Download className="h-4 w-4" />
            <span>Export All ({bookabilityRows.length})</span>
          </button>
          <button
            onClick={fetchBookabilityData}
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-2 bg-[#BF9C73] hover:bg-[#BF9C73]/90 disabled:bg-[#BF9C73]/50 text-white rounded-lg transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Search and Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#091747]/40" />
              <input
                type="text"
                placeholder="Search providers or payers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20 focus:border-[#BF9C73]"
              />
            </div>
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center space-x-2 px-4 py-2 border rounded-lg transition-colors ${
              showFilters || getActiveFiltersCount() > 0
                ? 'bg-[#BF9C73]/10 border-[#BF9C73] text-[#BF9C73]'
                : 'border-stone-200 text-[#091747]/70 hover:bg-stone-50'
            }`}
          >
            <Filter className="h-4 w-4" />
            <span>Filters</span>
            {getActiveFiltersCount() > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-[#BF9C73] text-white text-xs rounded-full">
                {getActiveFiltersCount()}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <BookabilityFilters
          filters={filters}
          setFilters={setFilters}
          availablePayers={availablePayers}
          availableProviders={availableProviders}
        />
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border border-stone-200">
          <div className="text-2xl font-bold text-[#091747]">{filteredRows.length}</div>
          <div className="text-sm text-[#091747]/60">Total Relationships</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-stone-200">
          <div className="text-2xl font-bold text-[#091747]">
            {filteredRows.filter(row => row.network_status === 'supervised').length}
          </div>
          <div className="text-sm text-[#091747]/60">Supervised</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-stone-200">
          <div className="text-2xl font-bold text-[#091747]">
            {filteredRows.filter(row => row.requires_attending).length}
          </div>
          <div className="text-sm text-[#091747]/60">Requires Attending</div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-stone-200">
        <BookabilityTable
          data={filteredRows}
          loading={loading}
        />
      </div>

      {/* Info Footer */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-start space-x-2">
          <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <strong>Data Source:</strong> This table shows relationships from the canonical <code className="bg-blue-100 px-1 rounded">v_bookable_provider_payer</code> view.
            <strong className="ml-2">Direct</strong> relationships are provider-payer contracts.
            <strong className="ml-2">Supervised</strong> relationships allow residents to see patients under attending physician supervision.
            <div className="mt-2">
              <strong>Export All:</strong> The "Export All" button downloads a CSV file containing ALL bookability relationships, including complete provider/payer details, network status, contract dates, and rendering provider information - regardless of current filters or search terms.
            </div>
            {isReadOnly && (
              <div className="mt-2">
                <strong>Read-Only:</strong> This view is for informational purposes only.
                For changes to contracts or network status, please contact your administrator.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}