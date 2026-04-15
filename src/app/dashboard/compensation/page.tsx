'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { RefreshCw, Download, Calendar, DollarSign, CheckCircle, Clock } from 'lucide-react'
import { providerImpersonationManager } from '@/lib/provider-impersonation'

interface CompItem {
  appointmentId: string
  date: string
  patientLastName: string
  service: string
  claimStatus: string | null
  earnedCents: number
  paidCents: number
  paidDate: string | null
  reimbursedCents: number
  status: 'paid' | 'unpaid' | 'ready'
}

interface Summary {
  totalAppointments: number
  totalEarnedCents: number
  totalPaidCents: number
  totalOwedCents: number
  paidCount: number
  unpaidCount: number
  readyCount: number
}

type PayFilter = 'all' | 'paid' | 'unpaid' | 'next_pay_cycle'
type SortField = 'date' | 'patient' | 'service' | 'earned' | 'status'
type SortDir = 'asc' | 'desc'

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100)
}

export default function CompensationPage() {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<CompItem[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [filter, setFilter] = useState<PayFilter>('all')
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      // 'next_pay_cycle' is a UI alias for the API's 'ready' filter
      const apiFilter = filter === 'next_pay_cycle' ? 'ready' : filter
      if (apiFilter !== 'all') params.set('filter', apiFilter)
      if (search) params.set('search', search)
      const impersonation = providerImpersonationManager.getImpersonatedProvider()
      if (impersonation?.provider?.id) params.set('providerId', impersonation.provider.id)

      const res = await fetch(`/api/dashboard/provider-compensation?${params}`)
      const json = await res.json()
      if (json.success) {
        setItems(json.items)
        setSummary(json.summary)
      }
    } catch (err) {
      console.error('Failed to load compensation:', err)
    } finally {
      setLoading(false)
    }
  }, [filter, search])

  useEffect(() => { loadData() }, [loadData])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir(field === 'patient' ? 'asc' : 'desc')
    }
  }

  const sortIcon = (field: SortField) => {
    if (sortField !== field) return <span className="text-slate-300 ml-1">↕</span>
    return <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  const sorted = useMemo(() => {
    const s = [...items]
    s.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'date': cmp = a.date.localeCompare(b.date); break
        case 'patient': cmp = a.patientLastName.localeCompare(b.patientLastName); break
        case 'service': cmp = a.service.localeCompare(b.service); break
        case 'earned': cmp = a.paidCents - b.paidCents; break
        case 'status': cmp = a.status.localeCompare(b.status); break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return s
  }, [items, sortField, sortDir])

  const handleExport = () => {
    const header = 'Date,Patient,Service,Claim Status,Paid,Paid Date,Status'
    const rows = sorted.map(i =>
      `${i.date},"${i.patientLastName}","${i.service}",${i.claimStatus || ''},${(i.paidCents / 100).toFixed(2)},${i.paidDate || ''},${i.status}`
    )
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `compensation-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const claimChip = (claim: string | null) => {
    if (!claim) return <span className="text-slate-400">—</span>
    const lower = claim.toLowerCase()
    if (lower === 'paid') {
      return <span className="text-xs px-2 py-0.5 rounded font-medium bg-emerald-100 text-emerald-700">Finalized</span>
    }
    if (lower === 'accepted') {
      return <span className="text-xs px-2 py-0.5 rounded font-medium bg-blue-100 text-blue-700">{claim}</span>
    }
    if (lower === 'denied' || lower === 'rejected') {
      return <span className="text-xs px-2 py-0.5 rounded font-medium bg-red-100 text-red-700">{claim}</span>
    }
    return <span className="text-xs px-2 py-0.5 rounded font-medium bg-slate-100 text-slate-600">{claim}</span>
  }

  const statusChip = (status: string) => {
    if (status === 'paid') return <span className="text-xs px-2 py-0.5 rounded font-medium bg-emerald-100 text-emerald-700">Paid</span>
    if (status === 'ready') return <span className="text-xs px-2 py-0.5 rounded font-medium bg-amber-100 text-amber-700">Next Pay Cycle</span>
    return <span className="text-xs px-2 py-0.5 rounded font-medium bg-slate-100 text-slate-500">Unpaid</span>
  }

  const filters: { value: PayFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'paid', label: 'Paid' },
    { value: 'unpaid', label: 'Unpaid' },
    { value: 'next_pay_cycle', label: 'Next Pay Cycle' },
  ]

  return (
    <div className="max-w-full mx-auto p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#091747] font-['Newsreader']">My Compensation</h1>
          <p className="text-[#091747]/60 mt-1">Your appointment-level compensation</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport} disabled={loading || !sorted.length}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-stone-300 rounded-lg hover:bg-stone-50 transition-colors disabled:opacity-50">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={loadData} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-stone-300 rounded-lg hover:bg-stone-50 transition-colors disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-5">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-4 h-4 text-slate-500" />
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Appointments</p>
            </div>
            <p className="text-2xl font-bold text-[#091747]">{summary.totalAppointments}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-5">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-emerald-500" />
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Paid</p>
            </div>
            <p className="text-2xl font-bold text-emerald-600">{formatCurrency(summary.totalPaidCents)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-5">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Paid</p>
            </div>
            <p className="text-2xl font-bold text-emerald-600">{summary.paidCount}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-5">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-amber-500" />
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Unpaid</p>
            </div>
            <p className="text-2xl font-bold text-amber-600">{summary.unpaidCount}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search patient, service..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm w-48 focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/50"
          />

          <div className="flex rounded-lg border border-slate-300 overflow-hidden">
            {filters.map(f => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`px-3 py-2 text-xs font-medium transition-colors ${
                  filter === f.value
                    ? 'bg-[#091747] text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {summary && (
            <p className="text-xs text-slate-500 ml-auto">
              Showing {sorted.length} of {summary.totalAppointments} appointments
            </p>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        ) : sorted.length === 0 ? (
          <p className="text-center text-slate-500 py-12">No appointments match your filters</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-[#091747] cursor-pointer select-none" onClick={() => handleSort('date')}>Date {sortIcon('date')}</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#091747] cursor-pointer select-none" onClick={() => handleSort('patient')}>Patient {sortIcon('patient')}</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#091747] cursor-pointer select-none" onClick={() => handleSort('service')}>Service {sortIcon('service')}</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#091747]">Claim Status</th>
                  <th className="text-right px-4 py-3 font-semibold text-[#091747] cursor-pointer select-none" onClick={() => handleSort('earned')}>Paid {sortIcon('earned')}</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#091747]">Paid Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#091747] cursor-pointer select-none" onClick={() => handleSort('status')}>Status {sortIcon('status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {sorted.map((item, i) => (
                  <tr key={`${item.appointmentId}-${i}`} className="hover:bg-stone-50">
                    <td className="px-4 py-3 text-[#091747]">
                      {item.date ? new Date(item.date + 'T12:00:00').toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 font-medium text-[#091747]">{item.patientLastName || '—'}</td>
                    <td className="px-4 py-3 text-[#091747]/70 max-w-[240px] truncate" title={item.service}>{item.service || '—'}</td>
                    <td className="px-4 py-3">{claimChip(item.claimStatus)}</td>
                    <td className="px-4 py-3 text-right text-emerald-600 font-medium">
                      {item.paidCents > 0 ? formatCurrency(item.paidCents) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {item.paidDate ? new Date(item.paidDate + 'T12:00:00').toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">{statusChip(item.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
