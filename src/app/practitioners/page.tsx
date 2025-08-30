'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import ProviderCard from '@/components/shared/ProviderCard'
import { Provider } from '@/types/provider'

export default function PractitionersPage() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedState, setSelectedState] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const fetchProviders = async () => {
      try {
        // Fetch providers for a default payer to get the list
        const response = await fetch('/api/patient-booking/providers-for-payer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            payer_id: 'a01d69d6-ae70-4917-afef-49b5ef7e5220', // Default Utah Medicaid
            language: 'English' 
          })
        })
        
        if (response.ok) {
          const data = await response.json()
          console.log('🔍 Practitioners API response:', data)
          
          // Handle API response: { success: true, data: { providers: [...] } }
          let fetchedProviders = []
          if (data.success && data.data && Array.isArray(data.data.providers)) {
            fetchedProviders = data.data.providers
          }
          
          console.log('📋 Setting providers array:', fetchedProviders, 'length:', fetchedProviders.length)
          setProviders(Array.isArray(fetchedProviders) ? fetchedProviders : [])
        }
      } catch (error) {
        console.error('Failed to fetch providers:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchProviders()
  }, [])

  const filteredProviders = (Array.isArray(providers) ? providers : []).filter(provider => {
    // Search filter
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase()
      const fullName = provider.full_name || `${provider.first_name} ${provider.last_name}`
      const matchesName = fullName.toLowerCase().includes(searchLower)
      const matchesSpecialty = provider.specialties?.some(s => s.toLowerCase().includes(searchLower)) ||
                               provider.specialty?.toLowerCase().includes(searchLower)
      
      if (!matchesName && !matchesSpecialty) return false
    }
    
    
    // State filter
    if (selectedState !== 'all') {
      const hasStateLicense = provider.state_licenses?.some(
        license => license.toLowerCase().includes(selectedState.toLowerCase())
      )
      if (!hasStateLicense) return false
    }
    
    return true
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FEF8F1] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-[#BF9C73] border-t-transparent mx-auto mb-4"></div>
          <p className="text-[#091747] font-['Newsreader']">Loading our practitioners...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[#FEF8F1] min-h-screen">
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-['Newsreader'] font-light text-[#091747] mb-6">
            Our Practitioners
          </h1>
          <p className="text-xl text-[#091747]/70 max-w-3xl mx-auto font-['Newsreader'] leading-relaxed">
            We only work with physicians with the best training — both in medicine and in bedside manner.
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl p-6 mb-12 shadow-lg">
          <div className="flex flex-col lg:flex-row gap-6 items-center justify-between">
            {/* Search Bar */}
            <div className="w-full lg:w-1/3">
              <label className="block text-sm text-[#091747] font-['Newsreader'] mb-2">
                Search practitioners
              </label>
              <input
                type="text"
                placeholder="Search by name or specialty..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 font-['Newsreader'] focus:ring-2 focus:ring-[#BF9C73] focus:border-[#BF9C73]"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-center">
              {/* State Filter */}
              <div>
                <label className="block text-sm text-[#091747] font-['Newsreader'] mb-2">
                  Select your state
                </label>
                <select
                  value={selectedState}
                  onChange={(e) => setSelectedState(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 font-['Newsreader'] focus:ring-2 focus:ring-[#BF9C73] focus:border-[#BF9C73]"
                >
                  <option value="all">All States</option>
                  <option value="utah">Utah</option>
                  <option value="idaho">Idaho</option>
                </select>
              </div>

            </div>
          </div>

          {/* Filter Results Summary */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-sm text-[#091747]/70 font-['Newsreader']">
              Showing {filteredProviders.length} of {Array.isArray(providers) ? providers.length : 0} practitioners
              {searchQuery && ` matching "${searchQuery}"`}
              {selectedState !== 'all' && ` in ${selectedState}`}
            </p>
          </div>
        </div>

        {/* Provider Cards Grid */}
        {filteredProviders.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredProviders.map((provider) => (
              <ProviderCard
                key={provider.id}
                provider={provider}
                variant="directory"
                showAvailability={true}
                showLicensing={true}
                showSpecialties={true}
                showInsurance={true}
                actionButton={{
                  text: `Book ${provider.first_name ? `Dr. ${provider.last_name}` : 'Appointment'}`,
                  onClick: () => {
                    window.location.href = `/book?provider=${provider.id}`
                  },
                  variant: 'primary'
                }}
              />
            ))}
          </div>
        ) : (
          // No Results Message
          <div className="text-center py-12">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-xl text-[#091747] font-['Newsreader'] mb-2">
              No practitioners found
            </h3>
            <p className="text-[#091747]/70 font-['Newsreader'] text-lg mb-6">
              {searchQuery ? `No practitioners match "${searchQuery}"` : 'No practitioners match your current filters'}. 
              Please try adjusting your search or filters.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="px-6 py-3 bg-[#BF9C73] hover:bg-[#A8865F] text-white rounded-lg font-['Newsreader'] transition-colors"
                >
                  Clear search
                </button>
              )}
              {selectedState !== 'all' && (
                <button
                  onClick={() => {
                    setSelectedState('all')
                  }}
                  className="px-6 py-3 bg-white hover:bg-[#FEF8F1] text-[#091747] rounded-lg font-['Newsreader'] border-2 border-[#BF9C73] transition-colors"
                >
                  Clear all filters
                </button>
              )}
            </div>
          </div>
        )}

        {/* Call-to-Action Section */}
        {filteredProviders.length > 0 && (
          <div className="mt-16 text-center bg-white rounded-2xl p-8 shadow-lg">
            <h2 className="text-2xl font-['Newsreader'] text-[#091747] mb-4">
              Ready to get started?
            </h2>
            <p className="text-lg text-[#091747]/70 font-['Newsreader'] mb-6">
              Book your appointment with any of our practitioners today.
            </p>
            <Link
              href="/book"
              className="inline-block px-8 py-4 bg-[#BF9C73] hover:bg-[#A8865F] text-white text-lg font-['Newsreader'] rounded-xl transition-colors hover:shadow-lg"
            >
              Start Booking Process
            </Link>
          </div>
        )}
      </section>
    </div>
  )
}