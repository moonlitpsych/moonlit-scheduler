import type { PayerPlanDisplayData, PayerPlanInfo } from '@/types/payer-plans'
import PlanTypeBadge from '@/components/ui/PlanTypeBadge'
import InfoTooltip from '@/components/ui/InfoTooltip'

interface PayerPlansListProps {
  data: PayerPlanDisplayData
}

/**
 * Displays payer plans partitioned into three sections:
 * 1. We accept these plans (✅ in-network)
 * 2. We can't accept these plans (🚫 not in-network)
 * 3. Needs review (⚠️ unknown status - rare)
 *
 * Used in the booking flow to help patients understand which specific plans
 * are accepted by Moonlit. This is INFORMATIONAL ONLY - does not affect booking validation.
 */
export default function PayerPlansList({ data }: PayerPlansListProps) {
  const { payer_name, accepted, notAccepted, needsReview } = data

  // Render a single plan item
  const renderPlanItem = (plan: PayerPlanInfo) => (
    <li
      key={plan.plan_id}
      className="flex items-center justify-between py-2 px-3 hover:bg-gray-50 rounded"
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-900">{plan.plan_name}</span>
        {plan.plan_type && <PlanTypeBadge planType={plan.plan_type} />}
        {plan.notes && <InfoTooltip content={plan.notes} />}
      </div>
    </li>
  )

  return (
    <div className="space-y-6">
      {/* Header - Payer name */}
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-900">{payer_name}</h3>
        <p className="text-sm text-gray-600 mt-1">Plan details</p>
      </div>

      {/* Section 1: Accepted plans */}
      {accepted.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <svg
              className="w-5 h-5 text-green-600"
              fill="currentColor"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <h4 className="text-base font-semibold text-gray-900">
              We accept these plans
            </h4>
          </div>
          <p className="text-sm text-gray-600 mb-2">We accept this insurance.</p>
          <ul
            className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-200"
            role="list"
            aria-label={`${accepted.length} accepted plan${accepted.length !== 1 ? 's' : ''}`}
          >
            {accepted.map(renderPlanItem)}
          </ul>
        </div>
      )}

      {/* Section 2: Not accepted plans */}
      {notAccepted.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <svg
              className="w-5 h-5 text-red-600"
              fill="currentColor"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <h4 className="text-base font-semibold text-gray-900">
              We can't accept these plans
            </h4>
          </div>
          <p className="text-sm text-gray-600 mb-2">These plans are out of network at Moonlit.</p>
          <ul
            className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-200"
            role="list"
            aria-label={`${notAccepted.length} plan${notAccepted.length !== 1 ? 's' : ''} not accepted`}
          >
            {notAccepted.map(renderPlanItem)}
          </ul>
        </div>
      )}

      {/* Section 3: Needs review (rare - only shown if exists) */}
      {needsReview.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <svg
              className="w-5 h-5 text-yellow-600"
              fill="currentColor"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <h4 className="text-sm font-semibold text-yellow-900">Needs review</h4>
          </div>
          <p className="text-sm text-yellow-800 mb-3">
            We're confirming {needsReview.length === 1 ? 'this plan' : 'these plans'}. We'll check eligibility after you continue.
          </p>
          <ul
            className="bg-white border border-yellow-300 rounded-lg divide-y divide-yellow-200"
            role="list"
            aria-label={`${needsReview.length} plan${needsReview.length !== 1 ? 's' : ''} under review`}
          >
            {needsReview.map(renderPlanItem)}
          </ul>
        </div>
      )}

      {/* Empty state: no plans at all */}
      {accepted.length === 0 && notAccepted.length === 0 && needsReview.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-600">No plan information available for this payer.</p>
        </div>
      )}
    </div>
  )
}
