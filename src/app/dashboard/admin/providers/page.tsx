// src/app/dashboard/admin/providers/page.tsx
import AdminProviderList from '@/components/dashboard/AdminProviderList'
import { requireAdmin } from '@/lib/auth'
import { Database } from '@/types/database'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export default async function AdminProvidersPage() {
  const user = await requireAdmin()
  const supabase = createServerComponentClient<Database>({ cookies })

  // Get all providers with their roles and auth status
  const { data: providers } = await supabase
    .from('provider_profiles')
    .select('*')
    .order('last_name', { ascending: true })

  // Get all roles for the form
  const { data: roles } = await supabase
    .from('roles')
    .select('*')
    .order('name')

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
