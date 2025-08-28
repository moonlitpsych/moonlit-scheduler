'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Provider {
  id: string
  first_name: string
  last_name: string
  title?: string
  profile_image_url?: string
  bio?: string
  specialties?: string[]
  languages_spoken?: string[]
  accepts_new_patients: boolean
  state_licenses?: string[]
  accepted_insurances?: string[]
}

interface Payer {
  id: string
  name: string
}

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [payers, setPayers] = useState<Payer[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedState, setSelectedState] = useState<string>('all')

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
          if (data.success && data.providers) {
            setProviders(data.providers)
          }
        }
      } catch (error) {
        console.error('Failed to fetch providers:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchProviders()
  }, [])

  const filteredProviders = providers.filter(provider => {
    if (selectedState !== 'all') {
      const hasStateLicense = provider.state_licenses?.some(
        license => license.toLowerCase().includes(selectedState.toLowerCase())
      )
      if (!hasStateLicense) return false
    }
    
    return true
  })

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`
  }

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
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4">
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
        </div>

        {/* Provider Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredProviders.map((provider) => (
            <div key={provider.id} className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300">
              {/* Provider Image */}
              <div className="p-6 text-center border-b border-gray-100">
                {provider.profile_image_url ? (
                  <img
                    src={provider.profile_image_url}
                    alt={`${provider.first_name} ${provider.last_name}`}
                    className="w-20 h-20 rounded-full mx-auto object-cover"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-[#BF9C73] flex items-center justify-center mx-auto text-white font-bold text-xl font-['Newsreader']">
                    {getInitials(provider.first_name, provider.last_name)}
                  </div>
                )}
                
                <h3 className="text-xl text-[#091747] font-['Newsreader'] mt-4">
                  {provider.first_name} {provider.last_name}
                  {provider.title && `, ${provider.title}`}
                </h3>
              </div>

              {/* Provider Info */}
              <div className="p-6">
                {/* Accepting New Patients Badge */}
                <div className="mb-4">
                  {provider.accepts_new_patients ? (
                    <span className="inline-block px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full font-['Newsreader']">
                      ✓ Accepting new patients
                    </span>
                  ) : (
                    <span className="inline-block px-3 py-1 bg-orange-100 text-orange-800 text-sm rounded-full font-['Newsreader']">
                      Waitlist available
                    </span>
                  )}
                </div>

                {/* Licensed In */}
                {provider.state_licenses && provider.state_licenses.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm text-[#091747]/60 font-['Newsreader'] mb-1">Licensed in</p>
                    <div className="flex flex-wrap gap-1">
                      {provider.state_licenses.map((license, index) => (
                        <span
                          key={index}
                          className="inline-block px-2 py-1 text-xs bg-[#BF9C73]/20 text-[#BF9C73] rounded font-['Newsreader']"
                        >
                          {license}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Specialties */}
                {provider.specialties && provider.specialties.length > 0 && (
                  <div className="mb-4">
                    <div className="flex flex-wrap gap-1">
                      {provider.specialties.slice(0, 3).map((specialty, index) => (
                        <span
                          key={index}
                          className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded font-['Newsreader']"
                        >
                          {specialty}
                        </span>
                      ))}
                      {provider.specialties.length > 3 && (
                        <span className="text-xs text-[#091747]/60 font-['Newsreader']">
                          +{provider.specialties.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Insurance Coverage */}
                <div className="mb-6">
                  <div className="grid grid-cols-1 gap-2 text-sm">
                    <div className="flex flex-wrap gap-1">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-['Newsreader']">Cash | Credit card | ACH</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-['Newsreader']">Utah Medicaid Fee-for-Service</span>
                    </div>
                  </div>
                </div>

                {/* Book Button */}
                <Link
                  href={`/book?provider=${provider.id}`}
                  className="w-full bg-[#BF9C73] hover:bg-[#A8865F] text-white py-3 px-4 rounded-lg font-['Newsreader'] text-center block transition-colors"
                >
                  Book {provider.first_name ? `Dr. ${provider.last_name}` : 'Appointment'}
                </Link>

                {/* About Provider Link */}
                <button className="w-full mt-2 text-[#BF9C73] hover:text-[#A8865F] text-sm font-['Newsreader'] py-2 transition-colors">
                  ► About {provider.first_name ? `Dr. ${provider.last_name}` : 'Provider'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* No Results Message */}
        {filteredProviders.length === 0 && (
          <div className="text-center py-12">
            <p className="text-[#091747]/70 font-['Newsreader'] text-lg">
              No practitioners match your current filters. Please try adjusting your selection.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}