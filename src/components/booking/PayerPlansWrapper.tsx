'use client'

import { usePayerPlans } from '@/hooks/usePayerPlans'
import PayerPlansInlineDisplay from './PayerPlansInlineDisplay'

interface PayerPlansWrapperProps {
  payerId: string
  payerName: string
}

/**
 * Wrapper component that fetches plan data and renders inline display
 *
 * Handles loading and error states gracefully.
 * Uses session cache to avoid duplicate API calls.
 */
export default function PayerPlansWrapper({
  payerId,
  payerName
}: PayerPlansWrapperProps) {
  const { data, loading, error } = usePayerPlans(payerId)

  // Show nothing while loading (avoid layout shift)
  if (loading) {
    return (
      <div className="mt-3 pt-3 border-t border-stone-200">
        <p className="text-xs text-slate-400 italic">Loading plan details...</p>
      </div>
    )
  }

  // Silently fail if error (don't break the card)
  if (error || !data) {
    return null
  }

  // Render the inline display
  return <PayerPlansInlineDisplay data={data} payerName={payerName} />
}
