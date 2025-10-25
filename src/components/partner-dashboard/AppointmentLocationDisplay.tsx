'use client'

import { useState } from 'react'
import { Video, MapPin, Copy, Check, ExternalLink } from 'lucide-react'

interface AppointmentLocationDisplayProps {
  meetingUrl?: string | null
  locationInfo?: any
  startTime: string
  compact?: boolean // For roster view vs detail view
}

export default function AppointmentLocationDisplay({
  meetingUrl,
  locationInfo,
  startTime,
  compact = false
}: AppointmentLocationDisplayProps) {
  const [copied, setCopied] = useState(false)

  // Parse location info
  const isTelehealth = locationInfo?.locationType === 'telehealth' ||
                       locationInfo?.placeOfService === '02' ||
                       locationInfo?.placeOfService === '10'

  const locationName = locationInfo?.locationName || 'Location not specified'

  // Copy to clipboard
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  // Format start time for display
  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  if (compact) {
    // Compact view for patient roster
    return (
      <div className="text-sm">
        {/* Time */}
        <div className="flex items-center text-gray-900 font-medium mb-1">
          {formatTime(startTime)}
        </div>

        {/* Meeting Link or Location */}
        {isTelehealth && meetingUrl ? (
          <div className="flex items-center gap-1">
            <Video className="w-3 h-3 text-blue-600 flex-shrink-0" />
            <a
              href={meetingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:text-blue-800 hover:underline truncate"
              title={meetingUrl}
            >
              Join Video Call
            </a>
            <button
              onClick={(e) => {
                e.preventDefault()
                copyToClipboard(meetingUrl)
              }}
              className="text-gray-400 hover:text-gray-600"
              title="Copy link"
            >
              {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-xs text-gray-600">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            <span className="truncate" title={locationName}>{locationName}</span>
          </div>
        )}
      </div>
    )
  }

  // Full view for patient detail page
  return (
    <div className="space-y-3">
      {/* Date & Time */}
      <div>
        <p className="text-sm text-gray-500 mb-1">When</p>
        <p className="text-base font-medium text-gray-900">{formatTime(startTime)}</p>
      </div>

      {/* Telehealth Link */}
      {isTelehealth && meetingUrl && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Video className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-blue-900 mb-2">Video Visit</p>
              <div className="flex items-center gap-2">
                <a
                  href={meetingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  <Video className="w-4 h-4" />
                  Join Video Call
                  <ExternalLink className="w-3 h-3" />
                </a>
                <button
                  onClick={() => copyToClipboard(meetingUrl)}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                  title="Copy video link"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-green-600" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy Link
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-blue-700 mt-2 break-all">{meetingUrl}</p>
            </div>
          </div>
        </div>
      )}

      {/* In-Person Location */}
      {!isTelehealth && locationInfo && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-gray-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900 mb-1">In-Person Visit</p>
              <p className="text-sm text-gray-700">{locationName}</p>
              {locationInfo.placeOfService === '11' && (
                <p className="text-xs text-gray-500 mt-1">Office visit</p>
              )}
              {locationInfo.placeOfService === '12' && (
                <p className="text-xs text-gray-500 mt-1">Home visit</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* No Location Info */}
      {!meetingUrl && !locationInfo && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-sm text-yellow-800">
            ⚠️ Location details not available. Please contact the provider's office.
          </p>
        </div>
      )}
    </div>
  )
}
