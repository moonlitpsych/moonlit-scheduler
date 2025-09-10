'use client'

import { useState, useEffect } from 'react'
import { X, User, Building2, Calendar, ExternalLink, Shield, Network } from 'lucide-react'
import { BookabilityRow } from './page'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Database } from '@/types/database'

interface BookabilityRowDetailsProps {
  row: BookabilityRow
  onClose: () => void
}

interface ProviderDetail {
  id: string
  first_name: string
  last_name: string
  title: string
  role: string
}

export default function BookabilityRowDetails({ row, onClose }: BookabilityRowDetailsProps) {
  const [billingProvider, setBillingProvider] = useState<ProviderDetail | null>(null)
  const [renderingProvider, setRenderingProvider] = useState<ProviderDetail | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch provider details for billing and rendering providers
  useEffect(() => {
    const fetchProviderDetails = async () => {
      try {
        setLoading(true)
        
        // Get provider IDs to fetch
        const providerIds = [
          row.billing_provider_id,
          row.rendering_provider_id
        ].filter(Boolean) as string[]

        if (providerIds.length === 0) {
          setLoading(false)
          return
        }

        const supabase = createClientComponentClient<Database>()
        const { data: providers, error } = await supabase
          .from('providers')
          .select('id, first_name, last_name, title, role')
          .in('id', providerIds)

        if (error) {
          console.error('Error fetching provider details:', error)
          setLoading(false)
          return
        }

        // Map providers to billing/rendering
        if (row.billing_provider_id) {
          const billing = providers?.find(p => p.id === row.billing_provider_id)
          setBillingProvider(billing || null)
        }

        if (row.rendering_provider_id) {
          const rendering = providers?.find(p => p.id === row.rendering_provider_id)
          setRenderingProvider(rendering || null)
        }

      } catch (error) {
        console.error('Error in fetchProviderDetails:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchProviderDetails()
  }, [row.billing_provider_id, row.rendering_provider_id])

  // Format provider name
  const formatProviderName = (provider: ProviderDetail | null) => {
    if (!provider) return 'Unknown Provider'
    return `${provider.first_name} ${provider.last_name}${provider.title ? `, ${provider.title}` : ''}`
  }

  // Format date
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not set'
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    } catch {
      return dateString
    }
  }

  // Check if relationship is active today
  const isActiveToday = () => {
    const today = new Date()
    const effectiveDate = row.effective_date ? new Date(row.effective_date) : null
    const expirationDate = row.expiration_date ? new Date(row.expiration_date) : null
    
    if (!effectiveDate) return false
    if (effectiveDate > today) return false
    if (expirationDate && expirationDate < today) return false
    
    return true
  }

  // Chip component
  const Chip = ({ 
    variant, 
    children,
    icon: Icon
  }: { 
    variant: 'direct' | 'supervised' | 'yes' | 'no' | 'active' | 'inactive'
    children: React.ReactNode
    icon?: React.ComponentType<any>
  }) => {
    const getChipStyles = () => {
      switch (variant) {
        case 'direct':
          return 'bg-green-100 text-green-800 border-green-200'
        case 'supervised':
          return 'bg-blue-100 text-blue-800 border-blue-200'
        case 'yes':
          return 'bg-orange-100 text-orange-800 border-orange-200'
        case 'no':
          return 'bg-gray-100 text-gray-800 border-gray-200'
        case 'active':
          return 'bg-green-100 text-green-800 border-green-200'
        case 'inactive':
          return 'bg-red-100 text-red-800 border-red-200'
        default:
          return 'bg-gray-100 text-gray-800 border-gray-200'
      }
    }

    return (
      <span className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-sm font-medium border ${getChipStyles()}`}>
        {Icon && <Icon className="h-3 w-3" />}
        <span>{children}</span>
      </span>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-stone-200">
          <div>
            <h2 className="text-lg font-semibold text-[#091747] font-['Newsreader']">
              Bookability Relationship Details
            </h2>
            <p className="text-sm text-[#091747]/60 mt-1">
              {row.provider_first_name} {row.provider_last_name} ↔ {row.payer_name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-[#091747]/60" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Status Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-stone-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-[#091747]/70 mb-2">Bookability Path</h3>
              <Chip 
                variant={row.network_status === 'in_network' ? 'direct' : 'supervised'}
                icon={row.network_status === 'in_network' ? Shield : Network}
              >
                {row.network_status === 'in_network' ? 'Direct Contract' : 'Supervised Relationship'}
              </Chip>
            </div>
            
            <div className="bg-stone-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-[#091747]/70 mb-2">Status Today</h3>
              <Chip variant={isActiveToday() ? 'active' : 'inactive'}>
                {isActiveToday() ? 'Active' : 'Inactive'}
              </Chip>
            </div>
          </div>

          {/* Provider Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-[#091747] font-['Newsreader']">Provider Information</h3>
            
            <div className="bg-stone-50 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <User className="h-4 w-4 text-[#091747]/60" />
                <span className="text-sm font-medium text-[#091747]/70">Primary Provider</span>
              </div>
              <p className="text-[#091747] font-medium">
                {row.provider_first_name} {row.provider_last_name}
              </p>
            </div>

            {/* Billing Provider (for supervised relationships) */}
            {row.network_status === 'supervised' && (
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Building2 className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-800">Billing Provider</span>
                </div>
                {loading ? (
                  <div className="text-sm text-blue-700">Loading...</div>
                ) : (
                  <p className="text-blue-800 font-medium">
                    {formatProviderName(billingProvider)}
                  </p>
                )}
                <p className="text-xs text-blue-600 mt-1">
                  Claims are billed under this attending physician
                </p>
              </div>
            )}

            {/* Rendering Provider (for supervised relationships) */}
            {row.network_status === 'supervised' && row.rendering_provider_id && (
              <div className="bg-yellow-50 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <User className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-800">Rendering Provider</span>
                </div>
                {loading ? (
                  <div className="text-sm text-yellow-700">Loading...</div>
                ) : (
                  <p className="text-yellow-800 font-medium">
                    {formatProviderName(renderingProvider)}
                  </p>
                )}
                <p className="text-xs text-yellow-600 mt-1">
                  Actually provides patient care
                </p>
              </div>
            )}
          </div>

          {/* Payer Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-[#091747] font-['Newsreader']">Payer Information</h3>
            
            <div className="bg-stone-50 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Building2 className="h-4 w-4 text-[#091747]/60" />
                <span className="text-sm font-medium text-[#091747]/70">Insurance Provider</span>
              </div>
              <p className="text-[#091747] font-medium mb-2">{row.payer_name}</p>
              
              <div className="flex items-center space-x-2">
                <span className="text-sm text-[#091747]/70">Requires Attending:</span>
                <Chip variant={row.requires_attending ? 'yes' : 'no'}>
                  {row.requires_attending ? 'Yes' : 'No'}
                </Chip>
              </div>
              
              {row.requires_attending && (
                <p className="text-xs text-[#091747]/60 mt-2">
                  This payer requires attending physician oversight for residents
                </p>
              )}
            </div>
          </div>

          {/* Date Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-[#091747] font-['Newsreader']">Contract Dates</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-stone-50 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Calendar className="h-4 w-4 text-[#091747]/60" />
                  <span className="text-sm font-medium text-[#091747]/70">Effective Date</span>
                </div>
                <p className="text-[#091747]">{formatDate(row.effective_date)}</p>
              </div>
              
              <div className="bg-stone-50 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Calendar className="h-4 w-4 text-[#091747]/60" />
                  <span className="text-sm font-medium text-[#091747]/70">Expiration Date</span>
                </div>
                <p className="text-[#091747]">{formatDate(row.expiration_date)}</p>
              </div>
            </div>

            {row.bookable_from_date && (
              <div className="bg-green-50 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Calendar className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-800">Bookable From</span>
                </div>
                <p className="text-green-800">{formatDate(row.bookable_from_date)}</p>
                <p className="text-xs text-green-600 mt-1">
                  Patients can start booking appointments from this date
                </p>
              </div>
            )}
          </div>

          {/* Location */}
          {row.state && (
            <div className="bg-stone-50 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Building2 className="h-4 w-4 text-[#091747]/60" />
                <span className="text-sm font-medium text-[#091747]/70">State</span>
              </div>
              <p className="text-[#091747]">{row.state}</p>
            </div>
          )}

          {/* Debug Link */}
          <div className="border-t border-stone-200 pt-4">
            <a
              href={`/api/debug/bookability?providerId=${row.provider_id}&payerId=${row.payer_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-2 text-sm text-[#BF9C73] hover:text-[#BF9C73]/80 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              <span>View Debug Information</span>
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t border-stone-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#BF9C73] hover:bg-[#BF9C73]/90 text-white rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}