'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import ProviderCard from '@/components/shared/ProviderCard'
import { Provider } from '@/types/provider'
import { generateProviderSlug } from '@/lib/utils/providerSlug'
import { supabase } from '@/lib/supabase'
import { Payer } from '@/types/database'

export default function PractitionersPage() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedState, setSelectedState] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  
  // Multi-select payer filtering state
  const [selectedPayers, setSelectedPayers] = useState<Payer[]>([])
  const [availablePayers, setAvailablePayers] = useState<Payer[]>([])
  const [showPayerDropdown, setShowPayerDropdown] = useState(false)
  const [payersLoading, setPayersLoading] = useState(false)
  
  // Mobile search state
  const [showMobileFilters, setShowMobileFilters] = useState(false)

  // Load available payers on mount - only contracted payers
  useEffect(() => {
    const loadPayers = async () => {
      setPayersLoading(true)
      try {
        const response = await fetch('/api/payers/contracted')
        const result = await response.json()

        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch contracted payers')
        }

        // Payers are already deduplicated and sorted by the API
        setAvailablePayers(result.data || [])
        console.log('✅ Loaded contracted payers:', result.debug_info)
      } catch (error: any) {
        console.error('Error loading contracted payers:', error)
      } finally {
        setPayersLoading(false)
      }
    }

    loadPayers()
  }, [])

  // Update provider fetching when payer filter changes
  const fetchFilteredProviders = useCallback(async () => {
    setLoading(true)
    try {
      // If payers are selected, fetch providers for each and combine results
      if (selectedPayers.length > 0) {
        const allProviders = new Map()
        
        for (const payer of selectedPayers) {
          if (payer.id === 'cash-payment') continue // Skip cash payment for API calls
          
          try {
            const response = await fetch('/api/patient-booking/providers-for-payer', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                payer_id: payer.id,
                language: 'English',
                include_co_visit_info: false
              })
            })
            
            if (response.ok) {
              const data = await response.json()
              if (data.success && data.data && Array.isArray(data.data.providers)) {
                // Add providers to our map (using ID as key to avoid duplicates)
                data.data.providers.forEach((provider: any) => {
                  allProviders.set(provider.id, provider)
                })
              }
            }
          } catch (error) {
            console.error(`Error fetching providers for ${payer.name}:`, error)
          }
        }
        
        setProviders(Array.from(allProviders.values()))
      } else {
        // Use the standard all providers endpoint when no payers selected
        const response = await fetch('/api/providers/all')
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.data && Array.isArray(data.data.providers)) {
            setProviders(data.data.providers)
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch filtered providers:', error)
    } finally {
      setLoading(false)
    }
  }, [selectedPayers])

  // Refetch providers when payer selection changes
  useEffect(() => {
    fetchFilteredProviders()
  }, [fetchFilteredProviders])

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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-8 lg:mb-12">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-['Newsreader'] font-light text-[#091747] mb-4 lg:mb-6">
            Our Practitioners
          </h1>
          <p className="text-lg sm:text-xl text-[#091747]/70 max-w-3xl mx-auto font-['Newsreader'] leading-relaxed px-4">
            We only work with physicians with the best training — both in medicine and in bedside manner.
          </p>
        </div>

        {/* Mobile Filter Button */}
        <div className="lg:hidden mb-6">
          <button
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className="w-full flex items-center justify-between bg-white/60 backdrop-blur-sm rounded-xl p-4 shadow-sm border border-white/20"
          >
            <span className="font-['Newsreader'] text-[#091747] font-medium">
              Search & Filter
              {(searchQuery || selectedPayers.length > 0 || selectedState !== 'all') && (
                <span className="ml-2 px-2 py-1 bg-[#BF9C73] text-white text-xs rounded-full">
                  {[searchQuery, ...(selectedPayers.length > 0 ? ['insurance'] : []), ...(selectedState !== 'all' ? ['state'] : [])].filter(Boolean).length}
                </span>
              )}
            </span>
            <svg 
              className={`h-5 w-5 text-[#BF9C73] transition-transform ${showMobileFilters ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left Sidebar - Subtle Search & Filters */}
          <div className={`lg:w-80 flex-shrink-0 ${showMobileFilters ? 'block' : 'hidden lg:block'}`}>
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-white/20 lg:sticky lg:top-8">
              <div className="space-y-6">
                {/* Search Input - Inspired by booking flow */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className={`h-5 w-5 transition-colors ${searchQuery ? 'text-[#BF9C73]' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="Search practitioners..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="
                      w-full bg-stone-50 border-2 border-stone-200 rounded-xl 
                      py-3 pl-12 pr-4 text-sm text-slate-800 placeholder-slate-500 
                      focus:outline-none focus:border-[#BF9C73] focus:bg-white
                      transition-all duration-200 font-['Newsreader']
                    "
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center hover:bg-stone-100 rounded-r-xl transition-colors"
                    >
                      <svg className="h-4 w-4 text-slate-400 hover:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Filter Providers Dropdown */}
                <div className="relative">
                  <label className="block text-sm text-[#091747] font-['Newsreader'] font-medium mb-2">
                    Ways to pay
                  </label>
                  
                  <div className="relative">
                    <button
                      onClick={() => setShowPayerDropdown(!showPayerDropdown)}
                      className="
                        w-full bg-stone-50 border-2 border-stone-200 rounded-xl 
                        py-3 px-4 text-sm text-slate-800
                        focus:outline-none focus:border-[#BF9C73] focus:bg-white
                        transition-all duration-200 font-['Newsreader']
                        flex items-center justify-between
                      "
                    >
                      <span className="text-left">
                        {selectedPayers.length === 0 
                          ? "Filter providers" 
                          : `${selectedPayers.length} insurance type${selectedPayers.length !== 1 ? 's' : ''} selected`
                        }
                      </span>
                      <svg 
                        className={`h-4 w-4 text-slate-400 transition-transform ${showPayerDropdown ? 'rotate-180' : ''}`} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Dropdown Content */}
                    {showPayerDropdown && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-stone-200 rounded-xl shadow-lg">
                        {/* Header */}
                        <div className="px-4 py-3 border-b border-stone-100">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium text-[#091747] font-['Newsreader']">
                              How to pay
                            </h3>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => {
                                  setSelectedPayers(availablePayers.slice())
                                }}
                                className="text-xs text-[#BF9C73] hover:text-[#A8865F] font-['Newsreader']"
                              >
                                select all
                              </button>
                              <span className="text-xs text-slate-400">/</span>
                              <button
                                onClick={() => setSelectedPayers([])}
                                className="text-xs text-[#BF9C73] hover:text-[#A8865F] font-['Newsreader']"
                              >
                                deselect all
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Payer Options */}
                        <div className="max-h-60 overflow-y-auto">
                          {payersLoading ? (
                            <div className="p-4 text-center">
                              <svg className="animate-spin h-4 w-4 text-[#BF9C73] mx-auto" fill="none" viewBox="0 0 24 24">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle>
                                <path fill="currentColor" strokeWidth="4" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"></path>
                              </svg>
                            </div>
                          ) : (
                            availablePayers.map((payer) => {
                              const isSelected = selectedPayers.some(p => p.id === payer.id)
                              return (
                                <label
                                  key={payer.id}
                                  className="flex items-center p-3 hover:bg-stone-50 cursor-pointer border-b border-stone-50 last:border-b-0"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedPayers(prev => [...prev, payer])
                                      } else {
                                        setSelectedPayers(prev => prev.filter(p => p.id !== payer.id))
                                      }
                                    }}
                                    className="
                                      w-4 h-4 text-[#BF9C73] bg-white border-2 border-stone-300 
                                      rounded focus:ring-2 focus:ring-[#BF9C73]/20
                                    "
                                  />
                                  <span className="ml-3 text-sm text-slate-800 font-['Newsreader']">
                                    {payer.name}
                                  </span>
                                </label>
                              )
                            })
                          )}
                        </div>

                        {/* Footer */}
                        <div className="px-4 py-3 border-t border-stone-100 bg-stone-25">
                          <button
                            onClick={() => setShowPayerDropdown(false)}
                            className="
                              w-full py-2 px-4 text-sm text-[#BF9C73] hover:text-[#A8865F] 
                              hover:bg-[#BF9C73]/5 rounded-lg transition-colors 
                              font-['Newsreader'] border border-[#BF9C73]/20
                            "
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Selected Payers Display */}
                  {selectedPayers.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedPayers.map((payer) => (
                        <div
                          key={payer.id}
                          className="inline-flex items-center bg-[#BF9C73]/10 border border-[#BF9C73]/30 rounded-lg px-2 py-1"
                        >
                          <span className="text-xs text-[#091747] font-['Newsreader'] mr-1">
                            {payer.name}
                          </span>
                          <button
                            onClick={() => {
                              setSelectedPayers(prev => prev.filter(p => p.id !== payer.id))
                            }}
                            className="ml-1 p-0.5 hover:bg-[#BF9C73]/20 rounded transition-colors"
                          >
                            <svg className="h-3 w-3 text-[#BF9C73]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* State Filter */}
                <div>
                  <label className="block text-sm text-[#091747] font-['Newsreader'] font-medium mb-2">
                    Licensed in
                  </label>
                  <select
                    value={selectedState}
                    onChange={(e) => setSelectedState(e.target.value)}
                    className="
                      w-full bg-stone-50 border-2 border-stone-200 rounded-xl 
                      py-3 px-4 text-sm text-slate-800 
                      focus:outline-none focus:border-[#BF9C73] focus:bg-white
                      transition-all duration-200 font-['Newsreader']
                    "
                  >
                    <option value="all">All States</option>
                    <option value="utah">Utah</option>
                    <option value="idaho">Idaho</option>
                  </select>
                </div>

                {/* Results Summary */}
                <div className="pt-4 border-t border-stone-200">
                  <p className="text-sm text-[#091747]/70 font-['Newsreader']">
                    {filteredProviders.length} practitioner{filteredProviders.length !== 1 ? 's' : ''}
                    {searchQuery && ` matching "${searchQuery}"`}
                    {selectedPayers.length > 0 && ` accepting ${selectedPayers.length > 1 ? selectedPayers.length + ' insurance types' : selectedPayers[0].name}`}
                    {selectedState !== 'all' && ` in ${selectedState}`}
                  </p>
                </div>

                {/* Clear Filters */}
                {(searchQuery || selectedPayers.length > 0 || selectedState !== 'all') && (
                  <button
                    onClick={() => {
                      setSearchQuery('')
                      setSelectedPayers([])
                      setSelectedState('all')
                      setShowPayerDropdown(false)
                    }}
                    className="
                      w-full py-2 px-4 text-sm text-[#BF9C73] hover:text-[#A8865F] 
                      hover:bg-[#BF9C73]/5 rounded-lg transition-colors 
                      font-['Newsreader'] border border-[#BF9C73]/20
                    "
                  >
                    Clear all filters
                  </button>
                )}

                {/* Mobile: Done Button */}
                <div className="lg:hidden pt-4 border-t border-stone-200">
                  <button
                    onClick={() => setShowMobileFilters(false)}
                    className="
                      w-full py-3 px-4 bg-[#BF9C73] hover:bg-[#A8865F] text-white 
                      rounded-lg transition-colors font-['Newsreader'] text-center
                    "
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content - Provider Cards */}
          <div className="flex-1">
            {filteredProviders.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                {filteredProviders.map((provider) => (
                  <ProviderCard
                    key={provider.id}
                    provider={provider}
                    variant="directory"
                    showAvailability={true}
                    showLicensing={true}
                    showSpecialties={true}
                    showInsurance={true}
                    actionButton={
                      // Only show Book button for bookable providers:
                      // Non-bookable providers (like supervising attendings) should not have book buttons
                      provider.is_bookable !== false ? {
                        text: `Book ${provider.first_name ? `Dr. ${provider.last_name}` : 'Appointment'}`,
                        onClick: () => {
                          window.location.href = `/see-a-psychiatrist-widget`
                        },
                        variant: 'primary'
                      } : undefined // Non-bookable providers get no Book button
                    }
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
              </div>
            )}

            {/* Call-to-Action Section */}
            {filteredProviders.length > 0 && (
              <div className="mt-12 lg:mt-16 text-center bg-white rounded-2xl p-6 lg:p-8 shadow-lg mx-4 lg:mx-0">
                <h2 className="text-xl lg:text-2xl font-['Newsreader'] text-[#091747] mb-3 lg:mb-4">
                  Ready to get started?
                </h2>
                <p className="text-base lg:text-lg text-[#091747]/70 font-['Newsreader'] mb-6">
                  Book your appointment with any of our practitioners today.
                </p>
                <Link
                  href="/see-a-psychiatrist-widget"
                  className="inline-block px-6 lg:px-8 py-3 lg:py-4 bg-[#BF9C73] hover:bg-[#A8865F] text-white text-base lg:text-lg font-['Newsreader'] rounded-xl transition-colors hover:shadow-lg"
                >
                  Start Booking Process
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}