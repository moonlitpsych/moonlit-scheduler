'use client'

import { useState, useEffect } from 'react'
import { FileText, Plus, X, Save, AlertCircle, Check, Info } from 'lucide-react'

export interface PracticeQMapping {
  insurance_company_name: string
  payer_code: string
  aliases: string[]
}

interface PracticeQMappingFormProps {
  payerId: string
  payerName: string
  existingMapping?: PracticeQMapping | null
  onMappingChange: (mapping: PracticeQMapping | null) => void
  optional?: boolean
}

export default function PracticeQMappingForm({
  payerId,
  payerName,
  existingMapping,
  onMappingChange,
  optional = true
}: PracticeQMappingFormProps) {
  const [enabled, setEnabled] = useState(!!existingMapping)
  const [mapping, setMapping] = useState<PracticeQMapping>({
    insurance_company_name: existingMapping?.insurance_company_name || payerName,
    payer_code: existingMapping?.payer_code || '',
    aliases: existingMapping?.aliases || []
  })
  const [newAlias, setNewAlias] = useState('')
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  // Update parent when mapping changes
  useEffect(() => {
    if (enabled) {
      onMappingChange(mapping)
    } else {
      onMappingChange(null)
    }
  }, [enabled, mapping])

  // Common PracticeQ payer codes for reference
  const commonPayerCodes = [
    { code: 'BCBS', name: 'Blue Cross Blue Shield' },
    { code: 'UHC', name: 'United Healthcare' },
    { code: 'AETNA', name: 'Aetna' },
    { code: 'CIGNA', name: 'Cigna' },
    { code: 'HUMANA', name: 'Humana' },
    { code: 'MEDICARE', name: 'Medicare' },
    { code: 'MEDICAID', name: 'Medicaid' },
    { code: 'CASH', name: 'Self-Pay/Cash' }
  ]

  const handleToggle = () => {
    setEnabled(!enabled)
    if (!enabled) {
      // When enabling, set default values
      setMapping({
        insurance_company_name: payerName,
        payer_code: '',
        aliases: []
      })
    }
  }

  const handleFieldChange = (field: keyof PracticeQMapping, value: string | string[]) => {
    setMapping(prev => ({ ...prev, [field]: value }))
    setValidationErrors([]) // Clear errors on change
  }

  const addAlias = () => {
    if (newAlias.trim() && !mapping.aliases.includes(newAlias.trim())) {
      handleFieldChange('aliases', [...mapping.aliases, newAlias.trim()])
      setNewAlias('')
    }
  }

  const removeAlias = (index: number) => {
    handleFieldChange('aliases', mapping.aliases.filter((_, i) => i !== index))
  }

  const validateMapping = (): boolean => {
    const errors: string[] = []

    if (enabled) {
      if (!mapping.insurance_company_name.trim()) {
        errors.push('PracticeQ insurance company name is required')
      }
      if (!mapping.payer_code.trim()) {
        errors.push('PracticeQ payer code is required')
      }
    }

    setValidationErrors(errors)
    return errors.length === 0
  }

  const getSuggestedCode = () => {
    // Suggest a payer code based on the payer name
    const upperName = payerName.toUpperCase()
    for (const common of commonPayerCodes) {
      if (upperName.includes(common.name.toUpperCase())) {
        return common.code
      }
    }
    // Generate a code from the first letters of each word
    const words = payerName.split(/\s+/)
    if (words.length > 1) {
      return words.map(w => w[0]).join('').toUpperCase()
    }
    return payerName.substring(0, 4).toUpperCase()
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <FileText className="h-5 w-5 text-[#BF9C73]" />
            <div>
              <h3 className="font-semibold text-[#091747]">
                PracticeQ Integration {optional && '(Optional)'}
              </h3>
              <p className="text-sm text-gray-600">
                Configure how this payer appears in PracticeQ EMR system
              </p>
            </div>
          </div>
          {optional && (
            <button
              onClick={handleToggle}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                enabled
                  ? 'bg-green-100 text-green-800 hover:bg-green-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {enabled ? 'Configured' : 'Skip for Now'}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {enabled && (
        <div className="p-4 space-y-4">
          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Info className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p>These mappings ensure appointments sync correctly to PracticeQ.</p>
                <p className="mt-1">The payer code must match exactly with PracticeQ's system.</p>
              </div>
            </div>
          </div>

          {/* Insurance Company Name */}
          <div>
            <label className="block text-sm font-medium text-[#091747] mb-2">
              PracticeQ Insurance Company Name *
            </label>
            <input
              type="text"
              value={mapping.insurance_company_name}
              onChange={(e) => handleFieldChange('insurance_company_name', e.target.value)}
              placeholder="e.g., Blue Cross Blue Shield of Utah"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20 focus:border-[#BF9C73]"
            />
            <p className="text-xs text-gray-500 mt-1">
              This must match exactly how the payer appears in PracticeQ
            </p>
          </div>

          {/* Payer Code */}
          <div>
            <label className="block text-sm font-medium text-[#091747] mb-2">
              PracticeQ Payer Code *
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={mapping.payer_code}
                onChange={(e) => handleFieldChange('payer_code', e.target.value.toUpperCase())}
                placeholder="e.g., BCBS_UT"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20 focus:border-[#BF9C73]"
              />
              <button
                onClick={() => handleFieldChange('payer_code', getSuggestedCode())}
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm"
              >
                Suggest Code
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Internal code used to identify this payer in API calls
            </p>
          </div>

          {/* Common Codes Reference */}
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm font-medium text-gray-700 mb-2">Common Payer Codes:</p>
            <div className="flex flex-wrap gap-2">
              {commonPayerCodes.map(({ code, name }) => (
                <button
                  key={code}
                  onClick={() => handleFieldChange('payer_code', code)}
                  className="px-2 py-1 bg-white border border-gray-300 rounded text-xs hover:bg-gray-100 transition-colors"
                  title={name}
                >
                  {code}
                </button>
              ))}
            </div>
          </div>

          {/* Aliases */}
          <div>
            <label className="block text-sm font-medium text-[#091747] mb-2">
              Alternative Names / Aliases
            </label>
            <div className="space-y-2">
              {mapping.aliases.map((alias, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={alias}
                    readOnly
                    className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg"
                  />
                  <button
                    onClick={() => removeAlias(index)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={newAlias}
                  onChange={(e) => setNewAlias(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addAlias())}
                  placeholder="Add alternative name..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20 focus:border-[#BF9C73]"
                />
                <button
                  onClick={addAlias}
                  disabled={!newAlias.trim()}
                  className="p-2 bg-[#BF9C73] text-white rounded-lg hover:bg-[#BF9C73]/90 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <p className="text-xs text-gray-500">
                Add any alternative names patients might use when searching for this insurance
              </p>
            </div>
          </div>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                <div>
                  <p className="font-medium text-red-800">Please fix the following issues:</p>
                  <ul className="mt-1 space-y-1">
                    {validationErrors.map((error, index) => (
                      <li key={index} className="text-sm text-red-700">• {error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Status Summary */}
          {mapping.insurance_company_name && mapping.payer_code && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <Check className="h-5 w-5 text-green-600 mt-0.5" />
                <div className="text-sm text-green-800">
                  <p className="font-medium">PracticeQ mapping configured:</p>
                  <ul className="mt-1 space-y-0.5">
                    <li>• Name: {mapping.insurance_company_name}</li>
                    <li>• Code: {mapping.payer_code}</li>
                    {mapping.aliases.length > 0 && (
                      <li>• {mapping.aliases.length} alias(es) configured</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Skip Notice */}
      {!enabled && optional && (
        <div className="p-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium">PracticeQ integration not configured</p>
                <p className="mt-1">
                  You can configure this later from the payer settings page.
                  Appointments will still be created in the database.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}