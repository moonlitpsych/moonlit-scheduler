/**
 * Dashboard Admin Providers Page
 *
 * Provider management interface accessible from /dashboard/admin/providers
 * Uses the same AdminProviderList component as /admin/providers
 */

'use client'

import AdminProviderList from '@/components/admin/AdminProviderList'

export default function AdminProvidersPage() {
  return <AdminProviderList />
}
