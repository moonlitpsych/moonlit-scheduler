'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { User, Search, Loader2, AlertTriangle, ChevronRight } from 'lucide-react'

interface Provider {
  id: string
  first_name: string
  last_name: string
  role: string
  email: string | null
  npi: string | null
  is_active: boolean
}

export default function ProviderCredentialingListPage() {
  const router = useRouter()
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchText, setSearchText] = useState('')

  useEffect(() => {
    loadProviders()
  }, [])

  const loadProviders = async () => {
    try {
      setLoading(true)
      setError(null)

      const res = await fetch('/api/admin/providers')
      if (!res.ok) {
        throw new Error('Failed to fetch providers')
      }

      const data = await res.json()
      setProviders(data.data || [])
    } catch (err: any) {
      console.error('Error loading providers:', err)
      setError(err.message || 'Failed to load providers')
    } finally {
      setLoading(false)
    }
  }

  const filteredProviders = providers.filter(provider => {
    if (!searchText) return true
    const search = searchText.toLowerCase()
    const fullName = `${provider.first_name} ${provider.last_name}`.toLowerCase()
    return (
      fullName.includes(search) ||
      provider.role?.toLowerCase().includes(search) ||
      provider.email?.toLowerCase().includes(search) ||
      provider.npi?.includes(search)
    )
  })

  const activeProviders = filteredProviders.filter(p => p.is_active)
  const inactiveProviders = filteredProviders.filter(p => !p.is_active)

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          <span className="text-gray-600">Loading providers...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-semibold text-red-800">Error Loading Providers</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
              <button
                onClick={loadProviders}
                className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-2xl font-bold text-gray-900">Provider Credentialing</h1>
          <p className="text-sm text-gray-600 mt-1">
            Select a provider to manage their credentialing with payers
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search providers by name, role, email, or NPI..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-600">Total Providers</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{providers.length}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-600">Active Providers</p>
            <p className="text-2xl font-bold text-green-700 mt-1">{activeProviders.length}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-600">Inactive Providers</p>
            <p className="text-2xl font-bold text-gray-500 mt-1">{inactiveProviders.length}</p>
          </div>
        </div>

        {/* Active Providers List */}
        {activeProviders.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Active Providers</h2>
            <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
              {activeProviders.map((provider) => (
                <button
                  key={provider.id}
                  onClick={() => router.push(`/admin/provider-credentialing/${provider.id}`)}
                  className="w-full px-6 py-4 hover:bg-gray-50 flex items-center justify-between transition-colors text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">
                        {provider.first_name} {provider.last_name}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-600">
                        <span>{provider.role}</span>
                        {provider.email && (
                          <>
                            <span className="text-gray-400">•</span>
                            <span>{provider.email}</span>
                          </>
                        )}
                        {provider.npi && (
                          <>
                            <span className="text-gray-400">•</span>
                            <span>NPI: {provider.npi}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Inactive Providers List */}
        {inactiveProviders.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Inactive Providers</h2>
            <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200 opacity-60">
              {inactiveProviders.map((provider) => (
                <button
                  key={provider.id}
                  onClick={() => router.push(`/admin/provider-credentialing/${provider.id}`)}
                  className="w-full px-6 py-4 hover:bg-gray-50 flex items-center justify-between transition-colors text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="w-6 h-6 text-gray-400" />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-700 flex items-center gap-2">
                        {provider.first_name} {provider.last_name}
                        <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs font-medium rounded">
                          Inactive
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                        <span>{provider.role}</span>
                        {provider.email && (
                          <>
                            <span className="text-gray-400">•</span>
                            <span>{provider.email}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {filteredProviders.length === 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">
              {searchText ? 'No providers match your search' : 'No providers found'}
            </p>
            {searchText && (
              <button
                onClick={() => setSearchText('')}
                className="mt-3 text-sm text-indigo-600 hover:text-indigo-700"
              >
                Clear search
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
