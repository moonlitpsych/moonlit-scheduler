/**
 * Eligibility Results Component
 *
 * Displays comprehensive eligibility check results including:
 * - Coverage status
 * - Copays and deductibles
 * - Financial summary
 * - Moonlit billability validation
 * - Warnings and alerts
 */

'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, AlertCircle, DollarSign, Calendar, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { EligibilityResult } from '@/hooks/useEligibilityChecker'

interface EligibilityResultsProps {
  result: EligibilityResult
  responseTime: number | null
  patientName: string
  payerName: string
}

export default function EligibilityResults({
  result,
  responseTime,
  patientName,
  payerName
}: EligibilityResultsProps) {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false)

  // Format currency
  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return 'N/A'
    return `$${amount.toFixed(2)}`
  }

  // Format date
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header - Patient Eligibility */}
      <div className={`p-6 ${result.isEligible ? 'bg-green-50 border-b border-green-200' : 'bg-red-50 border-b border-red-200'}`}>
        <div className="flex items-start gap-4">
          {result.isEligible ? (
            <CheckCircle className="w-8 h-8 text-green-600 flex-shrink-0" />
          ) : (
            <XCircle className="w-8 h-8 text-red-600 flex-shrink-0" />
          )}
          <div className="flex-1">
            <h3 className={`text-xl font-bold ${result.isEligible ? 'text-green-900' : 'text-red-900'}`}>
              {result.isEligible ? 'Patient is Eligible' : 'Patient is Not Eligible'}
            </h3>
            <p className={`text-sm mt-1 ${result.isEligible ? 'text-green-700' : 'text-red-700'}`}>
              {patientName} - {result.managedCareOrg || result.payerName || payerName}
            </p>
            {result.managedCareOrg && result.payerName && (
              <p className={`text-xs mt-1 ${result.isEligible ? 'text-green-600' : 'text-red-600'}`}>
                Primary Payer: {result.payerName}
              </p>
            )}
            {responseTime && (
              <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                <Clock className="w-4 h-4" />
                Response time: {responseTime}ms
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rejection Details - Only show for failed eligibility */}
      {!result.isEligible && result.rejectionReason && (
        <div className="p-6 border-b border-red-200 bg-red-50">
          <div className="flex items-start gap-3 mb-4">
            <AlertCircle className="w-6 h-6 text-red-700 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="text-lg font-semibold text-red-900 mb-2">
                Why This Failed
              </h4>
              <p className="text-base text-red-800">
                {result.rejectionReason}
              </p>
              {result.subscriberRelationship && (
                <p className="text-sm text-red-700 mt-2">
                  Patient Relationship: <span className="font-semibold capitalize">{result.subscriberRelationship}</span>
                </p>
              )}
            </div>
          </div>

          {/* Expandable Technical Details */}
          {result.technicalDetails && (
            <div className="mt-4 border-t border-red-200 pt-4">
              <button
                onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                className="flex items-center gap-2 text-sm font-medium text-red-900 hover:text-red-700"
              >
                {showTechnicalDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {showTechnicalDetails ? 'Hide' : 'Show'} Technical Details
              </button>

              {showTechnicalDetails && (
                <div className="mt-3 space-y-3 font-mono text-xs">
                  {result.technicalDetails.aaaSegments && result.technicalDetails.aaaSegments.length > 0 && (
                    <div>
                      <p className="font-semibold text-red-900 mb-1">AAA Segments (Rejection Codes):</p>
                      {result.technicalDetails.aaaSegments.map((seg, i) => (
                        <p key={i} className="text-red-800 bg-red-100 p-2 rounded">{seg}</p>
                      ))}
                    </div>
                  )}
                  {result.technicalDetails.insSegments && result.technicalDetails.insSegments.length > 0 && (
                    <div>
                      <p className="font-semibold text-red-900 mb-1">INS Segments (Subscriber Relationship):</p>
                      {result.technicalDetails.insSegments.map((seg, i) => (
                        <p key={i} className="text-red-800 bg-red-100 p-2 rounded">{seg}</p>
                      ))}
                    </div>
                  )}
                  {result.technicalDetails.msgSegments && result.technicalDetails.msgSegments.length > 0 && (
                    <div>
                      <p className="font-semibold text-red-900 mb-1">MSG Segments (Payer Messages):</p>
                      {result.technicalDetails.msgSegments.map((seg, i) => (
                        <p key={i} className="text-red-800 bg-red-100 p-2 rounded">{seg}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Coverage Details */}
      <div className="p-6 space-y-6">
        {/* Status */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-gray-600 mb-1">Coverage Status</p>
            <p className="text-lg font-semibold text-gray-900">{result.coverageStatus || 'Unknown'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600 mb-1">Plan Type</p>
            <p className="text-lg font-semibold text-gray-900">{result.planType || 'N/A'}</p>
          </div>
        </div>

        {/* Coverage Dates */}
        {(result.effectiveDate || result.terminationDate) && (
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Effective Date
              </p>
              <p className="text-base text-gray-900">{formatDate(result.effectiveDate)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Termination Date
              </p>
              <p className="text-base text-gray-900">{formatDate(result.terminationDate)}</p>
            </div>
          </div>
        )}

        {/* Financial Information */}
        {result.copayInfo && (
          <div className="pt-4 border-t border-gray-200">
            <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Copays & Financial Information
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {result.copayInfo.primaryCareCopay && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-xs font-medium text-gray-600 mb-1">Primary Care Copay</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(result.copayInfo.primaryCareCopay)}
                  </p>
                </div>
              )}
              {result.copayInfo.specialistCopay && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-xs font-medium text-gray-600 mb-1">Specialist Copay</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(result.copayInfo.specialistCopay)}
                  </p>
                </div>
              )}
              {result.copayInfo.urgentCareCopay && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-xs font-medium text-gray-600 mb-1">Urgent Care Copay</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(result.copayInfo.urgentCareCopay)}
                  </p>
                </div>
              )}
              {result.copayInfo.mentalHealthOutpatient && (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <p className="text-xs font-medium text-blue-700 mb-1">Mental Health (Outpatient)</p>
                  <p className="text-2xl font-bold text-blue-900">
                    {formatCurrency(result.copayInfo.mentalHealthOutpatient)}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Deductible Information */}
        {result.deductibleInfo && (
          <div className="pt-4 border-t border-gray-200">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Deductible Information</h4>
            <div className="grid grid-cols-3 gap-4">
              {result.deductibleInfo.deductibleTotal && (
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-1">Total Deductible</p>
                  <p className="text-xl font-bold text-gray-900">
                    {formatCurrency(result.deductibleInfo.deductibleTotal)}
                  </p>
                </div>
              )}
              {result.deductibleInfo.deductibleMet && (
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-1">Already Met</p>
                  <p className="text-xl font-bold text-green-600">
                    {formatCurrency(result.deductibleInfo.deductibleMet)}
                  </p>
                </div>
              )}
              {result.deductibleInfo.deductibleRemaining && (
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-1">Remaining</p>
                  <p className="text-xl font-bold text-orange-600">
                    {formatCurrency(result.deductibleInfo.deductibleRemaining)}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Warnings & Alerts */}
        {result.warnings && result.warnings.length > 0 && (
          <div className="pt-4 border-t border-gray-200">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-yellow-900 mb-2">Important Notices</p>
                  <ul className="space-y-1">
                    {result.warnings.map((warning, index) => (
                      <li key={index} className="text-sm text-yellow-800">
                        • {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Financial Summary (if available) */}
        {result.financialSummary && (
          <div className="pt-4 border-t border-gray-200">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Estimated Patient Cost</h4>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <div className="text-center">
                <p className="text-sm text-blue-700 mb-2">Estimated Cost for Initial Visit</p>
                <p className="text-4xl font-bold text-blue-900">
                  {formatCurrency(result.financialSummary.patientOwes)}
                </p>
                <p className="text-xs text-blue-600 mt-2">{result.financialSummary.explanation}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
