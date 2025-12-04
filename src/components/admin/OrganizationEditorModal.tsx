'use client'

import { useState, useEffect } from 'react'
import {
  X,
  AlertCircle,
  CheckCircle,
  Building2,
  Users,
  Mail,
  UserPlus,
  Clock,
  RefreshCw
} from 'lucide-react'

interface Organization {
  id: string
  name: string
  slug: string
  type: string
  status: string
  primary_contact_name?: string
  primary_contact_email?: string
  primary_contact_phone?: string
  address_line_1?: string
  address_line_2?: string
  city?: string
  state?: string
  zip_code?: string
  tax_id?: string
  license_number?: string
  accreditation_details?: string
  allowed_domains?: string[]
  settings?: Record<string, any>
}

interface TeamMember {
  id: string | null
  full_name: string | null
  email: string
  role: string | null
  status: 'active' | 'pending' | 'inactive'
  active_patient_count: number
  invitation_expires?: string | null
}

interface OrganizationEditorModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  organization?: Organization | null // null = create mode, object = edit mode
  dropdownOptions: {
    types: string[]
    statuses: string[]
  }
}

const STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
]

const TEAM_ROLES = [
  { value: 'partner_admin', label: 'Admin' },
  { value: 'partner_case_manager', label: 'Case Manager' },
  { value: 'partner_referrer', label: 'Referrer' }
]

