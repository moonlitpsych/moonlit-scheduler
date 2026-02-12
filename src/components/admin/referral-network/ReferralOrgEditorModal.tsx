'use client'

import { useState, useEffect } from 'react'
import { X, Building2, Save, Loader2 } from 'lucide-react'
import type {
  ReferralOrganization,
  ReferralCareType,
  ReferralSpecialtyTag,
  SpecialtyTagsResponse
} from '@/types/referral-network'

interface Payer {
  id: string
  name: string
}

interface ReferralOrgEditorModalProps {
  organization: ReferralOrganization
  isOpen: boolean
  onClose: () => void
  onSave: (data: ReferralOrgEditorData) => Promise<void>
}

interface ReferralOrgEditorData {
  is_referral_destination: boolean
  referral_notes: string
  referral_internal_notes: string
  hours_of_operation: string
  website: string
  fax: string
  accepted_payer_ids: string[]
  care_type_ids: string[]
  specialty_tag_ids: string[]
}

export default function ReferralOrgEditorModal({
  organization,
  isOpen,
  onClose,
  onSave
}: ReferralOrgEditorModalProps) {
  // Reference data
  const [payers, setPayers] = useState<Payer[]>([])
  const [careTypes, setCareTypes] = useState<ReferralCareType[]>([])
  const [specialtyTags, setSpecialtyTags] = useState<SpecialtyTagsResponse | null>(null)
  const [loadingData, setLoadingData] = useState(true)

  // Form state
  const [formData, setFormData] = useState<ReferralOrgEditorData>({
    is_referral_destination: organization.is_referral_destination || false,
    referral_notes: organization.referral_notes || '',
    referral_internal_notes: organization.referral_internal_notes || '',
    hours_of_operation: organization.hours_of_operation || '',
    website: organization.website || '',
    fax: organization.fax || '',
    accepted_payer_ids: organization.accepted_payers?.map(p => p.payer_id) || [],
    care_type_ids: organization.care_types?.map(c => c.care_type_id) || [],
    specialty_tag_ids: organization.specialties?.map(s => s.specialty_tag_id) || []
  })

  const [isSaving, setIsSaving] = useState(false)

  // Fetch reference data
  useEffect(() => {
    async function fetchData() {
      try {
        const [payersRes, careTypesRes, tagsRes] = await Promise.all([
          fetch('/api/admin/payers'),
          fetch('/api/admin/referral-network/care-types'),
          fetch('/api/admin/referral-network/specialty-tags')
        ])

        if (payersRes.ok) {
          const data = await payersRes.json()
          setPayers((data.payers || data || []).filter((p: any) =>
            p.status_code === 'active' || p.status_code === 'pending'
          ))
        }

        if (careTypesRes.ok) {
          const data = await careTypesRes.json()
          setCareTypes(data.care_types || [])
        }

        if (tagsRes.ok) {
          const data = await tagsRes.json()
          setSpecialtyTags(data)
        }
      } catch (error) {
        console.error('Error fetching reference data:', error)
      } finally {
        setLoadingData(false)
      }
    }

    if (isOpen) {
      fetchData()
    }
  }, [isOpen])

  // Reset form when organization changes
  useEffect(() => {
    setFormData({
      is_referral_destination: organization.is_referral_destination || false,
      referral_notes: organization.referral_notes || '',
      referral_internal_notes: organization.referral_internal_notes || '',
      hours_of_operation: organization.hours_of_operation || '',
      website: organization.website || '',
      fax: organization.fax || '',
      accepted_payer_ids: organization.accepted_payers?.map(p => p.payer_id) || [],
      care_type_ids: organization.care_types?.map(c => c.care_type_id) || [],
      specialty_tag_ids: organization.specialties?.map(s => s.specialty_tag_id) || []
    })
  }, [organization])

  // Toggle handlers
  const togglePayer = (id: string) => {
    setFormData(prev => ({
      ...prev,
      accepted_payer_ids: prev.accepted_payer_ids.includes(id)
        ? prev.accepted_payer_ids.filter(x => x !== id)
        : [...prev.accepted_payer_ids, id]
    }))
  }

  const toggleCareType = (id: string) => {
    setFormData(prev => ({
      ...prev,
      care_type_ids: prev.care_type_ids.includes(id)
        ? prev.care_type_ids.filter(x => x !== id)
        : [...prev.care_type_ids, id]
    }))
  }

  const toggleSpecialty = (id: string) => {
    setFormData(prev => ({
      ...prev,
      specialty_tag_ids: prev.specialty_tag_ids.includes(id)
        ? prev.specialty_tag_ids.filter(x => x !== id)
        : [...prev.specialty_tag_ids, id]
    }))
  }

  // Handle save
  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave(formData)
      onClose()
    } catch (error) {
      console.error('Save error:', error)
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#BF9C73]/10 rounded-lg">
              <Building2 className="h-5 w-5 text-[#BF9C73]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#091747]">
                Edit Referral Settings
              </h2>
              <p className="text-sm text-gray-500">{organization.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {loadingData ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 text-[#BF9C73] animate-spin" />
            </div>
          ) : (
            <>
              {/* Referral Destination Toggle */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <h3 className="font-medium text-[#091747]">Referral Destination</h3>
                  <p className="text-sm text-gray-500">
                    Enable this to include in referral searches
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_referral_destination}
                    onChange={e => setFormData(prev => ({
                      ...prev,
                      is_referral_destination: e.target.checked
                    }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-300 peer-focus:ring-2 peer-focus:ring-[#BF9C73]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#BF9C73]"></div>
                </label>
              </div>

              {/* Basic Info */}
              <div className="space-y-4">
                <h3 className="font-medium text-[#091747]">Referral Information</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Website
                    </label>
                    <input
                      type="url"
                      value={formData.website}
                      onChange={e => setFormData(prev => ({ ...prev, website: e.target.value }))}
                      placeholder="https://example.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73]/20 focus:border-[#BF9C73]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fax Number
                    </label>
                    <input
                      type="tel"
                      value={formData.fax}
                      onChange={e => setFormData(prev => ({ ...prev, fax: e.target.value }))}
                      placeholder="(801) 555-0000"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73]/20 focus:border-[#BF9C73]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Hours of Operation
                  </label>
                  <input
                    type="text"
                    value={formData.hours_of_operation}
                    onChange={e => setFormData(prev => ({ ...prev, hours_of_operation: e.target.value }))}
                    placeholder="Mon-Fri 8am-5pm"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73]/20 focus:border-[#BF9C73]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Referral Notes (shown on PDF)
                  </label>
                  <textarea
                    value={formData.referral_notes}
                    onChange={e => setFormData(prev => ({ ...prev, referral_notes: e.target.value }))}
                    placeholder="Notes to include on referral documents..."
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73]/20 focus:border-[#BF9C73]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Internal Notes (staff only)
                  </label>
                  <textarea
                    value={formData.referral_internal_notes}
                    onChange={e => setFormData(prev => ({ ...prev, referral_internal_notes: e.target.value }))}
                    placeholder="Internal notes not shown on documents..."
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73]/20 focus:border-[#BF9C73]"
                  />
                </div>
              </div>

              {/* Accepted Payers */}
              <div>
                <h3 className="font-medium text-[#091747] mb-2">Accepted Insurance</h3>
                <p className="text-sm text-gray-500 mb-3">
                  Select which insurance payers this organization accepts
                </p>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
                  {payers.map(payer => (
                    <label
                      key={payer.id}
                      className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={formData.accepted_payer_ids.includes(payer.id)}
                        onChange={() => togglePayer(payer.id)}
                        className="h-4 w-4 text-[#BF9C73] rounded focus:ring-[#BF9C73]/20"
                      />
                      <span className="text-sm">{payer.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Care Types */}
              <div>
                <h3 className="font-medium text-[#091747] mb-2">Care Types Offered</h3>
                <p className="text-sm text-gray-500 mb-3">
                  Select the types of care this organization provides
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {careTypes.map(ct => (
                    <label
                      key={ct.id}
                      className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                        formData.care_type_ids.includes(ct.id)
                          ? 'bg-blue-50 border-blue-300'
                          : 'bg-white border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formData.care_type_ids.includes(ct.id)}
                        onChange={() => toggleCareType(ct.id)}
                        className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500/20"
                      />
                      <span className="text-sm">{ct.display_name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Specialties */}
              {specialtyTags && (
                <div>
                  <h3 className="font-medium text-[#091747] mb-2">Specialties</h3>
                  <p className="text-sm text-gray-500 mb-3">
                    Select any specialty capabilities
                  </p>
                  <div className="space-y-4">
                    {/* Clinical */}
                    {specialtyTags.by_category.clinical.length > 0 && (
                      <div>
                        <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Clinical</h4>
                        <div className="flex flex-wrap gap-2">
                          {specialtyTags.by_category.clinical.map(tag => (
                            <button
                              key={tag.id}
                              type="button"
                              onClick={() => toggleSpecialty(tag.id)}
                              className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                                formData.specialty_tag_ids.includes(tag.id)
                                  ? 'bg-purple-100 text-purple-700 border-purple-300'
                                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                              }`}
                            >
                              {tag.display_name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Population */}
                    {specialtyTags.by_category.population.length > 0 && (
                      <div>
                        <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Population</h4>
                        <div className="flex flex-wrap gap-2">
                          {specialtyTags.by_category.population.map(tag => (
                            <button
                              key={tag.id}
                              type="button"
                              onClick={() => toggleSpecialty(tag.id)}
                              className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                                formData.specialty_tag_ids.includes(tag.id)
                                  ? 'bg-purple-100 text-purple-700 border-purple-300'
                                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                              }`}
                            >
                              {tag.display_name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Administrative */}
                    {specialtyTags.by_category.administrative.length > 0 && (
                      <div>
                        <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Administrative</h4>
                        <div className="flex flex-wrap gap-2">
                          {specialtyTags.by_category.administrative.map(tag => (
                            <button
                              key={tag.id}
                              type="button"
                              onClick={() => toggleSpecialty(tag.id)}
                              className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                                formData.specialty_tag_ids.includes(tag.id)
                                  ? 'bg-purple-100 text-purple-700 border-purple-300'
                                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                              }`}
                            >
                              {tag.display_name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#BF9C73] text-white rounded-lg hover:bg-[#BF9C73]/90 transition-colors disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
