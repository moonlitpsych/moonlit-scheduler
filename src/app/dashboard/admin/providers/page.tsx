'use client'

import AdminProviderList from '@/components/dashboard/AdminProviderList'

export default function AdminProvidersPage() {
  const providers = [] // Placeholder - will be loaded client-side
  const roles = [] // Placeholder - will be loaded client-side

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#091747] font-['Newsreader']">
          Manage Providers
        </h1>
        <p className="text-stone-600 mt-2">
          Add new providers and manage existing ones.
        </p>
      </div>

      <AdminProviderList 
        providers={providers || []}
        roles={roles || []}
      />
    </div>
  )
}
