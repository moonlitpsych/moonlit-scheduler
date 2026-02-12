'use client'

import { useState, useEffect } from 'react'
import { Search, Building2, ChevronLeft, Plus, Edit2, Check, X } from 'lucide-react'
import Link from 'next/link'
import ReferralOrgEditorModal from '@/components/admin/referral-network/ReferralOrgEditorModal'
import type { ReferralOrganization } from '@/types/referral-network'

interface Organization {
  id: string
  name: string
  type?: string
  status: string
  city?: string
  state?: string
  primary_contact_name?: string
  primary_contact_phone?: string
  is_referral_destination?: boolean
  referral_notes?: string
  referral_internal_notes?: string
  hours_of_operation?: string
  website?: string
  fax?: string
}

export default function ManageReferralNetworkPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'referral' | 'potential'>('referral')

  // Editor modal state
  const [selectedOrg, setSelectedOrg] = useState<ReferralOrganization | null>(null)
  const [isEditorOpen, setIsEditorOpen] = useState(false)

  // Fetch organizations
  useEffect(() => {
    async function fetchOrganizations() {
      try {
        const response = await fetch('/api/admin/organizations?per_page=200')
        if (response.ok) {
          const data = await response.json()
          setOrganizations(data.organizations || [])
        }
      } catch (error) {
        console.error('Error fetching organizations:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchOrganizations()
  }, [])

  // Filter organizations
  const filteredOrgs = organizations.filter(org => {
    // Search filter
    const matchesSearch = !searchQuery ||
      org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.city?.toLowerCase().includes(searchQuery.toLowerCase())

    // Type filter
    let matchesType = true
    if (filterType === 'referral') {
      matchesType = org.is_referral_destination === true
    } else if (filterType === 'potential') {
      matchesType = org.is_referral_destination !== true
    }

    return matchesSearch && matchesType && org.status === 'active'
  })

  // Handle edit click
  const handleEditClick = async (org: Organization) => {
    // Fetch full organization data with relationships
    try {
      const [orgRes, payersRes, careTypesRes, specialtiesRes] = await Promise.all([
        fetch(`/api/admin/organizations/${org.id}`),
        fetch(`/api/admin/referral-network/organizations/${org.id}/payers`).catch(() => null),
        fetch(`/api/admin/referral-network/organizations/${org.id}/care-types`).catch(() => null),
        fetch(`/api/admin/referral-network/organizations/${org.id}/specialties`).catch(() => null)
      ])

      let fullOrg: ReferralOrganization = {
        ...org,
        is_referral_destination: org.is_referral_destination || false,
        accepted_payers: [],
        care_types: [],
        specialties: []
      }

      if (orgRes.ok) {
        const orgData = await orgRes.json()
        fullOrg = { ...fullOrg, ...orgData }
      }

      // Note: These endpoints may not exist yet - the modal will handle empty arrays
      if (payersRes?.ok) {
        const data = await payersRes.json()
        fullOrg.accepted_payers = data.payers || []
      }
      if (careTypesRes?.ok) {
        const data = await careTypesRes.json()
        fullOrg.care_types = data.care_types || []
      }
      if (specialtiesRes?.ok) {
        const data = await specialtiesRes.json()
        fullOrg.specialties = data.specialties || []
      }

      setSelectedOrg(fullOrg)
      setIsEditorOpen(true)
    } catch (error) {
      console.error('Error fetching organization details:', error)
      // Open with basic data
      setSelectedOrg({
        ...org,
        is_referral_destination: org.is_referral_destination || false,
        accepted_payers: [],
        care_types: [],
        specialties: []
      })
      setIsEditorOpen(true)
    }
  }

  // Handle save from editor
  const handleSave = async (data: any) => {
    if (!selectedOrg) return

    try {
      // Update organization fields
      const updateResponse = await fetch(`/api/admin/organizations/${selectedOrg.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_referral_destination: data.is_referral_destination,
          referral_notes: data.referral_notes,
          referral_internal_notes: data.referral_internal_notes,
          hours_of_operation: data.hours_of_operation,
          website: data.website,
          fax: data.fax
        })
      })

      if (!updateResponse.ok) {
        throw new Error('Failed to update organization')
      }

      // Update relationships - these would need dedicated endpoints
      // For now, we'll update the payers, care types, and specialties via separate calls
      await Promise.all([
        fetch(`/api/admin/referral-network/organizations/${selectedOrg.id}/payers`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payer_ids: data.accepted_payer_ids })
        }).catch(() => null),
        fetch(`/api/admin/referral-network/organizations/${selectedOrg.id}/care-types`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ care_type_ids: data.care_type_ids })
        }).catch(() => null),
        fetch(`/api/admin/referral-network/organizations/${selectedOrg.id}/specialties`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ specialty_tag_ids: data.specialty_tag_ids })
        }).catch(() => null)
      ])

      // Refresh organization list
      const response = await fetch('/api/admin/organizations?per_page=200')
      if (response.ok) {
        const refreshData = await response.json()
        setOrganizations(refreshData.organizations || [])
      }

      setIsEditorOpen(false)
      setSelectedOrg(null)
    } catch (error) {
      console.error('Error saving organization:', error)
      throw error
    }
  }

  // Quick toggle referral destination
  const handleQuickToggle = async (org: Organization) => {
    try {
      const response = await fetch(`/api/admin/organizations/${org.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_referral_destination: !org.is_referral_destination
        })
      })

      if (response.ok) {
        setOrganizations(prev =>
          prev.map(o =>
            o.id === org.id ? { ...o, is_referral_destination: !o.is_referral_destination } : o
          )
        )
      }
    } catch (error) {
      console.error('Error toggling referral status:', error)
    }
  }

  const referralCount = organizations.filter(o => o.is_referral_destination).length
  const potentialCount = organizations.filter(o => o.status === 'active' && !o.is_referral_destination).length

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/admin/referral-network"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#091747] mb-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Generator
        </Link>
        <h1 className="text-2xl font-bold text-[#091747] font-['Newsreader']">
          Manage Referral Network
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure which organizations appear in referral searches
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-[#091747]">{referralCount}</div>
          <div className="text-sm text-gray-500">Referral Destinations</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-[#091747]">{potentialCount}</div>
          <div className="text-sm text-gray-500">Potential Destinations</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-[#091747]">{organizations.length}</div>
          <div className="text-sm text-gray-500">Total Organizations</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-4 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search organizations..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73]/20 focus:border-[#BF9C73]"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setFilterType('referral')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  filterType === 'referral'
                    ? 'bg-white text-[#091747] shadow-sm'
                    : 'text-gray-600 hover:text-[#091747]'
                }`}
              >
                Referral Destinations ({referralCount})
              </button>
              <button
                onClick={() => setFilterType('potential')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  filterType === 'potential'
                    ? 'bg-white text-[#091747] shadow-sm'
                    : 'text-gray-600 hover:text-[#091747]'
                }`}
              >
                Add from Existing ({potentialCount})
              </button>
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  filterType === 'all'
                    ? 'bg-white text-[#091747] shadow-sm'
                    : 'text-gray-600 hover:text-[#091747]'
                }`}
              >
                All
              </button>
            </div>
          </div>
        </div>

        {/* Organization List */}
        <div className="divide-y divide-gray-100">
          {loading ? (
            <div className="p-8 text-center">
              <div className="inline-block w-8 h-8 border-2 border-[#BF9C73]/30 border-t-[#BF9C73] rounded-full animate-spin" />
              <p className="mt-2 text-gray-500">Loading organizations...</p>
            </div>
          ) : filteredOrgs.length === 0 ? (
            <div className="p-8 text-center">
              <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No organizations found</p>
              {filterType === 'referral' && (
                <p className="text-sm text-gray-400 mt-1">
                  Switch to &quot;Add from Existing&quot; to enable organizations as referral destinations
                </p>
              )}
            </div>
          ) : (
            filteredOrgs.map(org => (
              <div
                key={org.id}
                className="flex items-center justify-between p-4 hover:bg-gray-50"
              >
                <div className="flex items-center gap-4">
                  {/* Quick Toggle */}
                  <button
                    onClick={() => handleQuickToggle(org)}
                    className={`p-2 rounded-lg transition-colors ${
                      org.is_referral_destination
                        ? 'bg-green-100 text-green-600'
                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                    }`}
                    title={org.is_referral_destination ? 'Remove from referral network' : 'Add to referral network'}
                  >
                    {org.is_referral_destination ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <Plus className="h-5 w-5" />
                    )}
                  </button>

                  {/* Org Info */}
                  <div>
                    <h3 className="font-medium text-[#091747]">{org.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      {org.city && org.state && <span>{org.city}, {org.state}</span>}
                      {org.type && (
                        <>
                          <span className="text-gray-300">•</span>
                          <span className="capitalize">{org.type.replace(/_/g, ' ')}</span>
                        </>
                      )}
                      {org.primary_contact_phone && (
                        <>
                          <span className="text-gray-300">•</span>
                          <span>{org.primary_contact_phone}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <button
                  onClick={() => handleEditClick(org)}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-[#091747] hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Edit2 className="h-4 w-4" />
                  Edit Referral Settings
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Editor Modal */}
      {selectedOrg && (
        <ReferralOrgEditorModal
          organization={selectedOrg}
          isOpen={isEditorOpen}
          onClose={() => {
            setIsEditorOpen(false)
            setSelectedOrg(null)
          }}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
