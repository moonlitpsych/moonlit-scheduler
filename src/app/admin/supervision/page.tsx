'use client'

import { useState, useEffect } from 'react'
import {
  Network,
  Plus,
  Search,
  Edit,
  Trash2,
  Users,
  User,
  Calendar,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  Shield
} from 'lucide-react'
import { SupervisionRelationship, SupervisionLevel } from '@/types/admin-operations'

interface Provider {
  id: string
  first_name: string
  last_name: string
  email: string
  is_active: boolean
  specialty: string[]
  role_title?: string
}

interface SupervisionRelationshipWithNames extends SupervisionRelationship {
  resident_name: string
  attending_name: string
  modality_display: string
  conflicts?: string[]
}

const SUPERVISION_LEVELS: Array<{ value: SupervisionLevel; label: string; description: string }> = [
  {
    value: 'sign_off_only',
    label: 'Sign-off Only',
    description: 'Attending physician reviews and signs off on resident care'
  },
  {
    value: 'first_visit_in_person',
    label: 'First Visit In-Person',
    description: 'Attending must be present for first patient visit'
  },
  {
    value: 'co_visit_required',
    label: 'Co-visit Required',
    description: 'Attending must be present for all patient visits'
  }
]

const MODALITY_OPTIONS = [
  { value: 'telehealth', label: 'Telehealth' },
  { value: 'in_person', label: 'In-Person' },
  { value: 'phone', label: 'Phone' },
  { value: 'group', label: 'Group Sessions' }
]

