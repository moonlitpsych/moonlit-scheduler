'use client'

import ProviderProfilePreview from '@/components/dashboard/ProviderProfilePreview'

export default function ProfilePage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#091747] font-['Newsreader']">
          My Public Profile
        </h1>
        <p className="text-stone-600 mt-2">
          This is exactly how patients see your profile when they click on your provider card.
        </p>
      </div>

      <ProviderProfilePreview />
    </div>
  )
}