export default function OrganizationEditorModal({
  isOpen,
  onClose,
  onSuccess,
  organization,
  dropdownOptions
}: OrganizationEditorModalProps) {
  const isEditMode = !!organization

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    type: 'treatment_center',
    status: 'active',
    primary_contact_name: '',
    primary_contact_email: '',
    primary_contact_phone: '',
    address_line_1: '',
    address_line_2: '',
    city: '',
    state: '',
    zip_code: '',
    tax_id: '',
    license_number: '',
    accreditation_details: ''
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Team section state (edit mode only)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loadingTeam, setLoadingTeam] = useState(false)
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('partner_case_manager')
  const [inviteFullName, setInviteFullName] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState(false)

  // Initialize form data when organization changes
  useEffect(() => {
    if (organization) {
      setFormData({
        name: organization.name || '',
        slug: organization.slug || '',
        type: organization.type || 'treatment_center',
        status: organization.status || 'active',
        primary_contact_name: organization.primary_contact_name || '',
        primary_contact_email: organization.primary_contact_email || '',
        primary_contact_phone: organization.primary_contact_phone || '',
        address_line_1: organization.address_line_1 || '',
        address_line_2: organization.address_line_2 || '',
        city: organization.city || '',
        state: organization.state || '',
        zip_code: organization.zip_code || '',
        tax_id: organization.tax_id || '',
        license_number: organization.license_number || '',
        accreditation_details: organization.accreditation_details || ''
      })
      fetchTeamMembers(organization.id)
    } else {
      // Reset form for create mode
      setFormData({
        name: '',
        slug: '',
        type: 'treatment_center',
        status: 'active',
        primary_contact_name: '',
        primary_contact_email: '',
        primary_contact_phone: '',
        address_line_1: '',
        address_line_2: '',
        city: '',
        state: '',
        zip_code: '',
        tax_id: '',
        license_number: '',
        accreditation_details: ''
      })
      setTeamMembers([])
    }
    setError(null)
    setSuccess(false)
    setShowInviteForm(false)
    setInviteError(null)
    setInviteSuccess(false)
  }, [organization, isOpen])

  // Auto-generate slug from name (create mode only)
  const handleNameChange = (name: string) => {
    setFormData(prev => ({
      ...prev,
      name,
      // Only auto-generate slug in create mode and if slug hasn't been manually edited
      slug: !isEditMode && prev.slug === generateSlug(prev.name)
        ? generateSlug(name)
        : prev.slug
    }))
  }

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
  }

  const fetchTeamMembers = async (orgId: string) => {
    setLoadingTeam(true)
    try {
      const response = await fetch(`/api/admin/organizations/${orgId}/team`)
      const data = await response.json()

      if (data.success) {
        setTeamMembers(data.data.team_members || [])
      }
    } catch (err) {
      console.error('Error fetching team members:', err)
    } finally {
      setLoadingTeam(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      setError('Organization name is required')
      return
    }

    if (!formData.slug.trim()) {
      setError('Organization slug is required')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const url = isEditMode
        ? `/api/admin/organizations/${organization!.id}`
        : '/api/admin/organizations'

      const method = isEditMode ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `Failed to ${isEditMode ? 'update' : 'create'} organization`)
      }

      setSuccess(true)

      setTimeout(() => {
        setSuccess(false)
        onSuccess()
        onClose()
      }, 1500)

    } catch (err: any) {
      console.error('Error saving organization:', err)
      setError(err.message || 'Failed to save organization')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !inviteFullName.trim()) {
      setInviteError('Email and full name are required')
      return
    }

    setInviting(true)
    setInviteError(null)

    try {
      const response = await fetch('/api/partner-auth/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          full_name: inviteFullName.trim(),
          role: inviteRole,
          organization_id: organization!.id
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send invitation')
      }

      setInviteSuccess(true)

      setTimeout(() => {
        setInviteSuccess(false)
        setShowInviteForm(false)
        setInviteEmail('')
        setInviteFullName('')
        setInviteRole('partner_case_manager')
        // Refresh team members
        fetchTeamMembers(organization!.id)
      }, 1500)

    } catch (err: any) {
      console.error('Error sending invitation:', err)
      setInviteError(err.message || 'Failed to send invitation')
    } finally {
      setInviting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting && !inviting) {
      onClose()
    }
  }

  const formatExpiryDate = (dateString: string | null | undefined) => {
    if (!dateString) return null
    const date = new Date(dateString)
    const now = new Date()
    if (date < now) return 'Expired'
    const diff = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return `${diff} day${diff === 1 ? '' : 's'} left`
  }

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'inactive':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-[#BF9C73]/10 rounded-lg">
                <Building2 className="h-5 w-5 text-[#BF9C73]" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 font-['Newsreader']">
                  {isEditMode ? 'Edit Organization' : 'Add Organization'}
                </h2>
                {isEditMode && (
                  <p className="text-sm text-gray-500">{organization?.name}</p>
                )}
              </div>
            </div>
            <button
              onClick={handleClose}
              disabled={isSubmitting || inviting}
              className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Success Message */}
              {success && (
                <div className="flex items-center space-x-2 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                  <p className="text-sm text-green-800 font-medium">
                    Organization {isEditMode ? 'updated' : 'created'} successfully!
                  </p>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="flex items-center space-x-2 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {/* Basic Info Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-900 uppercase tracking-wider">
                  Basic Information
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      disabled={isSubmitting || success}
                      placeholder="First Step House"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent disabled:bg-gray-100"
                      required
                    />
                  </div>

                  {/* Slug */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Slug <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.slug}
                      onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                      disabled={isSubmitting || success}
                      placeholder="first-step-house"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent disabled:bg-gray-100 font-mono text-sm"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">URL-friendly identifier</p>
                  </div>

                  {/* Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Type
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                      disabled={isSubmitting || success}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent disabled:bg-gray-100"
                    >
                      {dropdownOptions.types.map(type => (
                        <option key={type} value={type}>
                          {type === 'None' ? 'Unspecified' : type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                      disabled={isSubmitting || success}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent disabled:bg-gray-100"
                    >
                      {dropdownOptions.statuses.map(status => (
                        <option key={status} value={status}>
                          {status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Contact Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-900 uppercase tracking-wider">
                  Primary Contact
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Contact Name
                    </label>
                    <input
                      type="text"
                      value={formData.primary_contact_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, primary_contact_name: e.target.value }))}
                      disabled={isSubmitting || success}
                      placeholder="John Smith"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent disabled:bg-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.primary_contact_email}
                      onChange={(e) => setFormData(prev => ({ ...prev, primary_contact_email: e.target.value }))}
                      disabled={isSubmitting || success}
                      placeholder="contact@example.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent disabled:bg-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={formData.primary_contact_phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, primary_contact_phone: e.target.value }))}
                      disabled={isSubmitting || success}
                      placeholder="(801) 555-1234"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent disabled:bg-gray-100"
                    />
                  </div>
                </div>
              </div>

              {/* Address Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-900 uppercase tracking-wider">
                  Address
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Address Line 1
                    </label>
                    <input
                      type="text"
                      value={formData.address_line_1}
                      onChange={(e) => setFormData(prev => ({ ...prev, address_line_1: e.target.value }))}
                      disabled={isSubmitting || success}
                      placeholder="123 Main Street"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent disabled:bg-gray-100"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Address Line 2
                    </label>
                    <input
                      type="text"
                      value={formData.address_line_2}
                      onChange={(e) => setFormData(prev => ({ ...prev, address_line_2: e.target.value }))}
                      disabled={isSubmitting || success}
                      placeholder="Suite 100"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent disabled:bg-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      City
                    </label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                      disabled={isSubmitting || success}
                      placeholder="Salt Lake City"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent disabled:bg-gray-100"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        State
                      </label>
                      <select
                        value={formData.state}
                        onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                        disabled={isSubmitting || success}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent disabled:bg-gray-100"
                      >
                        <option value="">Select...</option>
                        {STATES.map(state => (
                          <option key={state} value={state}>{state}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        ZIP Code
                      </label>
                      <input
                        type="text"
                        value={formData.zip_code}
                        onChange={(e) => setFormData(prev => ({ ...prev, zip_code: e.target.value }))}
                        disabled={isSubmitting || success}
                        placeholder="84101"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent disabled:bg-gray-100"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Business Info Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-900 uppercase tracking-wider">
                  Business Information
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tax ID
                    </label>
                    <input
                      type="text"
                      value={formData.tax_id}
                      onChange={(e) => setFormData(prev => ({ ...prev, tax_id: e.target.value }))}
                      disabled={isSubmitting || success}
                      placeholder="XX-XXXXXXX"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent disabled:bg-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      License Number
                    </label>
                    <input
                      type="text"
                      value={formData.license_number}
                      onChange={(e) => setFormData(prev => ({ ...prev, license_number: e.target.value }))}
                      disabled={isSubmitting || success}
                      placeholder="License #"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent disabled:bg-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Accreditation
                    </label>
                    <input
                      type="text"
                      value={formData.accreditation_details}
                      onChange={(e) => setFormData(prev => ({ ...prev, accreditation_details: e.target.value }))}
                      disabled={isSubmitting || success}
                      placeholder="JCAHO, CARF, etc."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent disabled:bg-gray-100"
                    />
                  </div>
                </div>
              </div>

              {/* Team Members Section (Edit mode only) */}
              {isEditMode && (
                <div className="space-y-4 border-t border-gray-200 pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Users className="h-5 w-5 text-gray-500" />
                      <h3 className="text-sm font-medium text-gray-900 uppercase tracking-wider">
                        Team Members
                      </h3>
                      {!loadingTeam && (
                        <span className="text-sm text-gray-500">
                          ({teamMembers.length})
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowInviteForm(!showInviteForm)}
                      disabled={isSubmitting}
                      className="text-sm text-[#BF9C73] hover:text-[#BF9C73]/80 flex items-center space-x-1"
                    >
                      <UserPlus className="h-4 w-4" />
                      <span>Invite Team Member</span>
                    </button>
                  </div>

                  {/* Invite Form */}
                  {showInviteForm && (
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-4">
                      <h4 className="text-sm font-medium text-gray-700">Send Invitation</h4>

                      {inviteSuccess && (
                        <div className="flex items-center space-x-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <p className="text-sm text-green-800">Invitation sent successfully!</p>
                        </div>
                      )}

                      {inviteError && (
                        <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                          <AlertCircle className="h-4 w-4 text-red-600" />
                          <p className="text-sm text-red-800">{inviteError}</p>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Full Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={inviteFullName}
                            onChange={(e) => setInviteFullName(e.target.value)}
                            disabled={inviting || inviteSuccess}
                            placeholder="Jane Doe"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent disabled:bg-gray-100"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Email <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="email"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            disabled={inviting || inviteSuccess}
                            placeholder="jane@example.com"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent disabled:bg-gray-100"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Role
                          </label>
                          <select
                            value={inviteRole}
                            onChange={(e) => setInviteRole(e.target.value)}
                            disabled={inviting || inviteSuccess}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent disabled:bg-gray-100"
                          >
                            {TEAM_ROLES.map(role => (
                              <option key={role.value} value={role.value}>{role.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="flex justify-end space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowInviteForm(false)
                            setInviteEmail('')
                            setInviteFullName('')
                            setInviteError(null)
                          }}
                          disabled={inviting}
                          className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleInvite}
                          disabled={inviting || inviteSuccess || !inviteEmail.trim() || !inviteFullName.trim()}
                          className="px-4 py-1.5 bg-[#BF9C73] text-white text-sm rounded-lg hover:bg-[#BF9C73]/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                        >
                          {inviting ? (
                            <>
                              <RefreshCw className="h-4 w-4 animate-spin" />
                              <span>Sending...</span>
                            </>
                          ) : (
                            <>
                              <Mail className="h-4 w-4" />
                              <span>Send Invite</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Team Members List */}
                  {loadingTeam ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="h-5 w-5 text-gray-400 animate-spin" />
                      <span className="ml-2 text-sm text-gray-500">Loading team...</span>
                    </div>
                  ) : teamMembers.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Users className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">No team members yet</p>
                      <p className="text-xs text-gray-400">Invite someone to get started</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
                      {teamMembers.map((member, index) => (
                        <div
                          key={member.id || `pending-${index}`}
                          className="flex items-center justify-between p-3 bg-white hover:bg-gray-50"
                        >
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                              <span className="text-sm font-medium text-gray-600">
                                {(member.full_name || member.email)[0].toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {member.full_name || '(Pending)'}
                              </p>
                              <p className="text-xs text-gray-500">{member.email}</p>
                            </div>
                          </div>

                          <div className="flex items-center space-x-3">
                            {member.role && (
                              <span className="text-xs text-gray-500 capitalize">
                                {member.role.replace('partner_', '')}
                              </span>
                            )}
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(member.status)}`}>
                              {member.status}
                            </span>
                            {member.status === 'pending' && member.invitation_expires && (
                              <span className="text-xs text-gray-400 flex items-center">
                                <Clock className="h-3 w-3 mr-1" />
                                {formatExpiryDate(member.invitation_expires)}
                              </span>
                            )}
                            {member.status === 'active' && (
                              <span className="text-xs text-gray-400">
                                {member.active_patient_count} patients
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </form>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting || success}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={isSubmitting || success || !formData.name.trim() || !formData.slug.trim()}
              className="px-6 py-2 bg-[#BF9C73] text-white rounded-lg hover:bg-[#BF9C73]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  {isEditMode ? 'Saving...' : 'Creating...'}
                </>
              ) : success ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {isEditMode ? 'Saved!' : 'Created!'}
                </>
              ) : (
                isEditMode ? 'Save Changes' : 'Create Organization'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
