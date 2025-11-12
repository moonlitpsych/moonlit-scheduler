import { getAdminClient } from '@/lib/supabase/server'
import IntakeQWidget from '@/components/booking/IntakeQWidget'
import Link from 'next/link'
import { notFound } from 'next/navigation'

interface BookWidgetPageProps {
  searchParams: Promise<{
    payer_id?: string
  }>
}

/**
 * /book-widget page
 *
 * Displays the IntakeQ booking widget for a specific payer.
 * This page is reached after payer selection in /book-now flow.
 *
 * Query params:
 * - payer_id: UUID of the selected payer
 *
 * Flow:
 * 1. Patient selects payer on /book-now
 * 2. Redirects to /book-widget?payer_id=xxx
 * 3. Fetches payer + locationId from database
 * 4. Renders IntakeQ widget with correct locationId
 */
export default async function BookWidgetPage({ searchParams }: BookWidgetPageProps) {
  const params = await searchParams
  const payerId = params.payer_id

  // Handle missing payer_id
  if (!payerId) {
    return (
      <div className="min-h-screen bg-[#FEF8F1] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <h1 className="text-2xl font-['Newsreader'] text-[#091747] mb-4">
            No Insurance Selected
          </h1>
          <p className="text-gray-600 mb-6">
            Please select your insurance to continue booking.
          </p>
          <Link
            href="/book-now"
            className="inline-block px-6 py-3 bg-[#BF9C73] text-white rounded-full hover:bg-[#A6835E] transition-colors"
          >
            Select Insurance
          </Link>
        </div>
      </div>
    )
  }

  // Fetch payer from database
  const supabase = getAdminClient()
  const { data: payer, error } = await supabase
    .from('payers')
    .select('id, name, state, intakeq_location_id')
    .eq('id', payerId)
    .single()

  // Handle payer not found
  if (error || !payer) {
    console.error('Failed to fetch payer:', error)
    notFound()
  }

  // Handle missing location ID
  if (!payer.intakeq_location_id) {
    return (
      <div className="min-h-screen bg-[#FEF8F1] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <h1 className="text-2xl font-['Newsreader'] text-[#091747] mb-4">
            Booking Not Available
          </h1>
          <p className="text-gray-600 mb-2">
            We're sorry, but online booking is not yet available for:
          </p>
          <p className="text-lg font-semibold text-[#091747] mb-6">
            {payer.name}
          </p>
          <p className="text-gray-600 mb-6">
            Please contact us directly to schedule your appointment.
          </p>
          <div className="space-y-4">
            <Link
              href="/book-now"
              className="inline-block px-6 py-3 bg-[#BF9C73] text-white rounded-full hover:bg-[#A6835E] transition-colors"
            >
              Select Different Insurance
            </Link>
            <br />
            <Link
              href="/"
              className="inline-block px-6 py-3 border-2 border-[#BF9C73] text-[#BF9C73] rounded-full hover:bg-[#FEF8F1] transition-colors"
            >
              Return Home
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Success! Show the IntakeQ widget
  return (
    <div className="min-h-screen bg-[#FEF8F1]">
      {/* Header */}
      <div className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div>
            <p className="text-lg text-gray-600 mb-3">
              Booking with: <span className="font-semibold text-[#091747]">{payer.name}</span>
              {payer.state && <span className="text-gray-400 ml-2">({payer.state})</span>}
            </p>
            <Link
              href="/book-now"
              className="inline-flex items-center text-sm text-gray-600 hover:text-[#BF9C73] transition-colors"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Change insurance
            </Link>
          </div>
        </div>
      </div>

      {/* Widget Container with Signature Dashed Border */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Moonlit's signature dashed border treatment */}
          <div className="border-4 border-dashed border-[#BF9C73] rounded-lg p-8 bg-white shadow-sm">
            <IntakeQWidget locationId={payer.intakeq_location_id} />
          </div>
        </div>
      </div>

      {/* Footer Help Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="max-w-2xl mx-auto">
          <div className="p-6 text-center">
            <h3 className="text-lg font-['Newsreader'] text-[#091747] mb-2">
              Need Help?
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Our team is here to assist you with your booking.
            </p>
            <div className="space-y-2 text-sm text-gray-700">
              <p>
                Email: <a href="mailto:hello@trymoonlit.com" className="text-[#BF9C73] hover:underline">hello@trymoonlit.com</a>
              </p>
              <p>
                Phone: <a href="tel:+13852462522" className="text-[#BF9C73] hover:underline">(385) 246-2522</a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
