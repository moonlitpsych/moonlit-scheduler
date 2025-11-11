'use client'

import { useState } from 'react'
import PayerPlansList from '@/components/booking/PayerPlansList'
import { usePayerPlans } from '@/hooks/usePayerPlans'

/**
 * Demo page for payer plan display functionality
 *
 * Tests the complete flow with SelectHealth Integrated as specified in requirements.
 * Shows accepted plans, not accepted plans, and needs review sections.
 */
export default function PayerPlansDemo() {
  // SelectHealth Integrated test case
  const [selectedPayerId, setSelectedPayerId] = useState<string | null>(
    'd37d3938-b48d-4bdf-b500-bf5413157ef4'
  )

  const { data, loading, error } = usePayerPlans(selectedPayerId)

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Payer Plan Display Demo
            </h1>
            <p className="text-gray-600">
              Testing the plan clarification UI with SelectHealth Integrated
            </p>
          </div>

          {/* Test Case Info */}
          <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h2 className="font-semibold text-blue-900 mb-2">Test Case:</h2>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>
                <strong>Payer:</strong> SelectHealth Integrated
              </li>
              <li>
                <strong>Payer ID:</strong> {selectedPayerId}
              </li>
              <li>
                <strong>Expected Accepted Plans:</strong> 6 (Select Choice, Select
                Care, Select Med, Select Value, SelectHealth Share, Select Access)
              </li>
              <li>
                <strong>Expected Not Accepted:</strong> 1 (SelectHealth Signature)
              </li>
              <li>
                <strong>Expected Needs Review:</strong> 0
              </li>
            </ul>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600">Loading plan information...</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <h3 className="font-semibold text-red-900 mb-1">Error</h3>
              <p className="text-sm text-red-700">{error}</p>
              <p className="text-xs text-red-600 mt-2">
                This is a non-blocking error. The user can still continue with the
                booking flow.
              </p>
            </div>
          )}

          {/* Plan Display */}
          {data && !loading && (
            <div>
              <PayerPlansList data={data} />

              {/* Results Summary */}
              <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="font-semibold text-green-900 mb-2">
                  Test Results:
                </h3>
                <ul className="text-sm text-green-800 space-y-1">
                  <li>
                    ✓ Accepted plans: {data.accepted.length} (expected: 6)
                  </li>
                  <li>
                    ✓ Not accepted plans: {data.notAccepted.length} (expected: 1)
                  </li>
                  <li>
                    ✓ Needs review: {data.needsReview.length} (expected: 0)
                  </li>
                  <li className="mt-2 font-medium">
                    {data.accepted.length === 6 &&
                    data.notAccepted.length === 1 &&
                    data.needsReview.length === 0
                      ? '🎉 All test cases passed!'
                      : '⚠️ Test results do not match expectations'}
                  </li>
                </ul>
              </div>

              {/* Plan Details */}
              <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">
                  Plan Details:
                </h3>
                <div className="text-sm text-gray-700 space-y-2">
                  <div>
                    <strong>Accepted Plans:</strong>
                    <ul className="ml-4 mt-1 list-disc">
                      {data.accepted.map((plan) => (
                        <li key={plan.plan_id}>
                          {plan.plan_name} ({plan.plan_type || 'N/A'})
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <strong>Not Accepted Plans:</strong>
                    <ul className="ml-4 mt-1 list-disc">
                      {data.notAccepted.map((plan) => (
                        <li key={plan.plan_id}>
                          {plan.plan_name} ({plan.plan_type || 'N/A'})
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Integration Instructions */}
          <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h3 className="font-semibold text-yellow-900 mb-2">
              Next Steps for Integration:
            </h3>
            <ol className="text-sm text-yellow-800 space-y-1 list-decimal list-inside">
              <li>
                Add expandable section to payer cards in PayerSearchView.tsx
              </li>
              <li>Use usePayerPlans hook to fetch plan data on expand</li>
              <li>Render PayerPlansList component in expanded section</li>
              <li>Add "View plans" button to each payer card</li>
              <li>Keep existing "Select →" button for proceeding with selection</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
