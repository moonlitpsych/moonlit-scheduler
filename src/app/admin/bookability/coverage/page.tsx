'use client'

import { useState, useEffect } from 'react'
import { Search, Users, Building, Calendar, Download } from 'lucide-react'
import { loadProvidersForCoverageList, loadPayersForCoverageList, ProviderForCoverage } from '@/lib/data/providers'

interface CoverageItem {
  id: string
  name: string
  network_status: 'in_network' | 'supervised'
  effective_date: string | null
  expiration_date: string | null
  bookable_from_date: string | null
}

interface CoverageMetadata {
  view_type: string
  entity_id: string
  mode: string
  service_date: string
  total_relationships: number
  direct_relationships: number
  supervised_relationships: number
}

export default function BookabilityCoveragePage() {
  const [activeView, setActiveView] = useState<'provider' | 'payer'>('provider')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [mode, setMode] = useState<'today' | 'service_date'>('today')

  // Entity lists
  const [providers, setProviders] = useState<ProviderForCoverage[]>([])
  const [payers, setPayers] = useState<ProviderForCoverage[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedEntity, setSelectedEntity] = useState<ProviderForCoverage | null>(null)

  // Coverage data
  const [coverageData, setCoverageData] = useState<CoverageItem[]>([])
  const [coverageMetadata, setCoverageMetadata] = useState<CoverageMetadata | null>(null)
  const [loadingEntities, setLoadingEntities] = useState(false)
  const [loadingCoverage, setLoadingCoverage] = useState(false)

  // Load entity lists on mount and view change
  useEffect(() => {
    const loadEntities = async () => {
      setLoadingEntities(true)
      try {
        if (activeView === 'provider') {
          const providerData = await loadProvidersForCoverageList()
          setProviders(providerData)
          console.log(`✅ Loaded ${providerData.length} providers for coverage`)
        } else {
          const payerData = await loadPayersForCoverageList()
          setPayers(payerData)
          console.log(`✅ Loaded ${payerData.length} payers for coverage`)
        }
      } catch (error) {
        console.error('❌ Error loading entities:', error)
      } finally {
        setLoadingEntities(false)
      }
    }

    loadEntities()
    setSelectedEntity(null) // Clear selection when changing views
    setCoverageData([]) // Clear coverage data
  }, [activeView])

  // Load coverage data when entity is selected
  useEffect(() => {
    if (!selectedEntity) {
      setCoverageData([])
      setCoverageMetadata(null)
      return
    }

    const loadCoverageData = async () => {
      setLoadingCoverage(true)
      try {
        console.log('🔍 Loading coverage for:', selectedEntity.label)

        const params = new URLSearchParams({
          view: activeView,
          id: selectedEntity.id,
          mode,
          ...(mode === 'service_date' ? { service_date: selectedDate } : {})
        })

        const response = await fetch(`/api/admin/bookability/coverage?${params}`)
        const result = await response.json()

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Failed to fetch coverage data')
        }

        setCoverageData(result.data || [])
        setCoverageMetadata(result.metadata)
        console.log(`✅ Loaded ${result.data?.length || 0} coverage relationships`)

      } catch (error) {
        console.error('❌ Error loading coverage data:', error)
        setCoverageData([])
        setCoverageMetadata(null)
      } finally {
        setLoadingCoverage(false)
      }
    }

    loadCoverageData()
  }, [selectedEntity, mode, selectedDate, activeView])

  // Filter entities by search term
  const currentEntities = activeView === 'provider' ? providers : payers
  const filteredEntities = currentEntities.filter(entity =>
    entity.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entity.subtitle.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Export coverage data to CSV
  const exportCoverageData = () => {
    if (!selectedEntity || coverageData.length === 0) return

    const headers = activeView === 'provider'
      ? ['Payer Name', 'Network Status', 'Effective Date', 'Expiration Date', 'Bookable From']
      : ['Provider Name', 'Network Status', 'Effective Date', 'Expiration Date', 'Bookable From']

    const rows = coverageData.map(item => [
      item.name,
      item.network_status === 'in_network' ? 'Direct' : 'Supervised',
      item.effective_date ? new Date(item.effective_date).toLocaleDateString() : '',
      item.expiration_date ? new Date(item.expiration_date).toLocaleDateString() : '',
      item.bookable_from_date ? new Date(item.bookable_from_date).toLocaleDateString() : ''
    ])

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bookability_coverage_${activeView}_${selectedEntity.label.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-full">
      {/* View Toggle */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-1 bg-stone-100 rounded-lg p-1">
            <button
              onClick={() => setActiveView('provider')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeView === 'provider'
                  ? 'bg-white text-[#091747] shadow-sm'
                  : 'text-[#091747]/60 hover:text-[#091747]'
              }`}
            >
              By Provider
            </button>
            <button
              onClick={() => setActiveView('payer')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeView === 'payer'
                  ? 'bg-white text-[#091747] shadow-sm'
                  : 'text-[#091747]/60 hover:text-[#091747]'
              }`}
            >
              By Payer
            </button>
          </div>

          <div className="flex items-center space-x-3">
            {/* Mode Toggle */}
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-[#091747]">Mode:</span>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as 'today' | 'service_date')}
                className="px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20 focus:border-[#BF9C73]"
              >
                <option value="today">Bookable Today</option>
                <option value="service_date">Schedulable on Service Date</option>
              </select>
            </div>

            {/* Date Picker - only show when service_date mode */}
            {mode === 'service_date' && (
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20 focus:border-[#BF9C73]"
              />
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Provider/Payer Picker */}
        <div className="bg-white rounded-lg border border-stone-200 p-6">
          <div className="flex items-center space-x-2 mb-4">
            {activeView === 'provider' ? (
              <Users className="h-5 w-5 text-[#BF9C73]" />
            ) : (
              <Building className="h-5 w-5 text-[#BF9C73]" />
            )}
            <h3 className="font-semibold text-[#091747]">
              Select {activeView === 'provider' ? 'Provider' : 'Payer'}
            </h3>
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#091747]/40" />
            <input
              type="text"
              placeholder={`Search ${activeView === 'provider' ? 'providers' : 'payers'}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20 focus:border-[#BF9C73]"
            />
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {loadingEntities ? (
              <div className="p-4 text-center">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-[#BF9C73] border-t-transparent"></div>
                <p className="mt-2 text-sm text-[#091747]/60">Loading...</p>
              </div>
            ) : filteredEntities.length === 0 ? (
              <div className="p-4 text-center text-[#091747]/60">
                {searchTerm
                  ? `No ${activeView === 'provider' ? 'providers' : 'payers'} found matching "${searchTerm}"`
                  : `No ${activeView === 'provider' ? 'providers' : 'payers'} available`
                }
              </div>
            ) : (
              filteredEntities.map((entity) => (
                <div
                  key={entity.id}
                  onClick={() => setSelectedEntity(entity)}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedEntity?.id === entity.id
                      ? 'border-[#BF9C73] bg-[#BF9C73]/10'
                      : 'border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  <div className="font-medium text-[#091747]">
                    {entity.label}
                  </div>
                  <div className="text-sm text-[#091747]/60">
                    {entity.subtitle}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Panel - Coverage Details */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-stone-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-[#091747]">
                {activeView === 'provider'
                  ? 'Accepted Payers'
                  : 'Accepting Providers'
                }
              </h3>
              {selectedEntity && (
                <p className="text-sm text-[#091747]/60 mt-1">
                  for {selectedEntity.label}
                </p>
              )}
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 text-sm text-[#091747]/60">
                <Calendar className="h-4 w-4" />
                <span>
                  {mode === 'today'
                    ? 'As of today'
                    : `As of ${new Date(selectedDate).toLocaleDateString()}`
                  }
                </span>
              </div>
              {selectedEntity && coverageData.length > 0 && (
                <button
                  onClick={exportCoverageData}
                  className="flex items-center space-x-2 px-3 py-2 text-sm bg-[#BF9C73] hover:bg-[#BF9C73]/90 text-white rounded-lg transition-colors"
                >
                  <Download className="h-4 w-4" />
                  <span>Export CSV</span>
                </button>
              )}
            </div>
          </div>

          {!selectedEntity ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
                {activeView === 'provider' ? (
                  <Building className="h-8 w-8 text-stone-400" />
                ) : (
                  <Users className="h-8 w-8 text-stone-400" />
                )}
              </div>
              <h4 className="text-lg font-medium text-[#091747] mb-2">
                Select a {activeView}
              </h4>
              <p className="text-[#091747]/60">
                Choose a {activeView} from the left panel to view their coverage details
              </p>
            </div>
          ) : loadingCoverage ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-[#BF9C73] border-t-transparent"></div>
              <p className="mt-4 text-[#091747]/60">Loading coverage data...</p>
            </div>
          ) : coverageData.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Building className="h-8 w-8 text-red-400" />
              </div>
              <h4 className="text-lg font-medium text-[#091747] mb-2">
                No Coverage Found
              </h4>
              <p className="text-[#091747]/60">
                {selectedEntity.label} has no {activeView === 'provider' ? 'accepted payers' : 'accepting providers'}
                {mode === 'today' ? ' as of today' : ` as of ${new Date(selectedDate).toLocaleDateString()}`}
              </p>
            </div>
          ) : (
            <div>
              {/* Summary Stats */}
              {coverageMetadata && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  <div className="bg-stone-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-[#091747]">{coverageMetadata.total_relationships}</div>
                    <div className="text-sm text-[#091747]/60">Total Relationships</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-green-700">{coverageMetadata.direct_relationships}</div>
                    <div className="text-sm text-green-600">Direct</div>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-blue-700">{coverageMetadata.supervised_relationships}</div>
                    <div className="text-sm text-blue-600">Supervised</div>
                  </div>
                </div>
              )}

              {/* Coverage Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-stone-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-[#091747]">
                        {activeView === 'provider' ? 'Payer' : 'Provider'}
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-[#091747]">Network Status</th>
                      <th className="px-4 py-3 text-left font-medium text-[#091747]">Effective Date</th>
                      <th className="px-4 py-3 text-left font-medium text-[#091747]">Expiration Date</th>
                      <th className="px-4 py-3 text-left font-medium text-[#091747]">Bookable From</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {coverageData.map((item) => (
                      <tr key={item.id} className="hover:bg-stone-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-[#091747]">{item.name}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            item.network_status === 'in_network'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {item.network_status === 'in_network' ? 'Direct' : 'Supervised'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-[#091747]">
                          {item.effective_date ? new Date(item.effective_date).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-[#091747]">
                          {item.expiration_date ? new Date(item.expiration_date).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-[#091747]">
                          {item.bookable_from_date ? new Date(item.bookable_from_date).toLocaleDateString() : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Coverage Analysis Info */}
      <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="text-sm text-blue-800">
          <strong>Coverage Analysis:</strong> This view shows real-time provider-payer relationships from the canonical view.
          Use the mode toggle to switch between "Bookable Today" and "Schedulable on Service Date" for different analysis timeframes.
          Export data to CSV for compliance reporting and network adequacy analysis.
        </div>
      </div>
    </div>
  )
}