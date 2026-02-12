'use client'

import { Building2, Phone, Globe, Clock, Mail, MapPin, Printer, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import type { ReferralOrganization } from '@/types/referral-network'

interface ReferralOrganizationCardProps {
  organization: ReferralOrganization
  showBadges?: boolean
}

export default function ReferralOrganizationCard({
  organization,
  showBadges = true
}: ReferralOrganizationCardProps) {
  const [expanded, setExpanded] = useState(false)

  // Format address - use service_area if available for multi-location orgs
  const formatAddress = (): string | null => {
    const parts: string[] = []
    if (organization.address) parts.push(organization.address)

    // For multi-location orgs, show service_area instead of single city
    if (organization.service_area) {
      // Show service area with state
      let locationLine = organization.service_area
      if (organization.state && !organization.service_area.includes(organization.state)) {
        locationLine += `, ${organization.state}`
      }
      parts.push(locationLine)
    } else {
      // Format as "City, ST 12345"
      let locationLine = ''
      if (organization.city) {
        locationLine = organization.city
        if (organization.state) locationLine += `, ${organization.state}`
        if (organization.postal_code) locationLine += ` ${organization.postal_code}`
      }
      if (locationLine) parts.push(locationLine)
    }

    return parts.length > 0 ? parts.join(', ') : null
  }

  const address = formatAddress()
  const hasMoreDetails = organization.referral_notes || organization.hours_of_operation ||
    (organization.care_types && organization.care_types.length > 0) ||
    (organization.specialties && organization.specialties.length > 0)

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-[#BF9C73]/10 rounded-lg">
            <Building2 className="h-5 w-5 text-[#BF9C73]" />
          </div>
          <div>
            <h3 className="font-semibold text-[#091747]">{organization.name}</h3>
            {organization.type && (
              <span className="text-xs text-gray-500 capitalize">
                {organization.type.replace(/_/g, ' ')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Contact Info */}
      <div className="mt-3 space-y-1.5">
        {address && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <span>{address}</span>
          </div>
        )}

        {organization.phone && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Phone className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <a
              href={`tel:${organization.phone.replace(/\D/g, '')}`}
              className="text-[#2980B9] hover:underline"
            >
              {organization.phone}
            </a>
          </div>
        )}

        {organization.fax && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Printer className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <span>Fax: {organization.fax}</span>
          </div>
        )}

        {organization.website && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Globe className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <a
              href={organization.website.startsWith('http') ? organization.website : `https://${organization.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#2980B9] hover:underline truncate"
            >
              {organization.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
            </a>
          </div>
        )}
      </div>

      {/* Email Contact */}
      {organization.email && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Mail className="h-3.5 w-3.5 text-gray-400" />
            <a
              href={`mailto:${organization.email}`}
              className="text-[#2980B9] hover:underline"
            >
              {organization.email}
            </a>
          </div>
        </div>
      )}

      {/* Expandable Section */}
      {hasMoreDetails && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-3 flex items-center gap-1 text-xs text-gray-500 hover:text-[#091747] transition-colors"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-4 w-4" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                Show more details
              </>
            )}
          </button>

          {expanded && (
            <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
              {/* Hours */}
              {organization.hours_of_operation && (
                <div className="flex items-start gap-2 text-sm text-gray-600">
                  <Clock className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                  <span>{organization.hours_of_operation}</span>
                </div>
              )}

              {/* Notes */}
              {organization.referral_notes && (
                <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded border-l-2 border-gray-300">
                  {organization.referral_notes}
                </div>
              )}

              {/* Care Types */}
              {showBadges && organization.care_types && organization.care_types.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                    Services Offered
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {organization.care_types.map(ct => (
                      <span
                        key={ct.id}
                        className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded"
                      >
                        {ct.care_type?.display_name || 'Unknown'}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Specialties */}
              {showBadges && organization.specialties && organization.specialties.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                    Specialties
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {organization.specialties.map(s => (
                      <span
                        key={s.id}
                        className="px-2 py-0.5 text-xs bg-purple-50 text-purple-700 rounded"
                      >
                        {s.specialty_tag?.display_name || 'Unknown'}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
