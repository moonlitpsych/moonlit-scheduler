'use client'

import { useState, useEffect } from 'react'
import { Users, DollarSign, AlertCircle } from 'lucide-react'

interface ProviderBalance {
  provider_id: string
  provider_name: string
  reimbursed_appointments: number
  earned_cents: number
  paid_cents: number
  balance_owed_cents: number
}

interface ProviderPaySummaryProps {
  onRefresh?: () => void
}

export default function ProviderPaySummary({ onRefresh }: ProviderPaySummaryProps) {
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<ProviderBalance[]>([])
  const [totalOwed, setTotalOwed] = useState(0)

  const fetchSummary = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/finance/provider-pay-summary')
      const result = await response.json()

      if (result.success) {
        setSummary(result.summary || [])
        setTotalOwed(result.metadata?.total_balance_owed_cents || 0)
      } else {
        console.error('Failed to fetch provider pay summary:', result.error)
      }
    } catch (error) {
      console.error('Error fetching provider pay summary:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSummary()
  }, [])

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-stone-200 p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Users className="h-5 w-5 text-[#091747]" />
          <h3 className="text-lg font-semibold text-[#091747]">Provider Compensation Owed</h3>
        </div>
        <div className="text-center text-[#091747]/60 py-8">Loading...</div>
      </div>
    )
  }

  if (summary.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-stone-200 p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Users className="h-5 w-5 text-[#091747]" />
          <h3 className="text-lg font-semibold text-[#091747]">Provider Compensation Owed</h3>
        </div>
        <div className="text-center text-[#091747]/60 py-8">
          <p>No providers are owed compensation.</p>
          <p className="text-sm mt-2">All reimbursed appointments have been paid.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-stone-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Users className="h-5 w-5 text-[#091747]" />
          <h3 className="text-lg font-semibold text-[#091747]">Provider Compensation Owed</h3>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-[#BF9C73]">
            ${(totalOwed / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-[#091747]/60">Total Balance</div>
        </div>
      </div>

      {/* Provider List */}
      <div className="space-y-4">
        {summary.map((provider) => (
          <div
            key={provider.provider_id}
            className="border border-stone-200 rounded-lg p-4 hover:border-[#BF9C73] transition-colors"
          >
            {/* Provider Name */}
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-[#091747]">{provider.provider_name}</h4>
              <div className="text-lg font-bold text-[#BF9C73]">
                ${(provider.balance_owed_cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            {/* Details */}
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-[#091747]/60">Reimbursed (unpaid)</div>
                <div className="font-medium text-[#091747]">{provider.reimbursed_appointments} appts</div>
              </div>
              <div>
                <div className="text-[#091747]/60">Earned</div>
                <div className="font-medium text-[#091747]">
                  ${(provider.earned_cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div>
                <div className="text-[#091747]/60">Already Paid</div>
                <div className="font-medium text-[#091747]">
                  ${(provider.paid_cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* Action placeholder - for future "Pay Now" feature */}
            <div className="mt-3 pt-3 border-t border-stone-200">
              <div className="flex items-center text-xs text-[#091747]/60">
                <AlertCircle className="h-3 w-3 mr-1" />
                Based on reimbursed appointments only
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Help Text */}
      <div className="mt-4 pt-4 border-t border-stone-200">
        <p className="text-xs text-[#091747]/60">
          This summary shows providers who are owed compensation for reimbursed appointments.
          To record a payment, open individual appointments and update the provider paid amount.
        </p>
      </div>
    </div>
  )
}
