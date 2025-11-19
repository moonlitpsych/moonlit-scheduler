/**
 * Admin Users Management Page
 *
 * Manage admin user accounts
 * Route: /admin/admin-users
 */

'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Database } from '@/types/database'
import { Shield, Plus, Search, UserPlus, Copy, Check, AlertCircle, Users, Mail, Calendar, CheckCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

const supabase = createClientComponentClient<Database>()

interface AdminUser {
  id: string
  email: string
  full_name: string | null
  added_by_email: string | null
  added_at: string
  last_login_at: string | null
  is_active: boolean
  notes: string | null
  has_account?: boolean
}

const fetcher = async (url: string) => {
  const { data: { session } } = await supabase.auth.getSession()
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${session?.access_token}`
    }
  })
  if (!response.ok) {
    throw new Error('Failed to fetch')
  }
  return response.json()
}

export default function AdminUsersPage() {
  const [showAddModal, setShowAddModal] = useState(false)
  const [showInstructions, setShowInstructions] = useState(false)
  const [newAdminEmail, setNewAdminEmail] = useState('')
  const [newAdminName, setNewAdminName] = useState('')
  const [newAdminNotes, setNewAdminNotes] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedInstructions, setCopiedInstructions] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const { data, error: fetchError, mutate } = useSWR('/api/admin/admin-users', fetcher, {
    revalidateOnFocus: false
  })

  const admins: AdminUser[] = data?.admins || []
  const loading = !data && !fetchError

  // Filter admins by search term
  const filteredAdmins = admins.filter(admin =>
    admin.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (admin.full_name && admin.full_name.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    setAdding(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      const response = await fetch('/api/admin/admin-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          email: newAdminEmail.trim(),
          full_name: newAdminName.trim() || null,
          notes: newAdminNotes.trim() || null
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to add admin')
      }

      // Success - refresh list and show instructions
      await mutate()
      setShowAddModal(false)
      setShowInstructions(true)
      setNewAdminEmail('')
      setNewAdminName('')
      setNewAdminNotes('')
    } catch (err: any) {
      setError(err.message || 'Failed to add admin')
    } finally {
      setAdding(false)
    }
  }

  const copyInstructions = () => {
    const instructions = `Welcome to Moonlit Admin!

Here's how to create your admin account:

1. Go to: https://booking.trymoonlit.com/auth/login
2. Click "Don't have an account? Create Account"
3. Fill in your details using THIS email: ${newAdminEmail}
4. Check your email for the confirmation link
5. Once confirmed, log in and you'll have full admin access

You'll have access to all admin features including:
- Patient records
- Provider management
- Bookability rules
- Insurance payers & contracts
- Analytics & reporting

If you have any questions, contact hello@trymoonlit.com

Welcome to the team!`

    navigator.clipboard.writeText(instructions)
    setCopiedInstructions(true)
    setTimeout(() => setCopiedInstructions(false), 2000)
  }

  return (
    <div className="min-h-screen bg-[#FEF8F1] p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-[#091747] font-['Newsreader'] flex items-center gap-3">
                <Shield className="h-8 w-8 text-[#BF9C73]" />
                Admin Users
              </h1>
              <p className="text-[#091747]/70 mt-2">
                Manage who has admin access to the Moonlit platform
              </p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#BF9C73] text-white rounded-lg hover:bg-[#BF9C73]/90 transition-colors"
            >
              <Plus className="h-5 w-5" />
              Add Admin
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-[#091747]/40" />
            <input
              type="text"
              placeholder="Search by email or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent"
            />
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6 border border-stone-200">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-[#BF9C73]/10 rounded-lg">
                <Users className="h-6 w-6 text-[#BF9C73]" />
              </div>
              <div>
                <p className="text-sm text-[#091747]/60">Total Admins</p>
                <p className="text-2xl font-bold text-[#091747]">{admins.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-stone-200">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-[#091747]/60">Active</p>
                <p className="text-2xl font-bold text-[#091747]">
                  {admins.filter(a => a.is_active).length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-stone-200">
            <div className="p-3 bg-blue-100 rounded-lg inline-block mb-2">
              <Mail className="h-6 w-6 text-blue-600" />
            </div>
            <p className="text-sm text-[#091747]/60">System uses</p>
            <p className="text-sm text-[#091747] font-medium">Email-based admin verification</p>
          </div>
        </div>

        {/* Admin List */}
        <div className="bg-white rounded-lg shadow-sm border border-stone-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#091747]/60 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#091747]/60 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#091747]/60 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#091747]/60 uppercase tracking-wider">
                    Added
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#091747]/60 uppercase tracking-wider">
                    Last Login
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#091747]/60 uppercase tracking-wider">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {loading && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-[#091747]/60">
                      Loading...
                    </td>
                  </tr>
                )}
                {!loading && filteredAdmins.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-[#091747]/60">
                      {searchTerm ? 'No admins found matching your search' : 'No admins found'}
                    </td>
                  </tr>
                )}
                {filteredAdmins.map((admin) => (
                  <tr key={admin.id} className="hover:bg-stone-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-[#BF9C73]" />
                        <span className="font-medium text-[#091747]">{admin.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[#091747]/70">
                      {admin.full_name || <span className="italic text-[#091747]/40">Not provided</span>}
                    </td>
                    <td className="px-6 py-4">
                      {admin.has_account ? (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                          Account Created
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">
                          Pending Signup
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-[#091747]/70">
                      {admin.added_at ? formatDistanceToNow(new Date(admin.added_at), { addSuffix: true }) : '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-[#091747]/70">
                      {admin.last_login_at ? (
                        formatDistanceToNow(new Date(admin.last_login_at), { addSuffix: true })
                      ) : (
                        <span className="italic text-[#091747]/40">Never</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-[#091747]/70">
                      {admin.notes || <span className="italic text-[#091747]/40">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex gap-4">
            <AlertCircle className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-[#091747] mb-2">How Admin Access Works</h3>
              <ul className="space-y-2 text-sm text-[#091747]/70">
                <li>• Admins are authorized by email address</li>
                <li>• Once added to this list, they can create an account at booking.trymoonlit.com/auth/login</li>
                <li>• The system automatically grants admin access to emails in this list</li>
                <li>• For security, admin removal requires code changes (not done via UI)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Add Admin Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-[#091747] mb-4 font-['Newsreader']">Add New Admin</h2>

            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleAddAdmin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#091747] mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent"
                  placeholder="admin@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#091747] mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={newAdminName}
                  onChange={(e) => setNewAdminName(e.target.value)}
                  className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#091747] mb-2">
                  Notes
                </label>
                <input
                  type="text"
                  value={newAdminNotes}
                  onChange={(e) => setNewAdminNotes(e.target.value)}
                  className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent"
                  placeholder="e.g., Executive Assistant, Finance Lead"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false)
                    setError(null)
                    setNewAdminEmail('')
                    setNewAdminName('')
                    setNewAdminNotes('')
                  }}
                  className="flex-1 px-4 py-2 border border-stone-300 rounded-lg hover:bg-stone-50 transition-colors"
                  disabled={adding}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adding}
                  className="flex-1 px-4 py-2 bg-[#BF9C73] text-white rounded-lg hover:bg-[#BF9C73]/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {adding ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" />
                      Add Admin
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Instructions Modal */}
      {showInstructions && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
            <h2 className="text-2xl font-bold text-[#091747] mb-4 font-['Newsreader'] flex items-center gap-2">
              <CheckCircle className="h-6 w-6 text-green-600" />
              Admin Added Successfully!
            </h2>

            <div className="bg-[#FEF8F1] rounded-lg p-4 mb-4">
              <p className="text-[#091747] mb-4">
                <strong>{newAdminEmail}</strong> has been granted admin access.
                Send them these instructions to create their account:
              </p>

              <div className="bg-white rounded border border-stone-200 p-4 text-sm text-[#091747]/80 font-mono whitespace-pre-wrap">
{`Welcome to Moonlit Admin!

Here's how to create your admin account:

1. Go to: https://booking.trymoonlit.com/auth/login
2. Click "Don't have an account? Create Account"
3. Fill in your details using THIS email: ${newAdminEmail}
4. Check your email for the confirmation link
5. Once confirmed, log in and you'll have full admin access

You'll have access to all admin features including:
- Patient records
- Provider management
- Bookability rules
- Insurance payers & contracts
- Analytics & reporting

If you have any questions, contact hello@trymoonlit.com

Welcome to the team!`}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowInstructions(false)}
                className="flex-1 px-4 py-2 border border-stone-300 rounded-lg hover:bg-stone-50 transition-colors"
              >
                Close
              </button>
              <button
                onClick={copyInstructions}
                className="flex-1 px-4 py-2 bg-[#BF9C73] text-white rounded-lg hover:bg-[#BF9C73]/90 transition-colors flex items-center justify-center gap-2"
              >
                {copiedInstructions ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy Instructions
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
