'use client'

import { useState, useEffect } from 'react'
import { Search, ChevronDown } from 'lucide-react'
import type {
  ReferralCareType,
  ReferralSpecialtyTag,
  ReferralSearchCriteria,
  SpecialtyTagsResponse
} from '@/types/referral-network'

interface Payer {
  id: string
  name: string
  payer_type?: string
  status_code?: string
}

interface ReferralGeneratorFormProps {
  onSearch: (criteria: ReferralSearchCriteria) => void
  isLoading: boolean
}

export default function ReferralGeneratorForm({ onSearch, isLoading }: ReferralGeneratorFormProps) {
  // Data state
  const [payers, setPayers] = useState<Payer[]>([])
  const [careTypes, setCareTypes] = useState<ReferralCareType[]>([])
  const [specialtyTags, setSpecialtyTags] = useState<SpecialtyTagsResponse | null>(null)

  // Form state
  const [selectedPayerId, setSelectedPayerId] = useState<string>('')
  const [selectedCareTypeIds, setSelectedCareTypeIds] = useState<string[]>([])
  const [selectedSpecialtyIds, setSelectedSpecialtyIds] = useState<string[]>([])

  // Loading state
  const [loadingData, setLoadingData] = useState(true)

  // Fetch reference data on mount
  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch payers
        const payersRes = await fetch('/api/admin/payers')
        if (payersRes.ok) {
          const payersData = await payersRes.json()
          // API returns { success, data: [...] } - show all payers for referral lookup
          const payersList = payersData.data || payersData.payers || []
          // Sort alphabetically and include all payers (referral orgs may accept payers we don't)
          setPayers(payersList.sort((a: Payer, b: Payer) => a.name.localeCompare(b.name)))
        }

        // Fetch care types
        const careTypesRes = await fetch('/api/admin/referral-network/care-types')
        if (careTypesRes.ok) {
          const careTypesData = await careTypesRes.json()
          setCareTypes(careTypesData.care_types || [])
        }

        // Fetch specialty tags
        const tagsRes = await fetch('/api/admin/referral-network/specialty-tags')
        if (tagsRes.ok) {
          const tagsData = await tagsRes.json()
          setSpecialtyTags(tagsData)
        }
      } catch (error) {
        console.error('Error fetching form data:', error)
      } finally {
        setLoadingData(false)
      }
    }

    fetchData()
  }, [])

  // Handle care type toggle
  const toggleCareType = (id: string) => {
    setSelectedCareTypeIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  // Handle specialty toggle
  const toggleSpecialty = (id: string) => {
    setSelectedSpecialtyIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  // Handle search submit
  const handleSearch = () => {
    if (!selectedPayerId || selectedCareTypeIds.length === 0) {
      return
    }

    onSearch({
      payer_id: selectedPayerId,
      care_type_ids: selectedCareTypeIds,
      specialty_tag_ids: selectedSpecialtyIds.length > 0 ? selectedSpecialtyIds : undefined
    })
  }

  // Check if form is valid
  const isFormValid = selectedPayerId && selectedCareTypeIds.length > 0

  if (loadingData) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-10 bg-gray-200 rounded w-full mb-6"></div>
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-10 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-[#091747] mb-6 font-['Newsreader']">
        Find Referral Resources
      </h2>

      {/* Step 1: Select Payer */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-[#091747] mb-2">
          1. Select Patient&apos;s Insurance
          <span className="text-red-500 ml-1">*</span>
        </label>
        <div className="relative">
          <select
            value={selectedPayerId}
            onChange={e => setSelectedPayerId(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg appearance-none bg-white focus:ring-2 focus:ring-[#BF9C73]/20 focus:border-[#BF9C73] transition-colors"
          >
            <option value="">Select a payer...</option>
            {payers.map(payer => (
              <option key={payer.id} value={payer.id}>
                {payer.name}
                {payer.payer_type && ` (${payer.payer_type})`}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Step 2: Select Care Types */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-[#091747] mb-2">
          2. Select Care Type(s) Needed
          <span className="text-red-500 ml-1">*</span>
        </label>
        <p className="text-xs text-gray-500 mb-3">Select all that apply</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {careTypes.map(careType => (
            <label
              key={careType.id}
              className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                selectedCareTypeIds.includes(careType.id)
                  ? 'bg-[#BF9C73]/10 border-[#BF9C73] text-[#091747]'
                  : 'bg-white border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="checkbox"
                checked={selectedCareTypeIds.includes(careType.id)}
                onChange={() => toggleCareType(careType.id)}
                className="h-4 w-4 text-[#BF9C73] rounded focus:ring-[#BF9C73]/20 mr-3"
              />
              <div>
                <span className="text-sm font-medium">{careType.display_name}</span>
                {careType.description && (
                  <p className="text-xs text-gray-500 mt-0.5">{careType.description}</p>
                )}
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Step 3: Optional Specialty Filters */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-[#091747] mb-2">
          3. Filter by Specialty (Optional)
        </label>
        <p className="text-xs text-gray-500 mb-3">
          Narrow results to organizations with specific expertise
        </p>

        {specialtyTags && (
          <div className="space-y-4">
            {/* Clinical */}
            {specialtyTags.by_category.clinical.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Clinical Specialties
                </h4>
                <div className="flex flex-wrap gap-2">
                  {specialtyTags.by_category.clinical.map(tag => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleSpecialty(tag.id)}
                      className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                        selectedSpecialtyIds.includes(tag.id)
                          ? 'bg-[#091747] text-white border-[#091747]'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
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
                <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Population Focus
                </h4>
                <div className="flex flex-wrap gap-2">
                  {specialtyTags.by_category.population.map(tag => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleSpecialty(tag.id)}
                      className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                        selectedSpecialtyIds.includes(tag.id)
                          ? 'bg-[#091747] text-white border-[#091747]'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
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
                <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Administrative
                </h4>
                <div className="flex flex-wrap gap-2">
                  {specialtyTags.by_category.administrative.map(tag => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleSpecialty(tag.id)}
                      className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                        selectedSpecialtyIds.includes(tag.id)
                          ? 'bg-[#091747] text-white border-[#091747]'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {tag.display_name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Search Button */}
      <button
        onClick={handleSearch}
        disabled={!isFormValid || isLoading}
        className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
          isFormValid && !isLoading
            ? 'bg-[#BF9C73] text-white hover:bg-[#BF9C73]/90'
            : 'bg-gray-200 text-gray-500 cursor-not-allowed'
        }`}
      >
        {isLoading ? (
          <>
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Searching...
          </>
        ) : (
          <>
            <Search className="h-5 w-5" />
            Find Resources
          </>
        )}
      </button>

      {/* Validation Message */}
      {!isFormValid && (
        <p className="text-xs text-gray-500 mt-2 text-center">
          Please select an insurance and at least one care type
        </p>
      )}
    </div>
  )
}
