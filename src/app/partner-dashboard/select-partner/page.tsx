'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Database } from '@/types/database'
import { partnerImpersonationManager, ImpersonatedPartner } from '@/lib/partner-impersonation'
import { authContextManager } from '@/lib/auth-context'
import { isAdminEmail } from '@/lib/admin-auth'
import { User, UserCheck, UserX, Search, ArrowLeft, Building2 } from 'lucide-react'

export default function SelectPartnerPage() {
  const [partners, setPartners] = useState<ImpersonatedPartner[]>([])
  const [filteredPartners, setFilteredPartners] = useState<ImpersonatedPartner[]>([])
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
    // Filter partners based on search query
    if (searchQuery.trim() === '') {
      setFilteredPartners(partners)
    } else {
      const query = searchQuery.toLowerCase()
      const filtered = partners.filter(partner =>
        partner.full_name.toLowerCase().includes(query) ||
        partner.email.toLowerCase().includes(query) ||
        partner.role.toLowerCase().includes(query) ||
        partner.organization?.name?.toLowerCase().includes(query)
      )
      setFilteredPartners(filtered)
    }
  }, [searchQuery, partners])

  const loadData = async () => {
    try {
      // Verify user is admin
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !isAdminEmail(user.email || '')) {
        router.replace('/partner-dashboard')
        return
      }

      setCurrentUser(user)
      setIsAdmin(true)

      // Load all partners
      const allPartners = await partnerImpersonationManager.getAllPartners()
      setPartners(allPartners)
      setFilteredPartners(allPartners)
    } catch (error) {
      console.error('Error loading partners:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectPartner = async (partner: ImpersonatedPartner) => {
    if (!currentUser) return

    // Set impersonation context
    partnerImpersonationManager.setImpersonatedPartner(partner, currentUser.email)

    // Log the impersonation start
    await partnerImpersonationManager.logAdminAction({
      partnerId: partner.id,
      actionType: 'partner_impersonation_start',
      description: `Admin ${currentUser.email} started viewing as ${partner.full_name} (${partner.organization?.name || 'No org'})`
    })

    // Navigate to partner dashboard
    router.push('/partner-dashboard')
  }

  const handleBack = () => {
    // Clear any existing impersonation and return to admin
    partnerImpersonationManager.clearImpersonation()
    authContextManager.setActiveContext('admin')
    router.push('/admin')
  }

  const getPartnerStatusChip = (partner: ImpersonatedPartner) => {
    if (!partner.is_active) {
      return (
        <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-stone-200 text-stone-700 rounded-full">
          <UserX className="w-3 h-3 mr-1" />
          Inactive
        </span>
      )
    }

    if (!partner.auth_user_id) {
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

  const isCurrentAdmin = (partner: ImpersonatedPartner) => {
    return partner.auth_user_id === currentUser?.id
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-moonlit-cream via-moonlit-peach/20 to-moonlit-cream flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-moonlit-brown mx-auto"></div>
          <p className="mt-4 text-moonlit-navy font-medium">Loading partners...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-moonlit-cream via-moonlit-peach/20 to-moonlit-cream">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={handleBack}
            className="flex items-center text-moonlit-brown hover:text-[#A8865F] mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Admin Dashboard
          </button>
          <h1 className="text-4xl font-bold text-moonlit-navy font-['Newsreader'] mb-3">
            Select Partner
          </h1>
          <p className="text-lg text-moonlit-navy/70">
            Choose a partner to view their dashboard and assist with their experience
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-moonlit-navy/40" />
            <input
              type="text"
              placeholder="Search by name, email, role, or organization..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-moonlit-brown focus:border-transparent"
            />
          </div>
        </div>

        {/* Partner Count */}
        <div className="mb-4 text-sm text-moonlit-navy/60">
          Showing {filteredPartners.length} of {partners.length} partners
        </div>

        {/* Partner Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredPartners.map((partner) => (
            <button
              key={partner.id}
              onClick={() => handleSelectPartner(partner)}
              className="bg-white rounded-xl p-6 shadow-sm border border-stone-200 hover:border-moonlit-brown hover:shadow-md transition-all duration-200 text-left group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-moonlit-brown to-moonlit-peach rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                    <span className="text-white font-semibold text-lg">
                      {partner.full_name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-moonlit-navy font-['Newsreader']">
                      {partner.full_name}
                      {isCurrentAdmin(partner) && (
                        <span className="ml-2 text-sm text-moonlit-brown font-normal">(You)</span>
                      )}
                    </h3>
                    <p className="text-sm text-moonlit-navy/60 capitalize">
                      {partner.role.replace('partner_', '').replace('_', ' ')}
                    </p>
                  </div>
                </div>
                {getPartnerStatusChip(partner)}
              </div>

              <div className="space-y-1">
                <div className="flex items-center text-sm text-moonlit-navy/70">
                  <span className="font-medium mr-2">Email:</span>
                  <span>{partner.email}</span>
                </div>
                {partner.organization && (
                  <div className="flex items-center text-sm text-moonlit-navy/70">
                    <Building2 className="w-3 h-3 mr-2" />
                    <span className="font-medium mr-2">Organization:</span>
                    <span>{partner.organization.name}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-stone-100">
                <div className="flex items-center justify-end text-sm text-moonlit-brown group-hover:text-[#A8865F] transition-colors">
                  <span className="font-medium">View Dashboard</span>
                  <User className="w-4 h-4 ml-2" />
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* No Results */}
        {filteredPartners.length === 0 && (
          <div className="text-center py-12">
            <UserX className="h-16 w-16 text-moonlit-navy/30 mx-auto mb-4" />
            <p className="text-lg text-moonlit-navy/60">No partners found</p>
            <p className="text-sm text-moonlit-navy/50 mt-2">Try adjusting your search query</p>
          </div>
        )}
      </div>
    </div>
  )
}
