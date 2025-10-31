'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { partnerImpersonationManager, ImpersonatedPartner } from '@/lib/partner-impersonation'
import { ChevronDown, User, UserCheck, UserX, RefreshCcw, Search, Building2 } from 'lucide-react'

export default function PartnerSelector() {
  const [isOpen, setIsOpen] = useState(false)
  const [currentPartner, setCurrentPartner] = useState<ImpersonatedPartner | null>(null)
  const [partners, setPartners] = useState<ImpersonatedPartner[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredPartners, setFilteredPartners] = useState<ImpersonatedPartner[]>([])
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    loadCurrentPartner()
    loadPartners()
  }, [])

  useEffect(() => {
    // Filter partners based on search
    if (searchQuery.trim() === '') {
      setFilteredPartners(partners)
    } else {
      const query = searchQuery.toLowerCase()
      const filtered = partners.filter(partner =>
        partner.full_name.toLowerCase().includes(query) ||
        partner.email.toLowerCase().includes(query) ||
        partner.organization?.name?.toLowerCase().includes(query)
      )
      setFilteredPartners(filtered)
    }
  }, [searchQuery, partners])

  const loadCurrentPartner = () => {
    const impersonation = partnerImpersonationManager.getImpersonatedPartner()
    if (impersonation) {
      setCurrentPartner(impersonation.partner)
    }
  }

  const loadPartners = async () => {
    const allPartners = await partnerImpersonationManager.getAllPartners()
    setPartners(allPartners)
    setFilteredPartners(allPartners)
  }

  const handleSelectPartner = async (partner: ImpersonatedPartner) => {
    setLoading(true)
    setIsOpen(false)
    setSearchQuery('')

    // Get current user for logging
    const impersonation = partnerImpersonationManager.getImpersonatedPartner()
    const adminEmail = impersonation?.impersonatedBy || 'unknown'

    // Update impersonation
    partnerImpersonationManager.setImpersonatedPartner(partner, adminEmail)

    // Log the switch
    await partnerImpersonationManager.logAdminAction({
      partnerId: partner.id,
      actionType: 'partner_impersonation_switch',
      description: `Admin switched to viewing as ${partner.full_name} (${partner.organization?.name || 'No org'})`
    })

    // Refresh page to load new partner data
    window.location.reload()
  }

  const handleChangePartner = () => {
    setIsOpen(false)
    router.push('/partner-dashboard/select-partner')
  }

  const getPartnerStatusIcon = (partner: ImpersonatedPartner) => {
    if (!partner.is_active) {
      return <UserX className="w-3 h-3 text-stone-500" />
    }
    if (!partner.auth_user_id) {
      return <UserX className="w-3 h-3 text-amber-600" />
    }
    return <UserCheck className="w-3 h-3 text-green-600" />
  }

  if (!currentPartner) {
    return (
      <div className="text-sm text-white/70 px-3 py-2">
        Loading partner...
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
            {currentPartner.full_name}
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
            {/* Current Partner */}
            <div className="px-4 py-3 border-b border-stone-100 bg-moonlit-brown/5">
              <p className="text-xs text-stone-500 font-medium uppercase tracking-wider mb-2">
                Currently Viewing
              </p>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-moonlit-brown to-moonlit-peach rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold text-sm">
                    {currentPartner.full_name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-moonlit-navy truncate">
                    {currentPartner.full_name}
                  </p>
                  <p className="text-xs text-moonlit-navy/60 truncate">{currentPartner.email}</p>
                  {currentPartner.organization && (
                    <p className="text-xs text-moonlit-navy/50 truncate flex items-center mt-0.5">
                      <Building2 className="w-3 h-3 mr-1" />
                      {currentPartner.organization.name}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Search */}
            <div className="px-4 py-3 border-b border-stone-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-stone-400" />
                <input
                  type="text"
                  placeholder="Search partners..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-moonlit-brown focus:border-transparent"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>

            {/* Partner List */}
            <div className="overflow-y-auto flex-1">
              <div className="px-2 py-2">
                <p className="text-xs text-stone-500 font-medium uppercase tracking-wider mb-2 px-2">
                  Switch To ({filteredPartners.length})
                </p>
                <div className="space-y-1 max-h-[250px] overflow-y-auto">
                  {filteredPartners.map((partner) => (
                    <button
                      key={partner.id}
                      onClick={() => handleSelectPartner(partner)}
                      disabled={partner.id === currentPartner.id}
                      className={`w-full flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
                        partner.id === currentPartner.id
                          ? 'bg-moonlit-brown/10 text-moonlit-brown cursor-default'
                          : 'text-stone-700 hover:bg-stone-50'
                      }`}
                    >
                      <div className="w-8 h-8 bg-gradient-to-br from-moonlit-brown to-moonlit-peach rounded-full flex items-center justify-center mr-3">
                        <span className="text-white font-medium text-xs">
                          {partner.full_name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                        </span>
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <p className="font-medium truncate">
                          {partner.full_name}
                        </p>
                        <p className="text-xs text-stone-500 truncate">
                          {partner.organization?.name || 'No organization'}
                        </p>
                      </div>
                      {getPartnerStatusIcon(partner)}
                    </button>
                  ))}
                </div>

                {filteredPartners.length === 0 && (
                  <div className="text-center py-6">
                    <UserX className="h-8 w-8 text-stone-300 mx-auto mb-2" />
                    <p className="text-sm text-stone-500">No partners found</p>
                  </div>
                )}
              </div>
            </div>

            {/* View All Link */}
            <div className="px-4 py-3 border-t border-stone-100">
              <button
                onClick={handleChangePartner}
                className="w-full text-sm text-moonlit-brown hover:text-[#A8865F] font-medium transition-colors text-center"
              >
                View All Partners
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
