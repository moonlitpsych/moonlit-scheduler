// Partner CRM Interface - Admin Only
'use client'

import { useEffect, useState } from 'react'
import { PartnerHeader } from '@/components/partner-dashboard/PartnerHeader'
import { PartnersTable } from '@/components/partner-dashboard/PartnersTable'
import { CreatePartnerModal } from '@/components/partner-dashboard/CreatePartnerModal'
import { EditPartnerModal } from '@/components/partner-dashboard/EditPartnerModal'
import { PartnerFilters } from '@/components/partner-dashboard/PartnerFilters'
import { Partner, PartnerUser } from '@/types/partner-types'

// Mock partner user for development - replace with actual auth
const mockPartnerUser: PartnerUser = {
  id: 'user-123',
  organization_id: 'org-456',
  first_name: 'Sarah',
  last_name: 'Johnson',
  email: 'sarah@firststephouse.org',
  role: 'partner_admin',
  status: 'active',
  timezone: 'America/Denver',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  organization: {
    id: 'org-456',
    name: 'First Step House',
    slug: 'first-step-house',
    type: 'treatment_center',
    status: 'active',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  }
}

interface PartnersPageState {
  partners: Partner[]
  loading: boolean
  error: string | null
  pagination: {
    page: number
    per_page: number
    total: number
    total_pages: number
  }
  filters: {
    search: string
    status: string
    stage: string
    hasOrganization: string
  }
}

