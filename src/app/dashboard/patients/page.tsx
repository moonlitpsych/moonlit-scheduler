/**
 * Provider Patient Roster Page (Unified)
 *
 * Uses the unified PatientRoster component with provider-specific configuration.
 * Shows only patients assigned to the logged-in provider.
 * Replaced 820 lines of inline implementation with ~110 lines.
 *
 * Supports provider impersonation for admin users.
 */

'use client'

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { PatientRoster } from '@/components/patient-roster'
import { providerImpersonationManager } from '@/lib/provider-impersonation'
import { isAdminEmail } from '@/lib/admin-auth'
import ProviderBulkSyncButton from '@/components/dashboard/ProviderBulkSyncButton'

export default function PatientsPage() {
  const [providerId, setProviderId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClientComponentClient()

  useEffect(() => {
    async function getProviderId() {
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          window.location.href = '/auth/login'
          return
        }

        // Check for admin impersonation first
        const isAdmin = isAdminEmail(user.email || '')
        const impersonation = providerImpersonationManager.getImpersonatedProvider()

        if (isAdmin && impersonation) {
          // Admin viewing as another provider - use impersonated provider ID
          console.log('Admin impersonation detected, using provider:', impersonation.provider.first_name, impersonation.provider.last_name)
          console.log('Provider ID being set:', impersonation.provider.id)
          setProviderId(impersonation.provider.id)
          setLoading(false)
          return
        }

        // Regular provider viewing their own patients
        const { data: providerData, error } = await supabase
          .from('providers')
          .select('id')
          .eq('auth_user_id', user.id)
          .eq('is_active', true)
          .single()

        if (error || !providerData) {
          console.error('Error fetching provider:', error)
          setLoading(false)
          return
        }

        setProviderId(providerData.id)
        setLoading(false)
      } catch (err) {
        console.error('Error loading provider:', err)
        setLoading(false)
      }
    }

    getProviderId()
  }, [supabase])

  if (loading) {
    return (
      <div className="min-h-screen bg-moonlit-cream">
        <div className="animate-pulse">
          <div className="h-16 bg-gray-200"></div>
          <div className="container mx-auto px-4 py-8">
            <div className="h-8 bg-gray-200 rounded mb-4 w-1/3"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!providerId) {
    return (
      <div className="min-h-screen bg-moonlit-cream">
        <div className="container mx-auto px-4 py-12">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <p className="text-yellow-800">No provider ID found. Please contact support.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-moonlit-cream">
      <div className="container mx-auto px-4 py-8">
        {/* Page header with ProviderBulkSyncButton */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-moonlit-navy mb-2 font-['Newsreader']">
              My Patients
            </h1>
            <p className="text-gray-600 font-['Newsreader'] font-light">
              View and manage your assigned patients
            </p>
          </div>
          <ProviderBulkSyncButton onSyncComplete={() => {
            // Roster will auto-refresh via SWR revalidation
            console.log('Bulk sync completed')
          }} />
        </div>

        {/* Unified Patient Roster Component */}
        <PatientRoster
          userType="provider"
          userId={providerId}

          // Provider-specific features
          showCaseManagerColumn={true}
          showOrganizationColumn={true}

          // Configuration
          title="My Patients"
          defaultPageSize={20}
        />
      </div>
    </div>
  )
}
