'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Database } from '@/types/database'
import { providerImpersonationManager, ImpersonatedProvider } from '@/lib/provider-impersonation'
import { authContextManager } from '@/lib/auth-context'
import { isAdminEmail } from '@/lib/admin-auth'
import { User, UserCheck, UserX, Search, ArrowLeft } from 'lucide-react'

export default function SelectProviderPage() {
  const [providers, setProviders] = useState<ImpersonatedProvider[]>([])
  const [filteredProviders, setFilteredProviders] = useState<ImpersonatedProvider[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  const router = useRouter()
  const supabase = createClientComponentClient<Database>()

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    // Filter providers based on search query
    if (searchQuery.trim() === '') {
      setFilteredProviders(providers)
    } else {
      const query = searchQuery.toLowerCase()
      const filtered = providers.filter(provider =>
        provider.first_name.toLowerCase().includes(query) ||
        provider.last_name.toLowerCase().includes(query) ||
        provider.email.toLowerCase().includes(query) ||
        provider.title.toLowerCase().includes(query)
      )
      setFilteredProviders(filtered)
    }
  }, [searchQuery, providers])

  const loadData = async () => {
    try {
      // Verify user is admin
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !isAdminEmail(user.email || '')) {
        router.replace('/dashboard')
        return
      }

      setCurrentUser(user)
      setIsAdmin(true)

      // Load all providers
      const allProviders = await providerImpersonationManager.getAllProviders()
      setProviders(allProviders)
      setFilteredProviders(allProviders)
    } catch (error) {
      console.error('Error loading providers:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectProvider = async (provider: ImpersonatedProvider) => {
    if (!currentUser) return

    // Set impersonation context
    providerImpersonationManager.setImpersonatedProvider(provider, currentUser.email)

    // Log the impersonation start
    await providerImpersonationManager.logAdminAction({
      providerId: provider.id,
      actionType: 'impersonation_start',
      description: `Admin ${currentUser.email} started viewing as ${provider.first_name} ${provider.last_name}`
    })

    // Navigate to dashboard
    router.push('/dashboard')
  }

  const handleBack = () => {
    // Clear any existing impersonation and return to admin
    providerImpersonationManager.clearImpersonation()
    authContextManager.setActiveContext('admin')
    router.push('/admin')
  }

  const getProviderStatusChip = (provider: ImpersonatedProvider) => {
    if (!provider.is_active) {
      return (
        <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-stone-200 text-stone-700 rounded-full">
          <UserX className="w-3 h-3 mr-1" />
          Inactive
        </span>
      )
    }

    if (!provider.auth_user_id) {
      return (
        <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
          <UserX className="w-3 h-3 mr-1" />
          Not yet a user
        </span>
      )
    }

    return (
      <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
        <UserCheck className="w-3 h-3 mr-1" />
        Active
      </span>
    )
  }

  const isCurrentAdmin = (provider: ImpersonatedProvider) => {
    return provider.auth_user_id === currentUser?.id
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FEF8F1] via-[#F6B398]/20 to-[#FEF8F1] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-[#BF9C73] mx-auto"></div>
          <p className="mt-4 text-[#091747] font-medium">Loading providers...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FEF8F1] via-[#F6B398]/20 to-[#FEF8F1]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={handleBack}
            className="flex items-center text-[#BF9C73] hover:text-[#A8865F] mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Admin Dashboard
          </button>
          <h1 className="text-4xl font-bold text-[#091747] font-['Newsreader'] mb-3">
            Select Provider
          </h1>
          <p className="text-lg text-[#091747]/70">
            Choose a provider to view their dashboard and manage their settings
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-[#091747]/40" />
            <input
              type="text"
              placeholder="Search by name, email, or title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent"
            />
          </div>
        </div>

        {/* Provider Count */}
        <div className="mb-4 text-sm text-[#091747]/60">
          Showing {filteredProviders.length} of {providers.length} providers
        </div>

        {/* Provider Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProviders.map((provider) => (
            <button
              key={provider.id}
              onClick={() => handleSelectProvider(provider)}
              className="bg-white rounded-xl p-6 shadow-sm border border-stone-200 hover:border-[#BF9C73] hover:shadow-md transition-all duration-200 text-left group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-[#BF9C73] to-[#F6B398] rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                    <span className="text-white font-semibold text-lg">
                      {provider.first_name[0]}{provider.last_name[0]}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-[#091747] font-['Newsreader']">
                      {provider.first_name} {provider.last_name}
                      {isCurrentAdmin(provider) && (
                        <span className="ml-2 text-sm text-[#BF9C73] font-normal">(You)</span>
                      )}
                    </h3>
                    <p className="text-sm text-[#091747]/60">{provider.title}</p>
                  </div>
                </div>
                {getProviderStatusChip(provider)}
              </div>

              <div className="space-y-1">
                <div className="flex items-center text-sm text-[#091747]/70">
                  <span className="font-medium mr-2">Email:</span>
                  <span>{provider.email}</span>
                </div>
                <div className="flex items-center text-sm text-[#091747]/70">
                  <span className="font-medium mr-2">Role:</span>
                  <span className="capitalize">{provider.role.replace('_', ' ')}</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-stone-100">
                <div className="flex items-center justify-end text-sm text-[#BF9C73] group-hover:text-[#A8865F] transition-colors">
                  <span className="font-medium">View Dashboard</span>
                  <User className="w-4 h-4 ml-2" />
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* No Results */}
        {filteredProviders.length === 0 && (
          <div className="text-center py-12">
            <UserX className="h-16 w-16 text-[#091747]/30 mx-auto mb-4" />
            <p className="text-lg text-[#091747]/60">No providers found</p>
            <p className="text-sm text-[#091747]/50 mt-2">Try adjusting your search query</p>
          </div>
        )}
      </div>
    </div>
  )
}
