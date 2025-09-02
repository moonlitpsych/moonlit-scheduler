'use client'

import { useState, useEffect } from 'react'

interface Payer {
  id: string
  name: string
  payer_type: string
  state: string
  credentialing_status: string
  effective_date: string | null
  projected_effective_date: string | null
}

interface GroupedPayers {
  [state: string]: {
    active: Payer[]
    projected: Payer[]
    selfPay: Payer[]
  }
}

const StatusIcon = ({ status, effectiveDate }: { status: string; effectiveDate: string | null }) => {
  if (status === 'active' && effectiveDate) {
    return <span className="text-green-600 text-sm">✓</span>
  }
  return null
}

const StatusText = ({ payer }: { payer: Payer }) => {
  // For approved payers with effective date
  if (payer.credentialing_status === 'approved' && payer.effective_date) {
    const effectiveDate = new Date(payer.effective_date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    if (effectiveDate <= today) {
      return (
        <span className="text-green-600 text-sm font-medium" style={{ fontFamily: 'Newsreader, serif' }}>
          ✓ Currently in-network — accepting patients
        </span>
      )
    } else {
      const formattedDate = effectiveDate.toLocaleDateString('en-US', { 
        year: 'numeric',
        month: 'long', 
        day: 'numeric' 
      })
      return (
        <span className="text-gray-600 text-sm" style={{ fontFamily: 'Newsreader, serif' }}>
          In-network starting {formattedDate}
        </span>
      )
    }
  }
  
  // For approved payers with projected effective date only
  if (payer.credentialing_status === 'approved' && payer.projected_effective_date) {
    const projectedDate = new Date(payer.projected_effective_date)
    const formattedDate = projectedDate.toLocaleDateString('en-US', { 
      year: 'numeric',
      month: 'long', 
      day: 'numeric' 
    })
    return (
      <span className="text-gray-600 text-sm" style={{ fontFamily: 'Newsreader, serif' }}>
        In-network starting {formattedDate}
      </span>
    )
  }

  // For self-pay options - different text
  if (payer.payer_type === 'self_pay') {
    return (
      <span className="text-green-600 text-sm font-medium" style={{ fontFamily: 'Newsreader, serif' }}>
        ✓ Currently accepting patients
      </span>
    )
  }
  
  return null
}

const SearchResultCard = ({ payer }: { payer: Payer }) => {
  // Determine status for search results
  const getPayerStatus = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    if (payer.payer_type === 'self_pay') {
      return { type: 'active', text: 'Available now', icon: 'check' }
    }
    
    if (payer.credentialing_status === 'approved' && payer.effective_date) {
      const effectiveDate = new Date(payer.effective_date)
      if (effectiveDate <= today) {
        return { type: 'active', text: 'We accept this insurance', icon: 'check' }
      } else {
        const formattedDate = effectiveDate.toLocaleDateString('en-US', { 
          year: 'numeric',
          month: 'long', 
          day: 'numeric' 
        })
        return { type: 'future', text: `Available starting ${formattedDate}`, icon: 'calendar' }
      }
    }
    
    return { type: 'unknown', text: 'Contact us for status', icon: 'clock' }
  }

  const status = getPayerStatus()

  return (
    <div className="w-full p-4 border-2 border-gray-200 rounded-xl hover:border-[#BF9C73] hover:bg-[#BF9C73]/5 transition-all duration-200 bg-white">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {/* Status Icon */}
          <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
            status.type === 'active' 
              ? 'bg-green-100' 
              : status.type === 'future' 
                ? 'bg-blue-100' 
                : 'bg-gray-100'
          }`}>
            {status.icon === 'check' && (
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
            {status.icon === 'calendar' && (
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            )}
            {status.icon === 'clock' && (
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>
          
          {/* Payer Info */}
          <div>
            <h3 className="font-semibold text-gray-900" style={{ fontFamily: 'Newsreader, serif' }}>
              {payer.name}
            </h3>
            <p className="text-sm text-gray-500" style={{ fontFamily: 'Newsreader, serif' }}>
              {status.text}
            </p>
            {payer.state && (
              <p className="text-xs text-gray-400 mt-1" style={{ fontFamily: 'Newsreader, serif' }}>
                State: {payer.state}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const PayerCard = ({ payer, showStatus = true, isEven = false }: { payer: Payer; showStatus?: boolean; isEven?: boolean }) => {
  // Check if payer is currently active
  const isActive = (() => {
    if (payer.payer_type === 'self_pay') return true
    if (payer.credentialing_status === 'approved' && payer.effective_date) {
      const effectiveDate = new Date(payer.effective_date)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      return effectiveDate <= today
    }
    return false
  })()

  // Check if payer has future effective date
  const hasFutureDate = (() => {
    if (payer.credentialing_status === 'approved' && payer.effective_date) {
      const effectiveDate = new Date(payer.effective_date)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      return effectiveDate > today
    }
    return false
  })()

  // Get status icon
  const getStatusIcon = () => {
    if (isActive) {
      return (
        <div className="flex-shrink-0 w-5 h-5 bg-green-100 rounded-full flex items-center justify-center mr-3">
          <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      )
    } else if (hasFutureDate) {
      return (
        <div className="flex-shrink-0 w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center mr-3">
          <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      )
    }
    return null
  }
  
  return (
    <div className={`py-2 px-3 -mx-3 rounded ${isEven ? 'bg-[#FEF8F1]/30' : 'bg-transparent'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center flex-1 min-w-0">
          {getStatusIcon()}
          <div className={`
            inline-block px-2 py-1 rounded text-sm font-medium mr-4
            ${isActive 
              ? 'bg-[#BF9C73] bg-opacity-20 text-[#BF9C73]' 
              : hasFutureDate
                ? 'bg-[#BF9C73] bg-opacity-10 text-[#BF9C73] opacity-50'
                : 'bg-gray-100 text-gray-600'
            }
          `} style={{ fontFamily: 'Newsreader, serif' }}>
            {payer.name}
          </div>
        </div>
        {showStatus && (
          <div className="text-right text-sm flex-shrink-0">
            <StatusText payer={payer} />
          </div>
        )}
      </div>
    </div>
  )
}

