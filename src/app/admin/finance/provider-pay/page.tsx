'use client'

import { useState, useEffect } from 'react'
import { DollarSign, Calendar, Users, Download, Plus, CheckCircle } from 'lucide-react'

interface ProviderPaySummary {
  provider_id: string
  practitioner: string
  provider_title: string
  appointment_count: number
  total_expected_gross_cents: number
  total_expected_pay_cents: number
  total_paid_cents: number | null
  total_pending_cents: number
  paid_count: number
  pending_count: number
}

interface PayPeriod {
  id: string
  period_start: string
  period_end: string
  status: string
}

export default function ProviderPayPage() {
  const [loading, setLoading] = useState(false)
  const [providers, setProviders] = useState<ProviderPaySummary[]>([])
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')

  useEffect(() => {
    // Default to current biweekly period
    const today = new Date()
    const dayOfMonth = today.getDate()
    const isFirstHalf = dayOfMonth <= 15

    const year = today.getFullYear()
    const month = today.getMonth() + 1

    if (isFirstHalf) {
      setPeriodStart(`${year}-${String(month).padStart(2, '0')}-01`)
      setPeriodEnd(`${year}-${String(month).padStart(2, '0')}-15`)
    } else {
      const lastDay = new Date(year, month, 0).getDate()
      setPeriodStart(`${year}-${String(month).padStart(2, '0')}-16`)
      setPeriodEnd(`${year}-${String(month).padStart(2, '0')}-${lastDay}`)
    }
  }, [])

  const fetchProviderSummary = async () => {
    if (!periodStart || !periodEnd) {
      alert('Please select a pay period')
      return
    }

    try {
      setLoading(true)

      const params = new URLSearchParams({
        from: periodStart,
        to: periodEnd,
        limit: '1000'
      })

      const response = await fetch(`/api/finance/appointments?${params}`)
      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error)
      }

      // Group by provider
      const grouped = new Map<string, ProviderPaySummary>()

      result.data.forEach((appt: any) => {
        const key = appt.provider_id
        if (!grouped.has(key)) {
          grouped.set(key, {
            provider_id: appt.provider_id,
            practitioner: appt.practitioner,
            provider_title: appt.provider_title || '',
            appointment_count: 0,
            total_expected_gross_cents: 0,
            total_expected_pay_cents: 0,
            total_paid_cents: 0,
            total_pending_cents: 0,
            paid_count: 0,
            pending_count: 0
          })
        }

        const summary = grouped.get(key)!
        summary.appointment_count++
        summary.total_expected_gross_cents += appt.expected_gross_cents || 0
        summary.total_expected_pay_cents += appt.provider_expected_pay_cents || 0

        if (appt.provider_pay_status === 'PAID') {
          summary.total_paid_cents = (summary.total_paid_cents || 0) + (appt.provider_paid_cents || 0)
          summary.paid_count++
        } else if (appt.provider_pay_status === 'PENDING') {
          summary.total_pending_cents += appt.provider_expected_pay_cents || 0
          summary.pending_count++
        }
      })

      setProviders(Array.from(grouped.values()).sort((a, b) =>
        a.practitioner.localeCompare(b.practitioner)
      ))

    } catch (error: any) {
      console.error('Failed to fetch provider summary:', error)
      alert('Failed to load data: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (periodStart && periodEnd) {
      fetchProviderSummary()
    }
  }, [periodStart, periodEnd])

  const exportStubs = () => {
    if (providers.length === 0) {
      alert('No data to export')
      return
    }

    const headers = [
      'Provider',
      'Title',
      'Appointments',
      'Total Expected Pay',
      'Already Paid',
      'Pending Amount',
      'Period Start',
      'Period End'
    ]

    const rows = providers.map(p => [
      p.practitioner,
      p.provider_title,
      p.appointment_count,
      (p.total_expected_pay_cents / 100).toFixed(2),
      ((p.total_paid_cents || 0) / 100).toFixed(2),
      (p.total_pending_cents / 100).toFixed(2),
      periodStart,
      periodEnd
    ])

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pay_stubs_${periodStart}_${periodEnd}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalPending = providers.reduce((sum, p) => sum + p.total_pending_cents, 0)
  const totalPaid = providers.reduce((sum, p) => sum + (p.total_paid_cents || 0), 0)
  const totalAppointments = providers.reduce((sum, p) => sum + p.appointment_count, 0)

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#091747] font-['Newsreader'] mb-2">
          Finance — Provider Pay
        </h1>
        <p className="text-[#091747]/70">
          Manage provider compensation and payroll runs
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border border-stone-200">
          <div className="text-2xl font-bold text-[#091747]">
            {providers.length}
          </div>
          <div className="text-sm text-[#091747]/60">Providers</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-stone-200">
          <div className="text-2xl font-bold text-[#091747]">
            {totalAppointments}
          </div>
          <div className="text-sm text-[#091747]/60">Appointments</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-stone-200">
          <div className="text-2xl font-bold text-[#091747]">
            ${(totalPending / 100).toLocaleString()}
          </div>
          <div className="text-sm text-[#091747]/60">Pending Pay</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-stone-200">
          <div className="text-2xl font-bold text-green-600">
            ${(totalPaid / 100).toLocaleString()}
          </div>
          <div className="text-sm text-[#091747]/60">Already Paid</div>
        </div>
      </div>

      {/* Controls */}
      <div className="mb-6 flex items-end justify-between flex-wrap gap-4">
        {/* Period Selector */}
        <div className="flex items-end space-x-4">
          <div>
            <label className="block text-sm font-medium text-[#091747]/70 mb-1">
              Period Start
            </label>
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#091747]/70 mb-1">
              Period End
            </label>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20"
            />
          </div>
          <button
            onClick={fetchProviderSummary}
            className="px-4 py-2 bg-[#091747] hover:bg-[#091747]/90 text-white rounded-lg transition-colors"
          >
            Load Period
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-2">
          <button
            onClick={exportStubs}
            disabled={providers.length === 0}
            className="flex items-center space-x-2 px-4 py-2 border border-stone-200 hover:bg-stone-50 text-[#091747] rounded-lg transition-colors disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            <span>Export Pay Stubs</span>
          </button>
        </div>
      </div>

      {/* Provider Table */}
      <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-[#091747]/60">Loading...</div>
        ) : providers.length === 0 ? (
          <div className="p-8 text-center text-[#091747]/60">
            Select a pay period to view provider compensation
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#091747]/60 uppercase">
                    Provider
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#091747]/60 uppercase">
                    Title
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-[#091747]/60 uppercase">
                    Appointments
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-[#091747]/60 uppercase">
                    Total Expected Pay
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-[#091747]/60 uppercase">
                    Paid
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-[#091747]/60 uppercase">
                    Pending
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-[#091747]/60 uppercase">
                    Pending Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {providers.map((provider) => (
                  <tr key={provider.provider_id} className="hover:bg-stone-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-[#091747]">
                      {provider.practitioner}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#091747]/60">
                      {provider.provider_title}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#091747] text-center">
                      {provider.appointment_count}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#091747] text-right">
                      ${(provider.total_expected_pay_cents / 100).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {provider.paid_count}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        {provider.pending_count}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#091747] text-right font-medium">
                      ${(provider.total_pending_cents / 100).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-stone-50 border-t-2 border-stone-300">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-sm font-bold text-[#091747]">
                    TOTAL
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-[#091747] text-right">
                    ${(providers.reduce((sum, p) => sum + p.total_expected_pay_cents, 0) / 100).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {providers.reduce((sum, p) => sum + p.paid_count, 0)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      {providers.reduce((sum, p) => sum + p.pending_count, 0)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-[#091747] text-right">
                    ${(totalPending / 100).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-900 mb-2">Provider Pay Run Workflow (Future)</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>1. Review provider pay summary for the selected period</li>
          <li>2. Create Draft Pay Run (stores snapshot of all pending appointments)</li>
          <li>3. Review draft and make any adjustments</li>
          <li>4. Post Run (marks all appointments as PAID and records payment date)</li>
          <li>5. Export pay stubs CSV for payroll processing</li>
        </ul>
        <p className="text-xs text-blue-700 mt-2">
          Note: Full pay run creation/posting will be implemented in Phase 2. For now, use Export Pay Stubs to generate reports.
        </p>
      </div>
    </div>
  )
}
