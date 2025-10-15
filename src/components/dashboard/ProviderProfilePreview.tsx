'use client'

import { Database } from '@/types/database'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useToast } from '@/contexts/ToastContext'
import { useEffect, useState } from 'react'
import { Provider } from '@/types/provider'
import { Eye } from 'lucide-react'
import ProviderModal from '@/components/shared/ProviderModal'
import { ProviderModalProvider } from '@/contexts/ProviderModalContext'
import { providerImpersonationManager } from '@/lib/provider-impersonation'

export default function ProviderProfilePreview() {
  const [provider, setProvider] = useState<Provider | null>(null)
  const [loading, setLoading] = useState(true)

  const supabase = createClientComponentClient<Database>()
  const toast = useToast()

  useEffect(() => {
    loadProviderData()
  }, [])

  const loadProviderData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Check for impersonation context first
      const impersonation = providerImpersonationManager.getImpersonatedProvider()

      let providerId: string | null = null

      if (impersonation) {
        // Admin viewing as a provider - use impersonated provider ID
        providerId = impersonation.provider.id
      } else {
        // Regular provider viewing their own profile - get their ID first
        const { data: loadedProvider, error } = await supabase
          .from('providers')
          .select('id')
          .eq('auth_user_id', user.id)
          .eq('is_active', true)
          .single()

        if (error || !loadedProvider) {
          console.error('Provider not found:', error)
          toast.error('Error', 'Provider profile not found')
          return
        }

        providerId = loadedProvider.id
      }

      // Fetch enriched provider data from the same API that practitioners page uses
      const response = await fetch('/api/providers/all')
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data && Array.isArray(data.data.providers)) {
          // Find this provider in the enriched list
          const enrichedProvider = data.data.providers.find((p: any) => p.id === providerId)
          if (enrichedProvider) {
            setProvider(enrichedProvider as Provider)
          } else {
            console.error('Provider not found in enriched list')
            toast.error('Error', 'Provider profile not found')
          }
        }
      }
    } catch (error) {
      console.error('Error loading provider data:', error)
      toast.error('Load Error', 'Failed to load profile data')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#BF9C73]"></div>
      </div>
    )
  }

  if (!provider) {
    return (
      <div className="text-center py-12">
        <p className="text-stone-600">Provider profile not found. Please contact support.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <Eye className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-blue-900 mb-1">Patient View Preview</h3>
          <p className="text-sm text-blue-800">
            This is exactly how patients see your profile when they click on your provider card.
            To update this information, please contact <a href="mailto:hello@trymoonlit.com" className="underline font-medium">hello@trymoonlit.com</a>
          </p>
        </div>
      </div>

      {/* Render the exact modal content inline */}
      <ProviderModalProvider>
        <InlineModalContent provider={provider} />
      </ProviderModalProvider>
    </div>
  )
}

