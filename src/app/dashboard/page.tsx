// src/app/dashboard/availability/page.tsx

import ProviderAvailabilityManager from '@/components/providers/ProviderAvailabilityManager'

export default function ProviderAvailabilityPage() {
  // Hardcoded for testing - replace with real provider ID later
  const providerId = 'test-provider-123'

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FEF8F1] via-[#F6B398]/20 to-[#FEF8F1]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#091747] font-['Newsreader']">
            Manage Your Availability
          </h1>
          <p className="mt-2 text-[#091747]/70">
            Set your weekly schedule, time off, and booking preferences.
          </p>
        </div>

        <ProviderAvailabilityManager providerId={providerId} />
      </div>
    </div>
  )
}