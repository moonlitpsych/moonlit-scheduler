'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { providerImpersonationManager, ImpersonatedProvider } from '@/lib/provider-impersonation'
import { ChevronDown, User, UserCheck, UserX, RefreshCcw, Search } from 'lucide-react'

export default function ProviderSelector() {
  const [isOpen, setIsOpen] = useState(false)
  const [currentProvider, setCurrentProvider] = useState<ImpersonatedProvider | null>(null)
  const [providers, setProviders] = useState<ImpersonatedProvider[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredProviders, setFilteredProviders] = useState<ImpersonatedProvider[]>([])
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    loadCurrentProvider()
    loadProviders()
  }, [])

  useEffect(() => {
    // Filter providers based on search
    if (searchQuery.trim() === '') {
      setFilteredProviders(providers)
    } else {
      const query = searchQuery.toLowerCase()
      const filtered = providers.filter(provider =>
        provider.first_name.toLowerCase().includes(query) ||
        provider.last_name.toLowerCase().includes(query) ||
        provider.email.toLowerCase().includes(query)
      )
      setFilteredProviders(filtered)
    }
  }, [searchQuery, providers])

  const loadCurrentProvider = () => {
    const impersonation = providerImpersonationManager.getImpersonatedProvider()
    if (impersonation) {
      setCurrentProvider(impersonation.provider)
    }
  }

  const loadProviders = async () => {
    const allProviders = await providerImpersonationManager.getAllProviders()
    setProviders(allProviders)
    setFilteredProviders(allProviders)
  }

  const handleSelectProvider = async (provider: ImpersonatedProvider) => {
    setLoading(true)
    setIsOpen(false)
    setSearchQuery('')

    // Get current user for logging
    const impersonation = providerImpersonationManager.getImpersonatedProvider()
    const adminEmail = impersonation?.impersonatedBy || 'unknown'

    // Update impersonation
    providerImpersonationManager.setImpersonatedProvider(provider, adminEmail)

    // Log the switch
    await providerImpersonationManager.logAdminAction({
      providerId: provider.id,
      actionType: 'impersonation_switch',
      description: `Admin switched to viewing as ${provider.first_name} ${provider.last_name}`
    })

    // Refresh page to load new provider data
    window.location.reload()
  }

  const handleChangeProvider = () => {
    setIsOpen(false)
    router.push('/dashboard/select-provider')
  }

  const getProviderStatusIcon = (provider: ImpersonatedProvider) => {
    if (!provider.is_active) {
      return <UserX className="w-3 h-3 text-stone-500" />
    }
    if (!provider.auth_user_id) {
      return <UserX className="w-3 h-3 text-amber-600" />
    }
    return <UserCheck className="w-3 h-3 text-green-600" />
  }

  if (!currentProvider) {
    return (
      <div className="text-sm text-white/70 px-3 py-2">
        Loading provider...
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
        className="flex items-center space-x-2 px-4 py-2 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50 min-w-[250px]"
      >
        <User className="w-4 h-4 text-white" />
        <div className="flex-1 text-left">
          <p className="text-xs text-white/70">Viewing as:</p>
          <p className="text-sm font-medium text-white">
            {currentProvider.first_name} {currentProvider.last_name}
          </p>
        </div>
        {loading ? (
          <RefreshCcw className="w-4 h-4 text-white animate-spin" />
        ) : (
          <ChevronDown className="w-4 h-4 text-white" />
        )}
      </button>

      {isOpen && !loading && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-stone-200 py-2 z-20 max-h-[500px] overflow-hidden flex flex-col">
            {/* Current Provider */}
            <div className="px-4 py-3 border-b border-stone-100 bg-[#BF9C73]/5">
              <p className="text-xs text-stone-500 font-medium uppercase tracking-wider mb-2">
                Currently Viewing
              </p>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-[#BF9C73] to-[#F6B398] rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold text-sm">
                    {currentProvider.first_name[0]}{currentProvider.last_name[0]}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#091747] truncate">
                    {currentProvider.first_name} {currentProvider.last_name}
                  </p>
                  <p className="text-xs text-[#091747]/60 truncate">{currentProvider.email}</p>
                </div>
              </div>
            </div>

            {/* Search */}
            <div className="px-4 py-3 border-b border-stone-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-stone-400" />
                <input
                  type="text"
                  placeholder="Search providers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>

            {/* Provider List */}
            <div className="overflow-y-auto flex-1">
              <div className="px-2 py-2">
                <p className="text-xs text-stone-500 font-medium uppercase tracking-wider mb-2 px-2">
                  Switch To ({filteredProviders.length})
                </p>
                <div className="space-y-1 max-h-[250px] overflow-y-auto">
                  {filteredProviders.map((provider) => (
                    <button
                      key={provider.id}
                      onClick={() => handleSelectProvider(provider)}
                      disabled={provider.id === currentProvider.id}
                      className={`w-full flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
                        provider.id === currentProvider.id
                          ? 'bg-[#BF9C73]/10 text-[#BF9C73] cursor-default'
                          : 'text-stone-700 hover:bg-stone-50'
                      }`}
                    >
                      <div className="w-8 h-8 bg-gradient-to-br from-[#BF9C73] to-[#F6B398] rounded-full flex items-center justify-center mr-3">
                        <span className="text-white font-medium text-xs">
                          {provider.first_name[0]}{provider.last_name[0]}
                        </span>
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <p className="font-medium truncate">
                          {provider.first_name} {provider.last_name}
                        </p>
                        <p className="text-xs text-stone-500 truncate">{provider.role.replace('_', ' ')}</p>
                      </div>
                      {getProviderStatusIcon(provider)}
                    </button>
                  ))}
                </div>

                {filteredProviders.length === 0 && (
                  <div className="text-center py-6">
                    <UserX className="h-8 w-8 text-stone-300 mx-auto mb-2" />
                    <p className="text-sm text-stone-500">No providers found</p>
                  </div>
                )}
              </div>
            </div>

            {/* View All Link */}
            <div className="px-4 py-3 border-t border-stone-100">
              <button
                onClick={handleChangeProvider}
                className="w-full text-sm text-[#BF9C73] hover:text-[#A8865F] font-medium transition-colors text-center"
              >
                View All Providers
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
