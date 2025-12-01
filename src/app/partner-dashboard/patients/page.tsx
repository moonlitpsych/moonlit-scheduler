/**
 * Partner Dashboard - Patient Roster Page (Unified)
 *
 * Uses the unified PatientRoster component with partner-specific configuration.
 * Replaced 1,170 lines of inline implementation with ~100 lines.
 */

'use client'

import { useState, useEffect } from 'react'
import useSWR from 'swr'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { PatientRoster } from '@/components/patient-roster'
import { partnerImpersonationManager } from '@/lib/partner-impersonation'
import { PartnerUser } from '@/types/partner-types'
import { Database } from '@/types/database'
import { isAdminEmail } from '@/lib/admin-auth'
import BulkSyncButton from '@/components/partner-dashboard/BulkSyncButton'

// SWR fetcher function
const fetcher = (url: string) => fetch(url).then(res => res.json())

export default function PatientRosterPage() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminCheckComplete, setAdminCheckComplete] = useState(false)

  // Check if current user is an admin (async operation)
  useEffect(() => {
    const checkAdmin = async () => {
      const supabase = createClientComponentClient<Database>()
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) {
        const adminStatus = await isAdminEmail(user.email)
        setIsAdmin(adminStatus)
      }
      setAdminCheckComplete(true)
    }
    checkAdmin()
  }, [])

  // Only check for impersonation if user is confirmed admin
  // This prevents stale impersonation data from affecting regular partner users
  const impersonation = (adminCheckComplete && isAdmin)
    ? partnerImpersonationManager.getImpersonatedPartner()
    : null

  // Fetch partner user data (skip if admin is impersonating)
  const { data: partnerData, error: partnerError } = useSWR(
    // Only fetch from /api/partner/me if:
    // 1. Admin check is complete AND
    // 2. Either not admin OR admin with no impersonation context
    adminCheckComplete && !impersonation ? '/api/partner/me' : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 300000, // 5 minutes
    }
  )

  // Use impersonated partner data if admin is viewing, otherwise use fetched data
  const partnerUser: PartnerUser | null = impersonation
    ? {
        id: impersonation.partner.id,
        auth_user_id: impersonation.partner.auth_user_id,
        organization_id: impersonation.partner.organization_id,
        full_name: impersonation.partner.full_name,
        email: impersonation.partner.email,
        phone: impersonation.partner.phone,
        role: impersonation.partner.role,
        status: impersonation.partner.is_active ? 'active' : 'inactive'
      }
    : (partnerData?.success ? partnerData.data : null)

  const loading = !adminCheckComplete || (!partnerUser && !partnerError && !impersonation)
  const error = partnerError

  // Check if user can transfer patients (admin or case_manager)
  const canTransferPatients = partnerUser &&
    ['partner_admin', 'partner_case_manager'].includes(partnerUser.role)

  // Loading state
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

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-moonlit-cream">
        <div className="container mx-auto px-4 py-12">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-800">Failed to load partner user information</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-moonlit-cream">
      <div className="container mx-auto px-4 py-8">
        {/* Page header with BulkSyncButton */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-moonlit-navy mb-2 font-['Newsreader']">
              Patient Roster
            </h1>
            <p className="text-gray-600 font-['Newsreader'] font-light">
              View and manage patients from your organization
            </p>
          </div>
          <BulkSyncButton onSyncComplete={() => {
            // Roster will auto-refresh via SWR revalidation
            console.log('Bulk sync completed')
          }} />
        </div>

        {/* Unified Patient Roster Component */}
        {/* Only pass userId when admin is impersonating - otherwise API uses session to look up user */}
        <PatientRoster
          userType="partner"
          userId={impersonation ? partnerUser?.id : undefined}

          // Partner-specific features
          enablePatientLinks={true}
          enableROIActions={true}
          enableTransferAction={canTransferPatients || false}
          enableNotificationAction={canTransferPatients || false}
          enableMedicationReport={canTransferPatients || false}
          showAssignedFilter={true}

          // Configuration
          title="Patient Roster"
          defaultPageSize={20}
        />
      </div>
    </div>
  )
}
