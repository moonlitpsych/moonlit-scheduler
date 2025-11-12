'use client'

import PayerSearchView from '@/components/booking/views/PayerSearchView'
import { Payer } from '@/types/database'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'

/**
 * /book-now page
 *
 * Simplified booking entry point that:
 * 1. Shows payer selection (Moonlit's beautiful fuzzy search UI)
 * 2. Redirects to IntakeQ booking widget for selected payer
 *
 * This hybrid approach uses Moonlit's superior payer selection UX,
 * then hands off to IntakeQ's proven booking widget.
 *
 * Flow:
 * /book-now → [select payer] → /book-widget?payer_id=xxx → IntakeQ widget
 */
export default function BookNowPage() {
  const router = useRouter()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  /**
   * Handle payer selection
   * Redirects to /book-widget with the selected payer's ID
   * Acceptance status is ignored since we're always showing the widget
   */
  const handlePayerSelected = (
    payer: Payer,
    acceptanceStatus: 'not-accepted' | 'future' | 'active' | 'waitlist'
  ) => {
    console.log(`✅ Payer selected: ${payer.name} (${payer.id})`)
    console.log(`   Acceptance status: ${acceptanceStatus}`)

    // Handle payers that are not yet accepting appointments
    if (acceptanceStatus === 'not-accepted') {
      setErrorMessage(`We're sorry, but we're not currently accepting ${payer.name} insurance. Please select a different payer or contact us directly.`)
      return
    }

    // Clear any previous error messages
    setErrorMessage(null)

    // For future or waitlist payers, show a warning but allow continuation
    if (acceptanceStatus === 'future' || acceptanceStatus === 'waitlist') {
      const message = acceptanceStatus === 'future'
        ? `${payer.name} coverage will be available soon. You can still book, but please verify coverage before your appointment.`
        : `${payer.name} is on our waitlist. We'll contact you when appointments become available.`

      if (!confirm(message + '\n\nContinue anyway?')) {
        return
      }
    }

    // Map synthetic 'cash-payment' ID to real database UUID
    // The PayerSearchView uses 'cash-payment' as a synthetic ID, but we need the real UUID
    let payerId = payer.id
    if (payerId === 'cash-payment') {
      // Real "Out-of-pocket pay (UT)" payer UUID from database
      payerId = '6317e5c7-e3fb-48ed-a394-db7a8b94b206'
      console.log('💳 Mapped cash-payment to real payer UUID:', payerId)
    }

    // Redirect to widget page with payer ID
    router.push(`/book-widget?payer_id=${payerId}`)
  }

  return (
    <div className="min-h-screen bg-[#FEF8F1]">
      {/* Payer Selection */}
      <div className="container mx-auto px-6 py-6">
        <div className="max-w-3xl mx-auto">
          {/* Back navigation */}
          <div className="mb-6">
            <Link
              href="/"
              className="inline-flex items-center text-sm text-gray-600 hover:text-[#BF9C73] transition-colors"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to home
            </Link>
          </div>

          {/* Error message banner */}
          {errorMessage && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm text-red-800">{errorMessage}</p>
                </div>
                <button
                  onClick={() => setErrorMessage(null)}
                  className="ml-3 flex-shrink-0 text-red-600 hover:text-red-800 transition-colors"
                  aria-label="Close error message"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          <PayerSearchView
            onPayerSelected={handlePayerSelected}
            bookingScenario="self"
            intent="book"
          />
        </div>
      </div>

      {/* Help Footer */}
      <div className="container mx-auto px-6 pb-6">
        <div className="max-w-2xl mx-auto text-center">
          <div className="p-4">
            <h3 className="text-lg font-['Newsreader'] text-[#091747] mb-2">
              Need Help?
            </h3>
            <p className="text-gray-600 text-sm mb-4">
              Can't find your insurance or have questions about coverage?
            </p>
            <div className="space-y-2 text-sm text-gray-700">
              <p>
                Email: <a href="mailto:hello@trymoonlit.com" className="text-[#BF9C73] hover:underline">hello@trymoonlit.com</a>
              </p>
              <p>
                Phone: <a href="tel:+13852462522" className="text-[#BF9C73] hover:underline">(385) 246-2522</a>
              </p>
            </div>
            <div className="mt-4">
              <Link
                href="/ways-to-pay"
                className="text-sm text-[#BF9C73] hover:underline"
              >
                View all insurances we accept →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
