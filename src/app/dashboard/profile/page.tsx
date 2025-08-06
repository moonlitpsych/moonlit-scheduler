// src/app/dashboard/profile/page.tsx
import ProviderProfileForm from '@/components/dashboard/ProviderProfileForm'
import { requireProvider } from '@/lib/auth'
import { Database } from '@/types/database'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export default async function ProfilePage() {
  const user = await requireProvider()
  const supabase = createServerComponentClient<Database>({ cookies })

  // Get provider data with payer relationships
  const { data: provider, error } = await supabase
    .from('providers')
    .select(`
      *,
      provider_payer_relationships (
        payer_id,
        payers (
          id,
          name,
          payer_type
        )
      )
    `)
    .eq('id', user.provider.id)
    .single()

  if (error) {
    console.error('Error fetching provider:', error)
    return <div>Error loading profile</div>
  }

  // Get all available payers for the insurance selection
  const { data: allPayers } = await supabase
    .from('payers')
    .select('id, name, payer_type, requires_attending')
    .order('name')

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

      <ProviderProfileForm 
        provider={provider} 
        availablePayers={allPayers || []}
      />
    </div>
  )
}