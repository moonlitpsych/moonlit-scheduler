'use client'

import { useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Users,
  Calendar,
  FileText,
  Shield,
  X
} from 'lucide-react'
import { SanityCheckResults, ValidationResult } from '@/lib/services/payerSanityCheckService'

interface ContractValidationSummaryProps {
  results: SanityCheckResults | null
  loading: boolean
  onProceed?: () => void
  onCancel?: () => void
  allowProceedWithWarnings?: boolean
}

export default function ContractValidationSummary({
  results,
  loading,
  onProceed,
  onCancel,
  allowProceedWithWarnings = true
}: ContractValidationSummaryProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['errors', 'warnings']))

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(section)) {
      newExpanded.delete(section)
    } else {
      newExpanded.add(section)
    }
    setExpandedSections(newExpanded)
  }

  const getValidationIcon = (level: ValidationResult['level']) => {
    switch (level) {
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-600" />
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />
      case 'info':
        return <Info className="h-5 w-5 text-blue-600" />
      default:
        return <CheckCircle className="h-5 w-5 text-green-600" />
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Bookability':
        return <Users className="h-4 w-4" />
      case 'Supervision':
        return <Shield className="h-4 w-4" />
      case 'Effective Dates':
        return <Calendar className="h-4 w-4" />
      case 'Payer Configuration':
      case 'Provider Flags':
        return <FileText className="h-4 w-4" />
      default:
        return <Info className="h-4 w-4" />
    }
  }

  const groupValidationsByLevel = () => {
    if (!results) return { errors: [], warnings: [], info: [] }

    const errors = results.validations.filter(v => v.level === 'error')
    const warnings = results.validations.filter(v => v.level === 'warning')
    const info = results.validations.filter(v => v.level === 'info')

    return { errors, warnings, info }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex flex-col items-center justify-center py-8">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#BF9C73] mb-4"></div>
          <p className="text-gray-600">Running validation checks...</p>
          <p className="text-sm text-gray-500 mt-2">This may take a few moments</p>
        </div>
      </div>
    )
  }

  if (!results) {
    return null
  }

  const { errors, warnings, info } = groupValidationsByLevel()
  const canProceed = errors.length === 0 && (allowProceedWithWarnings || warnings.length === 0)

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[#091747]">Contract Validation Summary</h3>
          <div className="flex items-center space-x-4 text-sm">
            {errors.length > 0 && (
              <span className="flex items-center space-x-1 text-red-600">
                <AlertCircle className="h-4 w-4" />
                <span>{errors.length} Error{errors.length !== 1 ? 's' : ''}</span>
              </span>
            )}
            {warnings.length > 0 && (
              <span className="flex items-center space-x-1 text-yellow-600">
                <AlertTriangle className="h-4 w-4" />
                <span>{warnings.length} Warning{warnings.length !== 1 ? 's' : ''}</span>
              </span>
            )}
            {info.length > 0 && (
              <span className="flex items-center space-x-1 text-blue-600">
                <Info className="h-4 w-4" />
                <span>{info.length} Info</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Overall Status */}
      <div className={`p-4 border-b ${
        results.hasErrors ? 'bg-red-50 border-red-200' :
        results.hasWarnings ? 'bg-yellow-50 border-yellow-200' :
        'bg-green-50 border-green-200'
      }`}>
        <div className="flex items-start space-x-3">
          {results.hasErrors ? (
            <>
              <AlertCircle className="h-6 w-6 text-red-600 mt-0.5" />
              <div>
                <p className="font-medium text-red-800">Validation Failed</p>
                <p className="text-sm text-red-700 mt-1">
                  Critical issues must be resolved before proceeding with the contract setup.
                </p>
              </div>
            </>
          ) : results.hasWarnings ? (
            <>
              <AlertTriangle className="h-6 w-6 text-yellow-600 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-800">Validation Completed with Warnings</p>
                <p className="text-sm text-yellow-700 mt-1">
                  Review the warnings below. You can proceed, but some providers may not be bookable as expected.
                </p>
              </div>
            </>
          ) : (
            <>
              <CheckCircle className="h-6 w-6 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium text-green-800">All Checks Passed</p>
                <p className="text-sm text-green-700 mt-1">
                  Contract configuration looks good. Ready to apply changes.
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-[#091747]">
              {results.bookableProviders.length}
            </div>
            <div className="text-sm text-gray-600">Bookable Providers</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-[#091747]">
              {results.supervisorIssues.length}
            </div>
            <div className="text-sm text-gray-600">Supervisor Issues</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-[#091747]">
              {results.residentIssues.length}
            </div>
            <div className="text-sm text-gray-600">Resident Issues</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-[#091747]">
              {results.blockedProviders.length}
            </div>
            <div className="text-sm text-gray-600">Blocked Providers</div>
          </div>
        </div>
      </div>

      {/* Validation Details */}
      <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
        {/* Errors Section */}
        {errors.length > 0 && (
          <div className="border border-red-200 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection('errors')}
              className="w-full px-4 py-3 bg-red-50 hover:bg-red-100 transition-colors flex items-center justify-between"
            >
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <span className="font-medium text-red-800">Errors ({errors.length})</span>
              </div>
              {expandedSections.has('errors') ? (
                <ChevronUp className="h-5 w-5 text-red-600" />
              ) : (
                <ChevronDown className="h-5 w-5 text-red-600" />
              )}
            </button>
            {expandedSections.has('errors') && (
              <div className="p-4 bg-white space-y-3">
                {errors.map((validation, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <div className="flex items-center space-x-2 mt-0.5">
                      {getCategoryIcon(validation.category)}
                      {getValidationIcon(validation.level)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">{validation.category}</p>
                      <p className="text-sm text-gray-700">{validation.message}</p>
                      {validation.details && (
                        <details className="mt-2">
                          <summary className="text-xs text-gray-500 cursor-pointer">Show details</summary>
                          <pre className="mt-2 p-2 bg-gray-50 rounded text-xs overflow-x-auto">
                            {JSON.stringify(validation.details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Warnings Section */}
        {warnings.length > 0 && (
          <div className="border border-yellow-200 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection('warnings')}
              className="w-full px-4 py-3 bg-yellow-50 hover:bg-yellow-100 transition-colors flex items-center justify-between"
            >
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <span className="font-medium text-yellow-800">Warnings ({warnings.length})</span>
              </div>
              {expandedSections.has('warnings') ? (
                <ChevronUp className="h-5 w-5 text-yellow-600" />
              ) : (
                <ChevronDown className="h-5 w-5 text-yellow-600" />
              )}
            </button>
            {expandedSections.has('warnings') && (
              <div className="p-4 bg-white space-y-3">
                {warnings.map((validation, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <div className="flex items-center space-x-2 mt-0.5">
                      {getCategoryIcon(validation.category)}
                      {getValidationIcon(validation.level)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">{validation.category}</p>
                      <p className="text-sm text-gray-700">{validation.message}</p>
                      {validation.details && (
                        <details className="mt-2">
                          <summary className="text-xs text-gray-500 cursor-pointer">Show details</summary>
                          <pre className="mt-2 p-2 bg-gray-50 rounded text-xs overflow-x-auto">
                            {JSON.stringify(validation.details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Info Section */}
        {info.length > 0 && (
          <div className="border border-blue-200 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection('info')}
              className="w-full px-4 py-3 bg-blue-50 hover:bg-blue-100 transition-colors flex items-center justify-between"
            >
              <div className="flex items-center space-x-2">
                <Info className="h-5 w-5 text-blue-600" />
                <span className="font-medium text-blue-800">Information ({info.length})</span>
              </div>
              {expandedSections.has('info') ? (
                <ChevronUp className="h-5 w-5 text-blue-600" />
              ) : (
                <ChevronDown className="h-5 w-5 text-blue-600" />
              )}
            </button>
            {expandedSections.has('info') && (
              <div className="p-4 bg-white space-y-3">
                {info.map((validation, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <div className="flex items-center space-x-2 mt-0.5">
                      {getCategoryIcon(validation.category)}
                      {getValidationIcon(validation.level)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">{validation.category}</p>
                      <p className="text-sm text-gray-700">{validation.message}</p>
                      {validation.details && (
                        <details className="mt-2">
                          <summary className="text-xs text-gray-500 cursor-pointer">Show details</summary>
                          <pre className="mt-2 p-2 bg-gray-50 rounded text-xs overflow-x-auto">
                            {JSON.stringify(validation.details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      {(onProceed || onCancel) && (
        <div className="p-4 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {!canProceed && <span className="text-red-600">Fix errors before proceeding</span>}
              {canProceed && warnings.length > 0 && (
                <span className="text-yellow-600">Proceeding with warnings</span>
              )}
            </div>
            <div className="flex items-center space-x-3">
              {onCancel && (
                <button
                  onClick={onCancel}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
              )}
              {onProceed && (
                <button
                  onClick={onProceed}
                  disabled={!canProceed}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    canProceed
                      ? warnings.length > 0
                        ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {warnings.length > 0 ? 'Proceed with Warnings' : 'Apply Changes'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}