/**
 * Admin Providers Page
 *
 * Main provider management interface for admins
 * Route: /admin/providers
 */

import AdminProviderList from '@/components/admin/AdminProviderList'

export const metadata = {
  title: 'Provider Management | Moonlit Admin',
  description: 'Manage all providers in the Moonlit platform'
}

export default function AdminProvidersPage() {
  return <AdminProviderList />
}
