'use client'

import ProviderProfileForm from '@/components/dashboard/ProviderProfileForm'

export default function ProfilePage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#091747] font-['Newsreader']">
          Edit Profile
        </h1>
        <p className="text-stone-600 mt-2">
          Update your professional information that appears to patients.
        </p>
      </div>

      <ProviderProfileForm />
    </div>
  )
}