export default function SupervisionPage() {
  const [relationships, setRelationships] = useState<SupervisionRelationshipWithNames[]>([])
  const [providers, setProviders] = useState<Provider[]>([])
  const [residents, setResidents] = useState<Provider[]>([])
  const [attendings, setAttendigs] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingRelationship, setEditingRelationship] = useState<SupervisionRelationshipWithNames | null>(null)
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  // Form state
  const [formData, setFormData] = useState({
    resident_provider_id: '',
    attending_provider_id: '',
    designation: 'primary' as 'primary' | 'secondary',
    effective_date: new Date().toISOString().split('T')[0],
    expiration_date: '',
    modality_constraints: [] as string[],
    concurrency_cap: '',
    notes: ''
  })

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [relationshipsResponse, providersResponse] = await Promise.all([
          fetch('/api/admin/supervision-relationships'),
          fetch('/api/admin/providers-list')
        ])

        if (relationshipsResponse.ok) {
          const relationshipsResult = await relationshipsResponse.json()
          setRelationships(relationshipsResult.data || [])
        }

        if (providersResponse.ok) {
          const providersResult = await providersResponse.json()
          const allProviders = providersResult.data || []
          setProviders(allProviders)
          
          // Separate residents and attendings based on role/experience
          const residentList = allProviders.filter((p: Provider) => 
            p.role_title?.toLowerCase().includes('resident') ||
            p.role_title?.toLowerCase().includes('fellow') ||
            (!p.role_title && p.first_name && p.last_name) // Include providers without specific titles as potential residents
          )
          const attendingList = allProviders.filter((p: Provider) => 
            p.role_title?.toLowerCase().includes('attending') ||
            p.role_title?.toLowerCase().includes('physician') ||
            p.role_title?.toLowerCase().includes('doctor') ||
            p.role_title?.toLowerCase().includes('md')
          )
          
          setResidents(residentList)
          setAttendigs(attendingList)
        }
      } catch (error) {
        console.error('Error fetching supervision data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // Validation logic
  const validateRelationship = async (data: typeof formData): Promise<string[]> => {
    const errors = []
    
    // Basic validation
    if (!data.resident_provider_id) errors.push('Resident is required')
    if (!data.attending_provider_id) errors.push('Attending physician is required')
    if (data.resident_provider_id === data.attending_provider_id) {
      errors.push('Resident and attending cannot be the same person')
    }

    // Check for overlapping relationships
    if (data.resident_provider_id && data.attending_provider_id) {
      const existingRelationships = relationships.filter(r => 
        r.id !== editingRelationship?.id &&
        r.resident_provider_id === data.resident_provider_id &&
        r.status === 'active'
      )

      if (existingRelationships.length > 0) {
        const effectiveDate = new Date(data.effective_date)
        const expirationDate = data.expiration_date ? new Date(data.expiration_date) : null

        for (const existing of existingRelationships) {
          const existingEffective = new Date(existing.effective_date)
          const existingExpiration = existing.expiration_date ? new Date(existing.expiration_date) : null

          // Check for date overlaps
          const hasOverlap = (
            // New relationship starts during existing relationship
            (effectiveDate >= existingEffective && (!existingExpiration || effectiveDate <= existingExpiration)) ||
            // New relationship ends during existing relationship
            (expirationDate && expirationDate >= existingEffective && (!existingExpiration || expirationDate <= existingExpiration)) ||
            // New relationship spans existing relationship
            (effectiveDate <= existingEffective && (!expirationDate || (existingExpiration && expirationDate >= existingExpiration)))
          )

          if (hasOverlap) {
            errors.push(`Overlapping supervision period with existing ${existing.designation} relationship (${existing.attending_name})`)
          }
        }
      }

      // Check primary designation limits
      if (data.designation === 'primary') {
        const existingPrimary = relationships.find(r => 
          r.id !== editingRelationship?.id &&
          r.resident_provider_id === data.resident_provider_id &&
          r.designation === 'primary' &&
          r.status === 'active'
        )
        if (existingPrimary) {
          errors.push('Resident already has a primary supervising physician')
        }
      }
    }

    // Validate concurrency cap
    if (data.concurrency_cap && (parseInt(data.concurrency_cap) < 1 || parseInt(data.concurrency_cap) > 100)) {
      errors.push('Concurrency cap must be between 1 and 100')
    }

    return errors
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate
    const errors = await validateRelationship(formData)
    if (errors.length > 0) {
      setValidationErrors(errors)
      return
    }
    setValidationErrors([])

    try {
      const url = editingRelationship 
        ? `/api/admin/supervision-relationships/${editingRelationship.id}`
        : '/api/admin/supervision-relationships'
      
      const method = editingRelationship ? 'PUT' : 'POST'
      
      const payload = {
        ...formData,
        concurrency_cap: formData.concurrency_cap ? parseInt(formData.concurrency_cap) : null
      }
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        // Refresh data
        window.location.reload()
      } else {
        const error = await response.json()
        setValidationErrors([error.message || 'Failed to save supervision relationship'])
      }
    } catch (error) {
      console.error('Error saving supervision relationship:', error)
      setValidationErrors(['Error saving supervision relationship'])
    }
  }

  const handleEdit = (relationship: SupervisionRelationshipWithNames) => {
    setEditingRelationship(relationship)
    setFormData({
      resident_provider_id: relationship.resident_provider_id,
      attending_provider_id: relationship.attending_provider_id,
      designation: relationship.designation,
      effective_date: relationship.effective_date,
      expiration_date: relationship.expiration_date || '',
      modality_constraints: relationship.modality_constraints || [],
      concurrency_cap: relationship.concurrency_cap?.toString() || '',
      notes: relationship.notes || ''
    })
    setValidationErrors([])
    setShowCreateModal(true)
  }

  const handleDelete = async (relationshipId: string) => {
    if (!confirm('Are you sure you want to delete this supervision relationship?')) return

    try {
      const response = await fetch(`/api/admin/supervision-relationships/${relationshipId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        window.location.reload()
      } else {
        alert('Error deleting relationship')
      }
    } catch (error) {
      console.error('Error deleting supervision relationship:', error)
      alert('Error deleting relationship')
    }
  }

  const resetForm = () => {
    setFormData({
      resident_provider_id: '',
      attending_provider_id: '',
      designation: 'primary',
      effective_date: new Date().toISOString().split('T')[0],
      expiration_date: '',
      modality_constraints: [],
      concurrency_cap: '',
      notes: ''
    })
    setEditingRelationship(null)
    setValidationErrors([])
    setShowCreateModal(false)
  }

  const filteredRelationships = relationships.filter(rel =>
    rel.resident_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rel.attending_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (rel.notes && rel.notes.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#091747] font-['Newsreader'] mb-2">
          Supervision Mapper
        </h1>
        <p className="text-[#091747]/70">
          Map residents to attending physicians with effective dates and constraints
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm p-6 border border-stone-200">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Network className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Relationships</p>
              <p className="text-2xl font-bold text-[#091747]">{relationships.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-6 border border-stone-200">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Active</p>
              <p className="text-2xl font-bold text-[#091747]">
                {relationships.filter(r => r.status === 'active').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-stone-200">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Shield className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Primary</p>
              <p className="text-2xl font-bold text-[#091747]">
                {relationships.filter(r => r.designation === 'primary').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-stone-200">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-[#BF9C73]/20 rounded-lg">
              <Users className="h-6 w-6 text-[#BF9C73]" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Supervised Residents</p>
              <p className="text-2xl font-bold text-[#091747]">
                {new Set(relationships.map(r => r.resident_provider_id)).size}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search supervision relationships..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent w-full"
            />
          </div>

          <button
            onClick={() => {
              resetForm()
              setShowCreateModal(true)
            }}
            className="bg-[#BF9C73] hover:bg-[#BF9C73]/90 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Add Relationship</span>
          </button>
        </div>
      </div>

      {/* Relationships Table */}
      <div className="bg-white rounded-lg shadow-sm border border-stone-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-stone-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Resident
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Attending
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Designation
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Period
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Constraints
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-stone-200">
              {filteredRelationships.map((relationship) => (
                <tr key={relationship.id} className="hover:bg-stone-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-blue-100 rounded-full">
                        <User className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-[#091747]">
                          {relationship.resident_name}
                        </div>
                        <div className="text-sm text-gray-500">Resident</div>
                      </div>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-green-100 rounded-full">
                        <Shield className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-[#091747]">
                          {relationship.attending_name}
                        </div>
                        <div className="text-sm text-gray-500">Attending</div>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      relationship.designation === 'primary' 
                        ? 'bg-purple-100 text-purple-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {relationship.designation === 'primary' ? 'Primary' : 'Secondary'}
                    </span>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div>
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-3 w-3" />
                        <span>{new Date(relationship.effective_date).toLocaleDateString()}</span>
                      </div>
                      {relationship.expiration_date && (
                        <div className="text-xs text-gray-400 mt-1">
                          Until: {new Date(relationship.expiration_date).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="space-y-1">
                      <div className="text-sm text-gray-900">
                        {relationship.modality_display}
                      </div>
                      {relationship.concurrency_cap && (
                        <div className="text-xs text-gray-500">
                          Max: {relationship.concurrency_cap} concurrent
                        </div>
                      )}
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col space-y-1">
                      <span className={`inline-flex w-fit px-2 py-1 rounded-full text-xs font-medium ${
                        relationship.status === 'active' ? 'bg-green-100 text-green-800' :
                        relationship.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {relationship.status}
                      </span>
                      {relationship.conflicts && relationship.conflicts.length > 0 && (
                        <div className="flex items-center space-x-1 text-xs text-red-600">
                          <AlertTriangle className="h-3 w-3" />
                          <span>{relationship.conflicts.length} conflicts</span>
                        </div>
                      )}
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => handleEdit(relationship)}
                        className="text-[#BF9C73] hover:text-[#BF9C73]/80"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(relationship.id)}
                        className="text-red-600 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredRelationships.length === 0 && (
          <div className="p-12 text-center">
            <Network className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-[#091747] mb-2">
              No supervision relationships found
            </h3>
            <p className="text-gray-500 mb-6">
              Create your first supervision relationship to map residents to attendings.
            </p>
            <button
              onClick={() => {
                resetForm()
                setShowCreateModal(true)
              }}
              className="bg-[#BF9C73] hover:bg-[#BF9C73]/90 text-white px-6 py-2 rounded-lg transition-colors"
            >
              Add First Relationship
            </button>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-[#091747]">
                {editingRelationship ? 'Edit' : 'Create'} Supervision Relationship
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Map a resident to an attending physician with supervision constraints
              </p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Validation Errors */}
              {validationErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <span className="text-sm font-medium text-red-600">Please fix the following errors:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1">
                    {validationErrors.map((error, index) => (
                      <li key={index} className="text-sm text-red-600">{error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Provider Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Resident *
                  </label>
                  <select
                    value={formData.resident_provider_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, resident_provider_id: e.target.value }))}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent"
                  >
                    <option value="">Select a resident...</option>
                    {residents.map(resident => (
                      <option key={resident.id} value={resident.id}>
                        Dr. {resident.first_name} {resident.last_name}
                        {resident.role_title && ` (${resident.role_title})`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Attending Physician *
                  </label>
                  <select
                    value={formData.attending_provider_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, attending_provider_id: e.target.value }))}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent"
                  >
                    <option value="">Select an attending...</option>
                    {attendings.map(attending => (
                      <option key={attending.id} value={attending.id}>
                        Dr. {attending.first_name} {attending.last_name}
                        {attending.role_title && ` (${attending.role_title})`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Designation */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Designation *
                </label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-3">
                    <input
                      type="radio"
                      id="primary"
                      value="primary"
                      checked={formData.designation === 'primary'}
                      onChange={(e) => setFormData(prev => ({ ...prev, designation: e.target.value as any }))}
                      className="h-4 w-4 text-[#BF9C73] focus:ring-[#BF9C73] border-gray-300"
                    />
                    <div>
                      <label htmlFor="primary" className="text-sm font-medium text-gray-700">
                        Primary
                      </label>
                      <p className="text-xs text-gray-500">Main supervising physician for this resident</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <input
                      type="radio"
                      id="secondary"
                      value="secondary"
                      checked={formData.designation === 'secondary'}
                      onChange={(e) => setFormData(prev => ({ ...prev, designation: e.target.value as any }))}
                      className="h-4 w-4 text-[#BF9C73] focus:ring-[#BF9C73] border-gray-300"
                    />
                    <div>
                      <label htmlFor="secondary" className="text-sm font-medium text-gray-700">
                        Secondary
                      </label>
                      <p className="text-xs text-gray-500">Additional supervising physician for backup or specific cases</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Effective Date *
                  </label>
                  <input
                    type="date"
                    value={formData.effective_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, effective_date: e.target.value }))}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Expiration Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={formData.expiration_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, expiration_date: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent"
                  />
                </div>
              </div>

              {/* Modality Constraints */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Modality Constraints (Optional)
                </label>
                <div className="space-y-2">
                  {MODALITY_OPTIONS.map(modality => (
                    <div key={modality.value} className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id={modality.value}
                        checked={formData.modality_constraints.includes(modality.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData(prev => ({
                              ...prev,
                              modality_constraints: [...prev.modality_constraints, modality.value]
                            }))
                          } else {
                            setFormData(prev => ({
                              ...prev,
                              modality_constraints: prev.modality_constraints.filter(m => m !== modality.value)
                            }))
                          }
                        }}
                        className="h-4 w-4 text-[#BF9C73] focus:ring-[#BF9C73] border-gray-300 rounded"
                      />
                      <label htmlFor={modality.value} className="text-sm text-gray-700">
                        {modality.label}
                      </label>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Leave empty to allow all modalities. Select specific modalities to restrict supervision to those types only.
                </p>
              </div>

              {/* Concurrency Cap */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Concurrency Cap (Optional)
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={formData.concurrency_cap}
                  onChange={(e) => setFormData(prev => ({ ...prev, concurrency_cap: e.target.value }))}
                  placeholder="Maximum concurrent patients under supervision"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Maximum number of patients this resident can see concurrently under this attending's supervision
                </p>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Optional notes about this supervision relationship..."
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#BF9C73] hover:bg-[#BF9C73]/90 text-white rounded-lg transition-colors"
                >
                  {editingRelationship ? 'Update' : 'Create'} Relationship
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}