export default function PartnersPage() {
  const [state, setState] = useState<PartnersPageState>({
    partners: [],
    loading: true,
    error: null,
    pagination: {
      page: 1,
      per_page: 20,
      total: 0,
      total_pages: 0
    },
    filters: {
      search: '',
      status: '',
      stage: '',
      hasOrganization: ''
    }
  })

  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)

  // Fetch partners from API
  const fetchPartners = async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }))
      
      const params = new URLSearchParams()
      params.set('page', state.pagination.page.toString())
      params.set('per_page', state.pagination.per_page.toString())
      
      if (state.filters.search) params.set('search', state.filters.search)
      if (state.filters.status) params.set('status', state.filters.status)
      if (state.filters.stage) params.set('stage', state.filters.stage)
      if (state.filters.hasOrganization) params.set('has_organization', state.filters.hasOrganization)

      const response = await fetch(`/api/partners?${params.toString()}`)
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch partners')
      }

      setState(prev => ({
        ...prev,
        partners: data.data || [],
        pagination: data.pagination || prev.pagination,
        loading: false
      }))

    } catch (error: any) {
      console.error('Failed to fetch partners:', error)
      setState(prev => ({
        ...prev,
        error: error.message || 'Failed to fetch partners',
        loading: false
      }))
    }
  }

  // Load partners on component mount and when filters change
  useEffect(() => {
    fetchPartners()
  }, [state.pagination.page, state.filters])

  const handleFilterChange = (newFilters: Partial<typeof state.filters>) => {
    setState(prev => ({
      ...prev,
      filters: { ...prev.filters, ...newFilters },
      pagination: { ...prev.pagination, page: 1 } // Reset to first page
    }))
  }

  const handlePageChange = (newPage: number) => {
    setState(prev => ({
      ...prev,
      pagination: { ...prev.pagination, page: newPage }
    }))
  }

  const handleCreatePartner = () => {
    setShowCreateModal(true)
  }

  const handleEditPartner = (partner: Partner) => {
    setSelectedPartner(partner)
    setShowEditModal(true)
  }

  const handlePartnerCreated = (partner: Partner) => {
    setState(prev => ({
      ...prev,
      partners: [partner, ...prev.partners]
    }))
    setShowCreateModal(false)
    fetchPartners() // Refresh to get accurate counts
  }

  const handlePartnerUpdated = (updatedPartner: Partner) => {
    setState(prev => ({
      ...prev,
      partners: prev.partners.map(p => 
        p.id === updatedPartner.id ? updatedPartner : p
      )
    }))
    setShowEditModal(false)
    setSelectedPartner(null)
  }

  const handleDeletePartner = async (partnerId: string) => {
    if (!window.confirm('Are you sure you want to delete this partner? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch(`/api/partners/${partnerId}`, {
        method: 'DELETE'
      })
      
      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to delete partner')
      }

      // Remove partner from list or refresh data
      fetchPartners()
      alert('Partner deleted successfully')
      
    } catch (error: any) {
      console.error('Failed to delete partner:', error)
      alert(`Failed to delete partner: ${error.message}`)
    }
  }

  // Check if user has admin access
  if (mockPartnerUser.role !== 'partner_admin') {
    return (
      <div className="min-h-screen bg-moonlit-cream">
        <PartnerHeader partnerUser={mockPartnerUser} currentPage="partners" />
        <div className="container mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-800 mb-2 font-['Newsreader']">Access Restricted</h2>
            <p className="text-red-600 font-['Newsreader'] font-light">
              You don't have permission to access the partner CRM. Only administrators can manage partners.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-moonlit-cream">
      <PartnerHeader partnerUser={mockPartnerUser} currentPage="partners" />
      
      <div className="container mx-auto px-4 py-8">
        {/* Page header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-moonlit-navy mb-2 font-['Newsreader']">
                Partner CRM
              </h1>
              <p className="text-gray-600 font-['Newsreader'] font-light">
                Manage referral partners and track relationships through the pipeline.
              </p>
            </div>
            <button
              onClick={handleCreatePartner}
              className="px-4 py-2 bg-moonlit-brown text-white font-medium font-['Newsreader'] rounded-lg hover:bg-moonlit-brown-hover transition-colors"
            >
              Add New Partner
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6">
          <PartnerFilters
            filters={state.filters}
            onFilterChange={handleFilterChange}
            loading={state.loading}
          />
        </div>

        {/* Error state */}
        {state.error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <span className="text-red-600 font-medium font-['Newsreader']">Error:</span>
              <span className="text-red-600 font-['Newsreader']">{state.error}</span>
            </div>
            <button
              onClick={fetchPartners}
              className="mt-2 text-red-700 hover:text-red-900 font-medium font-['Newsreader'] underline"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Partners table */}
        <div className="bg-white rounded-lg border border-gray-200">
          <PartnersTable
            partners={state.partners}
            loading={state.loading}
            pagination={state.pagination}
            onPageChange={handlePageChange}
            onEditPartner={handleEditPartner}
            onDeletePartner={handleDeletePartner}
          />
        </div>

        {/* Statistics */}
        {!state.loading && state.partners.length > 0 && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-2xl font-bold text-moonlit-navy">
                {state.pagination.total}
              </div>
              <div className="text-sm text-gray-600 font-['Newsreader']">Total Partners</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-2xl font-bold text-moonlit-brown">
                {state.partners.filter(p => p.status === 'active').length}
              </div>
              <div className="text-sm text-gray-600 font-['Newsreader']">Active Partners</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-2xl font-bold text-moonlit-peach">
                {state.partners.filter(p => p.stage === 'live').length}
              </div>
              <div className="text-sm text-gray-600 font-['Newsreader']">Live Partners</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-2xl font-bold text-moonlit-orange">
                {state.partners.filter(p => p.stage === 'lead' || p.stage === 'qualified').length}
              </div>
              <div className="text-sm text-gray-600 font-['Newsreader']">In Pipeline</div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreatePartnerModal
          onClose={() => setShowCreateModal(false)}
          onPartnerCreated={handlePartnerCreated}
        />
      )}

      {showEditModal && selectedPartner && (
        <EditPartnerModal
          partner={selectedPartner}
          onClose={() => {
            setShowEditModal(false)
            setSelectedPartner(null)
          }}
          onPartnerUpdated={handlePartnerUpdated}
        />
      )}
    </div>
  )
}