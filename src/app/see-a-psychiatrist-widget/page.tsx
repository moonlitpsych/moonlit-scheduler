import { Metadata } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import PracticeQWidget from '@/components/booking/PracticeQWidget'

export const metadata: Metadata = {
  title: 'See a Psychiatrist | Book Now',
  description: 'Book an appointment with a Moonlit psychiatrist',
  robots: 'index, follow',
}

interface ProviderFax {
  lastName: string
  faxNumber: string | null
}

async function getBookablePsychiatrists(): Promise<ProviderFax[]> {
  try {
    // Query bookable psychiatry residents (exclude attendings)
    // Using provider_type='resident physician' (residents are bookable, not attendings)
    const { data: providers, error } = await supabaseAdmin
      .from('providers')
      .select('last_name, fax_number, role, provider_type')
      .eq('is_active', true)
      .eq('is_bookable', true)
      .eq('accepts_new_patients', true)
      .eq('provider_type', 'resident physician')
      .order('last_name')

    if (error) {
      console.error('❌ Error fetching bookable psychiatrists:', error)
      return []
    }

    if (!providers || providers.length === 0) {
      return []
    }

    // Filter out attendings (if any slipped through) and map to ProviderFax
    return providers
      .filter(p => p.provider_type !== 'attending')
      .map(p => ({
        lastName: p.last_name || 'Unknown',
        faxNumber: p.fax_number,
      }))
  } catch (error) {
    console.error('❌ Error in getBookablePsychiatrists:', error)
    return []
  }
}

export default async function SeeAPsychiatristWidget() {
  const providers = await getBookablePsychiatrists()

  return (
    <>
      <div className="min-h-screen bg-[#FEF8F1] py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Page Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-['Newsreader'] text-[#091747] mb-4">
              Get the mental health medical attention you need.
            </h1>
          </div>

          {/* Widget Container with dashed border */}
          <div className="mb-16 max-w-4xl mx-auto border-4 border-dashed border-[#BF9C73] rounded-lg p-8 bg-white">
            <PracticeQWidget />
          </div>

          {/* Provider Fax Section */}
          {providers.length > 0 && (
            <div className="max-w-3xl mx-auto">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
                <h2 className="text-2xl font-['Newsreader'] text-[#091747] mb-6">
                  Fax numbers
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {providers.map((provider, index) => (
                    <div
                      key={index}
                      className="flex items-baseline justify-between py-2 px-4 rounded-lg hover:bg-[#FEF8F1] transition-colors"
                    >
                      <span className="font-['Newsreader'] text-[#091747] font-medium">
                        Dr. {provider.lastName}:
                      </span>
                      <span className="font-['Newsreader'] text-[#091747]/70 ml-3">
                        {provider.faxNumber || 'No fax on file'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Canonical tag */}
      <link
        rel="canonical"
        href="https://booknow.trymoonlit.com/see-a-psychiatrist-widget"
      />
    </>
  )
}