const StateSection = ({ stateName, payers }: { stateName: string; payers: GroupedPayers[string] }) => {
  const stateIcon = stateName === 'Utah' ? '/images/utah-icon.png' : '/images/Idaho-icon.png'
  
  // Sort payers by effective date (active first, then by date)
  const sortedActive = [...payers.active].sort((a, b) => {
    if (!a.effective_date && !b.effective_date) return 0
    if (!a.effective_date) return 1
    if (!b.effective_date) return -1
    return new Date(a.effective_date).getTime() - new Date(b.effective_date).getTime()
  })

  const sortedProjected = [...payers.projected].sort((a, b) => {
    if (!a.projected_effective_date && !b.projected_effective_date) return 0
    if (!a.projected_effective_date) return 1
    if (!b.projected_effective_date) return -1
    return new Date(a.projected_effective_date).getTime() - new Date(b.projected_effective_date).getTime()
  })

  // ONLY payers with effective dates should appear in main sections
  // These are all in 'active' from the API (approved + effective_date)
  const mainMedicaid = payers.active.filter(p => 
    p.payer_type === 'Medicaid' || p.payer_type === 'medicaid'
  )
  const mainPrivate = payers.active.filter(p => 
    p.payer_type === 'Private' || p.payer_type === 'private'  
  )
  
  // ALL projected payers go to "Coming Soon" section (no effective dates)
  const remainingProjected = payers.projected

  return (
    <div className="mb-10">
      {/* State Header */}
      <div className="flex items-center gap-3 mb-6">
        <img src={stateIcon} alt={`${stateName} icon`} className="w-5 h-5" />
        <h2 className="text-xl font-medium" style={{ color: '#091747', fontFamily: 'Newsreader, serif' }}>
          {stateName.toUpperCase()}
        </h2>
      </div>

      <div className="space-y-6">
        {/* Medicaid Section - ONLY approved payers with effective dates */}
        {mainMedicaid.length > 0 && (
          <div>
            <h3 className="text-lg font-medium mb-2 pb-1 border-b border-gray-200" style={{ color: '#091747', fontFamily: 'Newsreader, serif' }}>
              {stateName} Medicaid
            </h3>
            <div className="">
              {mainMedicaid.map((payer, index) => (
                <PayerCard key={payer.id} payer={payer} isEven={index % 2 === 0} />
              ))}
            </div>
          </div>
        )}

        {/* Private Insurance Section - ONLY approved payers with effective dates */}
        {mainPrivate.length > 0 && (
          <div>
            <h3 className="text-lg font-medium mb-2 pb-1 border-b border-gray-200" style={{ color: '#091747', fontFamily: 'Newsreader, serif' }}>
              {stateName} Private Insurance
            </h3>
            <div className="">
              {mainPrivate.map((payer, index) => (
                <PayerCard key={payer.id} payer={payer} isEven={index % 2 === 0} />
              ))}
            </div>
          </div>
        )}

        {/* Self-Pay Section */}
        {payers.selfPay.length > 0 && (
          <div>
            <h3 className="text-lg font-medium mb-2 pb-1 border-b border-gray-200" style={{ color: '#091747', fontFamily: 'Newsreader, serif' }}>
              {stateName} Self-Pay
            </h3>
            <div className="">
              {payers.selfPay.map((payer, index) => (
                <PayerCard key={payer.id} payer={payer} isEven={index % 2 === 0} />
              ))}
            </div>
          </div>
        )}

        {/* Coming Soon Section - ALL payers without effective dates */}
        {remainingProjected.length > 0 && (
          <div className="pt-4 mt-6 border-t border-gray-200">
            <p className="text-sm text-gray-600 mb-3" style={{ fontFamily: 'Newsreader, serif' }}>
              Joining an insurance network can take time — months, in some cases. We are in the process of applying for and being able to accept the following payment methods:
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1">
              {remainingProjected.map((payer, index) => (
                <div key={payer.id} className="text-sm px-2 py-1 bg-gray-100 text-gray-600 rounded" style={{ fontFamily: 'Newsreader, serif' }}>
                  {payer.name}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function WaysToPayPage() {
  const [groupedPayers, setGroupedPayers] = useState<GroupedPayers>({})
  const [allPayers, setAllPayers] = useState<Payer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<Payer[]>([])
  const [showSearch, setShowSearch] = useState(false)

  useEffect(() => {
    const fetchPayers = async () => {
      try {
        const response = await fetch('/api/ways-to-pay/payers')
        if (!response.ok) {
          throw new Error('Failed to fetch payers')
        }
        const data = await response.json()
        setGroupedPayers(data)
        
        // Flatten only payers that actually appear in main sections for search
        const flatPayers: Payer[] = []
        Object.values(data).forEach((statePayers: any) => {
          // Only include:
          // 1. Active payers (approved with effective dates) - these show in main sections
          // 2. Self-pay options - these always show
          flatPayers.push(...statePayers.active, ...statePayers.selfPay)
          
          // DO NOT include projected payers - even if approved, they only show in "Coming Soon"
          // and shouldn't appear in search as if we accept them
        })
        setAllPayers(flatPayers)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchPayers()
  }, [])

  // Fuzzy search effect
  useEffect(() => {
    if (searchTerm.length > 1) {
      const filtered = allPayers.filter(payer => 
        payer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payer.payer_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payer.state.toLowerCase().includes(searchTerm.toLowerCase())
      )
      setSearchResults(filtered)
      setShowSearch(true)
    } else {
      setSearchResults([])
      setShowSearch(false)
    }
  }, [searchTerm, allPayers])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading payment options...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Error loading payment options: {error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-cream-50" style={{ backgroundColor: '#FEF8F1', fontFamily: 'Newsreader, serif' }}>
        <div className="max-w-4xl mx-auto px-6 py-12">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-light text-navy-900 mb-4" style={{ color: '#091747' }}>
              Ways to pay for a Moonlit visit
            </h1>
            <p className="text-lg text-gray-700 max-w-2xl mx-auto mb-6">
              Verify which payers your physician accepts on the Our Practitioners page.
            </p>
            
            {/* Search Bar */}
            <div className="max-w-md mx-auto mb-6">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search for your insurance..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-[#BF9C73] outline-none"
                  style={{ fontFamily: 'Newsreader, serif' }}
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Search Results */}
          {showSearch && (
            <div className="mb-12">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-light" style={{ color: '#091747', fontFamily: 'Newsreader, serif' }}>
                    Search Results for "{searchTerm}"
                  </h2>
                  {searchResults.length > 0 && (
                    <p className="text-sm text-gray-500 mt-1" style={{ fontFamily: 'Newsreader, serif' }}>
                      Found {searchResults.length} matching insurance plan{searchResults.length > 1 ? 's' : ''}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => {
                    setSearchTerm('')
                    setShowSearch(false)
                  }}
                  className="text-[#BF9C73] hover:text-[#A8865F] text-sm font-medium"
                  style={{ fontFamily: 'Newsreader, serif' }}
                >
                  Clear search
                </button>
              </div>
              
              {searchResults.length > 0 ? (
                <div className="space-y-3">
                  {searchResults.map(payer => (
                    <SearchResultCard key={payer.id} payer={payer} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-gray-400 mb-4">
                    <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <p className="text-gray-600 text-lg" style={{ fontFamily: 'Newsreader, serif' }}>
                    No insurance plans found matching "{searchTerm}"
                  </p>
                  <p className="text-sm text-gray-500 mt-2" style={{ fontFamily: 'Newsreader, serif' }}>
                    Try a different search term
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Main payer listings - hidden when searching */}
          {!showSearch && (
            <div className="space-y-6">
              {/* Ensure Utah comes first, then Idaho, then any others */}
              {Object.entries(groupedPayers)
                .sort(([a], [b]) => {
                  if (a === 'Utah') return -1
                  if (b === 'Utah') return 1
                  if (a === 'Idaho') return -1
                  if (b === 'Idaho') return 1
                  return a.localeCompare(b)
                })
                .map(([state, statePayers]) => (
                  <StateSection 
                    key={state} 
                    stateName={state} 
                    payers={statePayers} 
                  />
                ))}
            </div>
          )}
        </div>
    </div>
  )
}