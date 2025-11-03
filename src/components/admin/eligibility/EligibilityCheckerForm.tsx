/**
 * Eligibility Checker Form Component
 *
 * Main form for performing insurance eligibility checks
 * Includes patient search, payer selection, and results display
 */

'use client'

import { useState, useEffect } from 'react'
import { Search, Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import useSWR from 'swr'
import { useEligibilityChecker } from '@/hooks/useEligibilityChecker'
import { usePatientSearch } from '@/hooks/usePatientSearch'
import PatientSearchInput from './PatientSearchInput'
import EligibilityResults from './EligibilityResults'

const fetcher = (url: string) => fetch(url).then(res => res.json())

interface PayerOption {
  payer_id: string
  payer_name: string
  office_ally_payer_id: string
  payer_display_name: string
  category: string
  required_fields: string[]
  recommended_fields: string[]
  is_tested: boolean
}

export default function EligibilityCheckerForm() {
  // State
  const [selectedPatient, setSelectedPatient] = useState<any>(null)
  const [selectedPayer, setSelectedPayer] = useState<string>('')
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: '' as 'M' | 'F' | 'U' | 'X' | '',
    memberNumber: '',
    medicaidId: '',
    groupNumber: '',
    ssn: ''
  })

  // Hooks
  const { checkEligibility, isLoading, error, result, responseTime, clearResult } = useEligibilityChecker()

  // Fetch payers
  const { data: payersData } = useSWR('/api/admin/eligibility/payers', fetcher)
  const payers: PayerOption[] = payersData?.data?.payers || []
  const groupedPayers = payersData?.data?.grouped || {}

  // Get selected payer config
  const selectedPayerConfig = payers.find(p => p.office_ally_payer_id === selectedPayer)

  // Handle patient selection from search
  const handlePatientSelect = (patient: any) => {
    setSelectedPatient(patient)
    setFormData({
      ...formData,
      firstName: patient.first_name || '',
      lastName: patient.last_name || '',
      dateOfBirth: patient.date_of_birth || '',
      gender: patient.gender || ''
    })
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedPayer) {
      alert('Please select a payer')
      return
    }

    await checkEligibility({
      ...formData,
      officeAllyPayerId: selectedPayer
    })
  }

  // Check if a field is required, recommended, or optional
  const getFieldRequirement = (fieldName: string): 'required' | 'recommended' | 'optional' => {
    if (!selectedPayerConfig) return 'optional'
    if (selectedPayerConfig.required_fields.includes(fieldName)) return 'required'
    if (selectedPayerConfig.recommended_fields.includes(fieldName)) return 'recommended'
    return 'optional'
  }

  return (
    <div className="space-y-6">
      {/* Patient Search */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">1. Search Patient (Optional)</h2>
        <PatientSearchInput onPatientSelect={handlePatientSelect} />
        {selectedPatient && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-900">
              <strong>Selected Patient:</strong> {selectedPatient.first_name} {selectedPatient.last_name}
              {selectedPatient.date_of_birth && ` (DOB: ${selectedPatient.date_of_birth})`}
            </p>
          </div>
        )}
      </div>

      {/* Eligibility Check Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">2. Patient & Insurance Information</h2>

        <div className="space-y-4">
          {/* Payer Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Insurance Payer <span className="text-red-600">*</span>
            </label>
            <select
              value={selectedPayer}
              onChange={(e) => setSelectedPayer(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="">Select a payer...</option>
              {Object.entries(groupedPayers).map(([category, categoryPayers]: [string, any]) => (
                <optgroup key={category} label={category}>
                  {categoryPayers.map((payer: PayerOption) => (
                    <option key={payer.office_ally_payer_id} value={payer.office_ally_payer_id}>
                      {payer.payer_display_name}
                      {payer.is_tested ? ' ✓' : ' (untested)'}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Patient Name */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
          </div>

          {/* Date of Birth */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date of Birth <span className="text-red-600">*</span>
            </label>
            <input
              type="date"
              value={formData.dateOfBirth}
              onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          {/* Gender - conditional based on payer */}
          {getFieldRequirement('gender') !== 'optional' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gender
                {getFieldRequirement('gender') === 'required' && <span className="text-red-600"> *</span>}
                {getFieldRequirement('gender') === 'recommended' && <span className="text-yellow-600"> (recommended)</span>}
              </label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required={getFieldRequirement('gender') === 'required'}
              >
                <option value="">Select...</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="U">Unknown</option>
                <option value="X">Other</option>
              </select>
            </div>
          )}

          {/* Member ID / Medicaid ID */}
          <div className="grid grid-cols-2 gap-4">
            {getFieldRequirement('memberNumber') !== 'optional' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Member Number
                  {getFieldRequirement('memberNumber') === 'required' && <span className="text-red-600"> *</span>}
                  {getFieldRequirement('memberNumber') === 'recommended' && <span className="text-yellow-600"> (recommended)</span>}
                </label>
                <input
                  type="text"
                  value={formData.memberNumber}
                  onChange={(e) => setFormData({ ...formData, memberNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required={getFieldRequirement('memberNumber') === 'required'}
                />
              </div>
            )}

            {getFieldRequirement('medicaidId') !== 'optional' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Medicaid ID
                  {getFieldRequirement('medicaidId') === 'required' && <span className="text-red-600"> *</span>}
                  {getFieldRequirement('medicaidId') === 'recommended' && <span className="text-yellow-600"> (recommended)</span>}
                </label>
                <input
                  type="text"
                  value={formData.medicaidId}
                  onChange={(e) => setFormData({ ...formData, medicaidId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required={getFieldRequirement('medicaidId') === 'required'}
                />
              </div>
            )}
          </div>

          {/* Group Number */}
          {getFieldRequirement('groupNumber') !== 'optional' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Group Number
                {getFieldRequirement('groupNumber') === 'recommended' && <span className="text-yellow-600"> (recommended)</span>}
              </label>
              <input
                type="text"
                value={formData.groupNumber}
                onChange={(e) => setFormData({ ...formData, groupNumber: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          )}

          {/* Submit Button */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Checking Eligibility...
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  Check Eligibility
                </>
              )}
            </button>

            {result && (
              <button
                type="button"
                onClick={() => {
                  clearResult()
                  setFormData({
                    firstName: '',
                    lastName: '',
                    dateOfBirth: '',
                    gender: '',
                    memberNumber: '',
                    medicaidId: '',
                    groupNumber: '',
                    ssn: ''
                  })
                  setSelectedPatient(null)
                  setSelectedPayer('')
                }}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              >
                Clear & Start Over
              </button>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-900">Eligibility Check Failed</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          )}
        </div>
      </form>

      {/* Results */}
      {result && (
        <EligibilityResults
          result={result}
          responseTime={responseTime}
          patientName={`${formData.firstName} ${formData.lastName}`}
          payerName={selectedPayerConfig?.payer_display_name || 'Unknown'}
        />
      )}
    </div>
  )
}
