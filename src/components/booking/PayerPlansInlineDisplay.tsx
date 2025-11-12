import type { PayerPlanDisplayData } from '@/types/payer-plans'

interface PayerPlansInlineDisplayProps {
  data: PayerPlanDisplayData
  payerName: string
}

/**
 * Compact inline plan display for payer search cards
 *
 * Shows two simple lists:
 * 1. In-network plans (with bullets)
 * 2. Non-accepted plans (with X icons)
 *
 * Designed to fit inline within existing payer cards.
 */
export default function PayerPlansInlineDisplay({
  data,
  payerName
}: PayerPlansInlineDisplayProps) {
  const { accepted, notAccepted } = data

  // Don't render if no plans to show
  if (accepted.length === 0 && notAccepted.length === 0) {
    return null
  }

  // Extract brand name from payer name (e.g., "SelectHealth" from "SelectHealth Integrated")
  const brandName = payerName.split(' ')[0]

  return (
    <div className="mt-3 pt-3 border-t border-stone-200 space-y-2 text-sm">
      {/* Accepted plans section */}
      {accepted.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-600 mb-1">
            {brandName} in-network plans:
          </p>
          <ul className="space-y-0.5">
            {accepted.map((plan) => (
              <li
                key={plan.plan_id}
                className="flex items-center gap-2 text-slate-700"
              >
                <span className="text-slate-400">•</span>
                <span>
                  {plan.plan_name}
                  {plan.plan_type && (
                    <span className="ml-1.5 text-xs text-slate-500">
                      ({plan.plan_type})
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Not accepted plans section */}
      {notAccepted.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-600 mb-1">
            Non-accepted {brandName} plans:
          </p>
          <ul className="space-y-0.5">
            {notAccepted.map((plan) => (
              <li
                key={plan.plan_id}
                className="flex items-center gap-2 text-slate-700"
              >
                <span className="text-red-500 text-sm">✗</span>
                <span>
                  {plan.plan_name}
                  {plan.plan_type && (
                    <span className="ml-1.5 text-xs text-slate-500">
                      ({plan.plan_type})
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
