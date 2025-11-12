/**
 * Partner Dashboard - Calendar Subscription Page
 * Provides iCal feed URL for subscribing to patient appointments
 */

'use client'

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { PartnerUser } from '@/types/partner-types'
import { Database } from '@/types/database'
import { Calendar, Copy, RefreshCw, Check, ExternalLink, AlertCircle } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'

export default function CalendarSubscriptionPage() {
  const toast = useToast()
  const [partnerUser, setPartnerUser] = useState<PartnerUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [feedUrl, setFeedUrl] = useState<string>('')
  const [instructions, setInstructions] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false)

  useEffect(() => {
    fetchCalendarToken()
  }, [])

  const fetchCalendarToken = async () => {
    try {
      setLoading(true)
      setError(null)

      // Get authenticated user
      const supabase = createClientComponentClient<Database>()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setError('Authentication required')
        return
      }

      // Fetch partner user data
      const userResponse = await fetch('/api/partner/me', {
        headers: { 'x-partner-user-id': user.id }
      })

      if (!userResponse.ok) {
        setError('Failed to load partner user data')
        return
      }

      const userData = await userResponse.json()
      if (!userData.success) {
        setError(userData.error || 'Failed to load user data')
        return
      }

      setPartnerUser(userData.data)

      // Fetch calendar token and feed URL
      const tokenResponse = await fetch('/api/partner-dashboard/calendar/token')

      if (!tokenResponse.ok) {
        setError('Failed to load calendar feed')
        return
      }

      const tokenData = await tokenResponse.json()
      if (!tokenData.success) {
        setError(tokenData.error || 'Failed to load calendar feed')
        return
      }

      setFeedUrl(tokenData.data.feed_url)
      setInstructions(tokenData.data.instructions)

    } catch (err: any) {
      console.error('Error fetching calendar token:', err)
      setError('Failed to load calendar subscription')
    } finally {
      setLoading(false)
    }
  }

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(feedUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleRegenerateToken = async () => {
    try {
      setRegenerating(true)
      setError(null)
      setShowRegenerateConfirm(false)

      const response = await fetch('/api/partner-dashboard/calendar/token', {
        method: 'POST'
      })

      const data = await response.json()

      if (data.success) {
        setFeedUrl(data.data.feed_url)
        toast.success(
          'Calendar Token Regenerated',
          'Please update your calendar subscription with the new URL below.'
        )
      } else {
        setError(data.error || 'Failed to regenerate token')
      }
    } catch (err: any) {
      console.error('Error regenerating token:', err)
      setError('Failed to regenerate calendar token')
    } finally {
      setRegenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-moonlit-cream">
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded mb-4 w-1/3"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-moonlit-cream">

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-moonlit-navy mb-2 font-['Newsreader']">
            Calendar Subscription
          </h1>
          <p className="text-gray-600 font-['Newsreader'] font-light">
            Subscribe to patient appointments in your calendar app
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-2">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Calendar Feed URL */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
              <Calendar className="w-5 h-5" />
              <span>Your Calendar Feed</span>
            </h2>
            <button
              onClick={() => setShowRegenerateConfirm(true)}
              disabled={regenerating}
              className="text-sm text-gray-600 hover:text-gray-900 flex items-center space-x-1 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
              <span>Regenerate</span>
            </button>
          </div>

          {/* Regenerate Confirmation Dialog */}
          {showRegenerateConfirm && (
            <div className="mb-4 bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
              <div className="flex items-start space-x-3 mb-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-yellow-900 mb-2">
                    Regenerate Calendar Token?
                  </p>
                  <p className="text-sm text-yellow-800">
                    This will invalidate your current calendar subscription URL. You'll need to update
                    the subscription in your calendar app with the new URL. Your calendar will stop syncing
                    until you update it.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowRegenerateConfirm(false)}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRegenerateToken}
                  disabled={regenerating}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-medium disabled:opacity-50"
                >
                  {regenerating ? 'Regenerating...' : 'Yes, Regenerate Token'}
                </button>
              </div>
            </div>
          )}

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
            <code className="text-sm text-gray-800 break-all">{feedUrl}</code>
          </div>

          <button
            onClick={handleCopyUrl}
            className="w-full px-4 py-2 bg-moonlit-brown text-white rounded-lg hover:bg-moonlit-brown/90 transition-colors flex items-center justify-center space-x-2"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copy Feed URL</span>
              </>
            )}
          </button>
        </div>

        {/* Instructions */}
        {instructions && (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              How to Subscribe
            </h2>

            <div className="space-y-4">
              {/* Google Calendar */}
              <div className="border-l-4 border-blue-500 pl-4">
                <h3 className="font-medium text-gray-900 mb-1 flex items-center space-x-2">
                  <span>Google Calendar</span>
                </h3>
                <p className="text-sm text-gray-600">{instructions.google}</p>
              </div>

              {/* Outlook */}
              <div className="border-l-4 border-blue-600 pl-4">
                <h3 className="font-medium text-gray-900 mb-1">
                  Microsoft Outlook
                </h3>
                <p className="text-sm text-gray-600">{instructions.outlook}</p>
              </div>

              {/* Apple Calendar */}
              <div className="border-l-4 border-gray-500 pl-4">
                <h3 className="font-medium text-gray-900 mb-1">
                  Apple Calendar
                </h3>
                <p className="text-sm text-gray-600">{instructions.apple}</p>
              </div>

              {/* Other */}
              <div className="border-l-4 border-purple-500 pl-4">
                <h3 className="font-medium text-gray-900 mb-1">
                  Other Calendar Apps
                </h3>
                <p className="text-sm text-gray-600">{instructions.other}</p>
              </div>
            </div>
          </div>
        )}

        {/* Info box */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Calendar Sync Information</p>
              <ul className="list-disc list-inside space-y-1 text-blue-700">
                <li>Shows appointments for the next 90 days</li>
                <li>Updates automatically (may take up to 24 hours depending on your calendar app)</li>
                <li>Includes patient name, provider, and appointment details</li>
                <li>Only shows scheduled and confirmed appointments</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