// Component to display modal content inline
function InlineModalContent({ provider }: { provider: Provider }) {
  const [acceptedPayments, setAcceptedPayments] = useState<any[]>([])
  const [paymentsLoading, setPaymentsLoading] = useState(false)
  const [selfPayAvailable, setSelfPayAvailable] = useState(true)

  useEffect(() => {
    if (provider && provider.is_bookable !== false) {
      setPaymentsLoading(true)
      fetch(`/api/providers/${provider.id}/accepted-payments`)
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            setAcceptedPayments(data.data.accepted_payments || [])
            setSelfPayAvailable(data.data.self_pay_available || true)
          }
        })
        .catch(error => {
          console.error('Failed to fetch accepted payments:', error)
        })
        .finally(() => {
          setPaymentsLoading(false)
        })
    }
  }, [provider])

  const getImageUrl = (url: string) => {
    if (!url) return url
    if (url.includes('drive.google.com')) {
      const fileIdMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/)
      if (fileIdMatch) {
        return `https://drive.google.com/uc?export=view&id=${fileIdMatch[1]}`
      }
    }
    return url
  }

  const displayName = provider.full_name || `${provider.first_name} ${provider.last_name}`
  const initials = `${provider.first_name?.charAt(0) || ''}${provider.last_name?.charAt(0) || ''}`
  const uniformChipClass = "inline-block px-3 py-2 text-sm rounded font-['Newsreader'] transition-colors bg-[#BF9C73]/20 text-[#BF9C73]"

  return (
    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden">
      {/* Scrollable Content */}
      <div className="px-8 py-8 overflow-y-auto">
        {/* Provider Image and Name */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 md:gap-8 mb-8">
          {/* Large Provider Image */}
          <div className="flex-shrink-0">
            {provider.profile_image_url ? (
              <div className="relative">
                <img
                  src={getImageUrl(provider.profile_image_url)}
                  alt={displayName}
                  className="w-32 h-40 rounded-2xl object-cover shadow-lg"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.style.display = 'none'
                    target.nextElementSibling?.classList.remove('hidden')
                  }}
                />
                <div className="hidden w-32 h-40 rounded-2xl bg-gradient-to-br from-[#2C5F6F] to-[#1A3A47] flex items-center justify-center text-white font-bold text-3xl font-['Newsreader'] absolute inset-0 shadow-lg">
                  {initials}
                </div>
              </div>
            ) : (
              <div className="w-32 h-40 rounded-2xl bg-gradient-to-br from-[#2C5F6F] to-[#1A3A47] flex items-center justify-center text-white font-bold text-3xl font-['Newsreader'] shadow-lg">
                {initials}
              </div>
            )}
          </div>

          {/* Provider Info */}
          <div className="flex-1 text-center sm:text-left">
            <h1
              className="text-4xl font-['Newsreader'] text-[#091747] font-normal mb-2 leading-tight"
            >
              Dr. {provider.first_name} {provider.last_name}
            </h1>

            {provider.title && (
              <p className="text-xl text-[#BF9C73] font-['Newsreader'] mb-4">
                {provider.title}
              </p>
            )}

            {(provider.provider_type || provider.role) && (
              <span className="inline-block px-4 py-2 bg-[#FEF8F1] text-[#BF9C73] border border-[#BF9C73] text-sm font-medium rounded-full font-['Newsreader'] mb-4">
                {provider.provider_type || provider.role}
              </span>
            )}

            {/* Accepting New Patients - only show for bookable providers */}
            {provider.is_bookable !== false && provider.accepts_new_patients && (
              <div className="mb-6">
                <div className="inline-flex items-center px-4 py-2 bg-[#F0F8F0] text-[#2D5016] rounded-lg font-['Newsreader'] text-sm font-medium border border-[#9BC53D]/30">
                  <span className="w-2 h-2 bg-[#4CAF50] rounded-full mr-2"></span>
                  Accepting new patients
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Provider Details */}
        <div className="space-y-8">
          {/* Focus Areas */}
          {provider.focus_json && provider.focus_json.length > 0 && (
            <div>
              <h3 className="text-lg font-['Newsreader'] text-[#091747] font-medium mb-3">Areas of Focus</h3>
              <div className="flex flex-wrap gap-2">
                {provider.focus_json.map((focus) => (
                  <span
                    key={focus.id}
                    className={uniformChipClass}
                    title={`${focus.type}: ${focus.name}`}
                  >
                    {focus.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* About - no title, just content */}
          {provider.about && (
            <div>
              <p className="text-[#091747]/80 font-['Newsreader'] leading-relaxed">
                {provider.about}
              </p>
            </div>
          )}

          {/* Accepted Forms of Payment - only show for bookable providers */}
          {provider.is_bookable !== false && (
            <div>
              <h3 className="text-lg font-['Newsreader'] text-[#091747] font-medium mb-3">Accepted Forms of Payment</h3>
              <div className="flex flex-wrap gap-2">
                {/* Always show self-pay options for bookable providers */}
                {selfPayAvailable && (
                  <span className="px-3 py-2 bg-[#f28c69] text-white rounded-lg font-['Newsreader'] text-sm border border-[#f28c69] shadow-sm">
                    Cash | Credit Card | ACH
                  </span>
                )}

                {/* Show loading state */}
                {paymentsLoading && (
                  <span className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg font-['Newsreader'] text-sm animate-pulse">
                    Loading insurance information...
                  </span>
                )}

                {/* Show accepted insurance payments */}
                {!paymentsLoading && acceptedPayments.map((payment) => (
                  <span
                    key={payment.id}
                    className={`px-3 py-2 rounded-lg font-['Newsreader'] text-sm border shadow-sm ${
                      payment.is_active
                        ? 'bg-[#f28c69] text-white border-[#f28c69]'
                        : 'bg-[#f28c69]/60 text-white border-[#f28c69]/60'
                    }`}
                    title={payment.is_active ? 'Currently accepting' : 'Coming soon'}
                  >
                    {payment.display_name}
                    {payment.is_projected && (
                      <span className="ml-1 text-xs opacity-90">(projected)</span>
                    )}
                  </span>
                ))}

                {/* Show message if no insurance found but not loading */}
                {!paymentsLoading && acceptedPayments.length === 0 && selfPayAvailable && (
                  <span className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg font-['Newsreader'] text-sm italic">
                    Insurance coverage information coming soon
                  </span>
                )}
              </div>

              {/* Optional note for projected payments */}
              {acceptedPayments.some(p => p.is_projected) && (
                <p className="text-xs text-[#091747]/60 font-['Newsreader'] mt-2 italic">
                  Projected payments are pending final approval
                </p>
              )}
            </div>
          )}

          {/* Languages - moved to just above education */}
          {provider.languages_spoken && provider.languages_spoken.length > 0 && (
            <div>
              <h3 className="text-lg font-['Newsreader'] text-[#091747] font-medium mb-3">Languages</h3>
              <div className="flex flex-wrap gap-2">
                {provider.languages_spoken.map((language, index) => (
                  <span
                    key={index}
                    className="px-3 py-2 bg-[#FEF8F1] text-[#BF9C73] rounded-lg font-['Newsreader'] text-sm border border-[#BF9C73]/30"
                  >
                    {language}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-['Newsreader'] text-[#091747] font-medium mb-3">Medical School</h3>
              {provider.med_school_org ? (
                <div className="text-[#091747]/80 font-['Newsreader']">
                  <p className="font-medium">{provider.med_school_org}</p>
                  {provider.med_school_grad_year && (
                    <p className="text-sm text-[#091747]/60 mt-1">
                      Graduated {provider.med_school_grad_year}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-[#091747]/70 font-['Newsreader'] italic">
                  Information coming soon
                </p>
              )}
            </div>
            <div>
              <h3 className="text-lg font-['Newsreader'] text-[#091747] font-medium mb-3">Residency</h3>
              {provider.residency_org ? (
                <p className="text-[#091747]/80 font-['Newsreader'] font-medium">
                  {provider.residency_org}
                </p>
              ) : (
                <p className="text-[#091747]/70 font-['Newsreader'] italic">
                  Information coming soon
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Contact Admin Box - Outside modal styling */}
      <div className="px-8 pb-8">
        <div className="bg-gradient-to-r from-[#BF9C73]/10 to-[#F6B398]/10 border border-[#BF9C73]/20 rounded-xl p-6">
          <h3 className="font-semibold text-[#091747] mb-2">Need to Update Your Profile?</h3>
          <p className="text-sm text-[#091747]/70 mb-3">
            To make changes to any of the information shown above, please contact our admin team at{' '}
            <a href="mailto:hello@trymoonlit.com" className="text-[#BF9C73] hover:text-[#A8865F] underline font-medium">
              hello@trymoonlit.com
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
