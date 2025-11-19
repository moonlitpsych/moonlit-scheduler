'use client'

import { useState } from 'react'
import type { PayerPlanDisplayData } from '@/types/payer-plans'
import PlanTypeBadge from '@/components/ui/PlanTypeBadge'
import InfoTooltip from '@/components/ui/InfoTooltip'

interface PayerPlansInlineDisplayProps {
  data: PayerPlanDisplayData
  payerName: string
}

/**
 * Collapsible inline plan display for payer cards
 *
 * Behavior based on user preferences:
 * - If >3 total plans: Show collapsed with counts ("Accepted (N) · Not accepted (M)"), toggle to expand
 * - If ≤3 plans: Show inline list immediately, no toggle
 * - Never show "Needs review" in collapsed state (only in expanded view)
 * - Same behavior in search results (always collapsed if >3 plans)
 *
 * Expanded view shows three sections:
 * 1. In-network plans (accepted)
 * 2. Out-of-network plans (not accepted)
 * 3. Needs review (rare - unknown status)
 */
export default function PayerPlansInlineDisplay({
  data,
  payerName
}: PayerPlansInlineDisplayProps) {
  const { accepted, notAccepted, needsReview } = data
  const [isExpanded, setIsExpanded] = useState(false)

  // Don't render if no plans to show
  const totalPlans = accepted.length + notAccepted.length + needsReview.length
  if (totalPlans === 0) {
    return null
  }

  // Extract brand name from payer name (e.g., "SelectHealth" from "SelectHealth Integrated")
  const brandName = payerName.split(' ')[0]

  // Threshold: >3 plans = collapsible, ≤3 = always shown
  const shouldCollapse = totalPlans > 3

  // If ≤3 plans, show inline immediately (no toggle)
  if (!shouldCollapse) {
    return (
      <div className="mt-3 pt-3 border-t border-stone-200 space-y-3 text-sm" style={{ fontFamily: 'Newsreader, serif' }}>
        {renderPlanSections(accepted, notAccepted, needsReview, brandName)}
      </div>
    )
  }

  // >3 plans: Show collapsed state with toggle
  return (
    <div className="mt-3 pt-3 border-t border-stone-200 space-y-2 text-sm" style={{ fontFamily: 'Newsreader, serif' }}>
      {/* Collapsed state: Show counts + toggle button */}
      {!isExpanded && (
        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-600">
            <span className="font-medium">Accepted ({accepted.length})</span>
            {notAccepted.length > 0 && (
              <>
                <span className="mx-1">·</span>
                <span className="font-medium">Not accepted ({notAccepted.length})</span>
              </>
            )}
          </div>
          <button
            onClick={() => setIsExpanded(true)}
            className="text-xs text-[#BF9C73] hover:text-[#A8865F] font-medium flex items-center gap-1 transition-colors"
            aria-expanded="false"
            aria-label="View plan details"
          >
            View plan details
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      )}

      {/* Expanded state: Show full plan lists + hide button */}
      {isExpanded && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-slate-600">Plan details</div>
            <button
              onClick={() => setIsExpanded(false)}
              className="text-xs text-[#BF9C73] hover:text-[#A8865F] font-medium flex items-center gap-1 transition-colors"
              aria-expanded="true"
              aria-label="Hide plan details"
            >
              Hide plan details
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>
          </div>
          {renderPlanSections(accepted, notAccepted, needsReview, brandName)}
        </div>
      )}
    </div>
  )
}

/**
 * Renders the three plan sections (accepted, not accepted, needs review)
 * Used by both inline (≤3 plans) and expanded (>3 plans) views
 */
function renderPlanSections(
  accepted: any[],
  notAccepted: any[],
  needsReview: any[],
  brandName: string
) {
  return (
    <>
      {/* Section 1: Accepted plans (in-network) */}
      {accepted.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <p className="text-xs font-semibold text-slate-700">In-network at Moonlit</p>
          </div>
          <ul className="space-y-1 ml-6">
            {accepted.map((plan) => (
              <li
                key={plan.plan_id}
                className="flex items-center gap-2 text-slate-700"
              >
                <span className="text-slate-400">•</span>
                <span className="flex items-center gap-1.5">
                  {plan.plan_name}
                  {plan.plan_type && <PlanTypeBadge planType={plan.plan_type} />}
                  {plan.notes && <InfoTooltip content={plan.notes} />}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Section 2: Not accepted plans (out-of-network) */}
      {notAccepted.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <p className="text-xs font-semibold text-slate-700">Out of network at Moonlit</p>
          </div>
          <ul className="space-y-1 ml-6">
            {notAccepted.map((plan) => (
              <li
                key={plan.plan_id}
                className="flex items-center gap-2 text-slate-700"
              >
                <span className="text-red-500 text-sm">✗</span>
                <span className="flex items-center gap-1.5">
                  {plan.plan_name}
                  {plan.plan_type && <PlanTypeBadge planType={plan.plan_type} />}
                  {plan.notes && <InfoTooltip content={plan.notes} />}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Section 3: Needs review (rare - unknown status) */}
      {needsReview.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <svg className="w-4 h-4 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p className="text-xs font-semibold text-yellow-900">We'll confirm during eligibility</p>
          </div>
          <ul className="space-y-1 ml-6">
            {needsReview.map((plan) => (
              <li
                key={plan.plan_id}
                className="flex items-center gap-2 text-yellow-900"
              >
                <span className="text-yellow-600">⚠</span>
                <span className="flex items-center gap-1.5">
                  {plan.plan_name}
                  {plan.plan_type && <PlanTypeBadge planType={plan.plan_type} />}
                  {plan.notes && <InfoTooltip content={plan.notes} />}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}
