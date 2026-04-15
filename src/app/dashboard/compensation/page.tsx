'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { DollarSign, RefreshCw, Download, Search, CheckCircle, Clock, ArrowUpRight } from 'lucide-react'
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

type StatusFilter = 'all' | 'paid' | 'unpaid' | 'ready'
type SortField = 'date' | 'patient' | 'service' | 'earned' | 'status'
type SortDir = 'asc' | 'desc'

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export default function CompensationPage() {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<CompItem[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [providerName, setProviderName] = useState('')
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter !== 'all') params.set('filter', filter)
      if (search) params.set('search', search)
      const impersonation = providerImpersonationManager.getImpersonatedProvider()
      if (impersonation?.provider?.id) params.set('providerId', impersonation.provider.id)

      const res = await fetch(`/api/dashboard/provider-compensation?${params}`)
      const json = await res.json()
      if (json.success) {
        setItems(json.items)
        setSummary(json.summary)
        setProviderName(json.provider?.name || '')
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
    if (sortField !== field) return <span className="text-stone-300 ml-1">↕</span>
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
        case 'earned': cmp = a.earnedCents - b.earnedCents; break
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

  const statusBadge = (status: string) => {
    switch (status) {
      case 'paid': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"><CheckCircle className="w-3 h-3" /> Paid</span>
      case 'ready': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700"><ArrowUpRight className="w-3 h-3" /> Ready to Pay</span>
      case 'unpaid': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-500"><Clock className="w-3 h-3" /> Pending</span>
      default: return null
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#091747] font-['Newsreader']">
            My Compensation
          </h1>
          <p className="text-stone-600 mt-2">
            Track your earnings and payment status
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} disabled={items.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-stone-600 bg-white border rounded-lg hover:bg-stone-50 disabled:opacity-50">
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={loadData} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-white bg-[#BF9C73] rounded-lg hover:bg-[#BF9C73]/90 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-5 border border-stone-100">
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Appointments</p>
            <p className="text-2xl font-bold text-[#091747] mt-1">{summary.totalAppointments}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-5 border border-stone-100">
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Total Paid</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(summary.totalPaidCents)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-5 border border-stone-100">
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Paid</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{summary.paidCount}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-5 border border-stone-100">
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Ready to Pay</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{summary.readyCount}</p>
            <p className="text-xs text-stone-400 mt-0.5">{summary.unpaidCount} pending</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex bg-white border rounded-lg overflow-hidden">
          {(['all', 'paid', 'unpaid', 'ready'] as StatusFilter[]).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === f ? 'bg-[#091747] text-white' : 'text-stone-600 hover:bg-stone-50'
              }`}>
              {f === 'all' ? 'All' : f === 'paid' ? 'Paid' : f === 'unpaid' ? 'Pending' : 'Ready to Pay'}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            placeholder="Search patient or service..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 border rounded-lg text-sm bg-white"
          />
        </div>
      </div>

      {/* Table */}
      {loading && items.length === 0 ? (
        <div className="text-center py-12 text-stone-400">Loading...</div>
      ) : sorted.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center text-stone-400">
          No appointments match your filters.
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-x-auto border border-stone-100">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr className="text-left text-xs uppercase tracking-wider text-stone-400">
                <th className="px-4 py-3 cursor-pointer select-none" onClick={() => handleSort('date')}>Date {sortIcon('date')}</th>
                <th className="px-4 py-3 cursor-pointer select-none" onClick={() => handleSort('patient')}>Patient {sortIcon('patient')}</th>
                <th className="px-4 py-3 cursor-pointer select-none" onClick={() => handleSort('service')}>Service {sortIcon('service')}</th>
                <th className="px-4 py-3">Claim</th>
                <th className="px-4 py-3 text-right cursor-pointer select-none" onClick={() => handleSort('earned')}>Paid {sortIcon('earned')}</th>
                <th className="px-4 py-3">Paid Date</th>
                <th className="px-4 py-3 cursor-pointer select-none" onClick={() => handleSort('status')}>Status {sortIcon('status')}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((item, index) => (
                <tr key={`${item.appointmentId}-${index}`} className="border-t border-stone-50 hover:bg-stone-50/50">
                  <td className="px-4 py-2.5 whitespace-nowrap text-stone-700">
                    {new Date(item.date + 'T12:00:00').toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-[#091747]">{item.patientLastName}</td>
                  <td className="px-4 py-2.5 text-stone-600">{item.service}</td>
                  <td className="px-4 py-2.5 text-xs text-stone-400">{item.claimStatus ? (item.claimStatus.toLowerCase() === 'paid' ? 'Finalized' : item.claimStatus) : '—'}</td>
                  <td className="px-4 py-2.5 text-right text-green-600">{item.paidCents > 0 ? formatCurrency(item.paidCents) : '—'}</td>
                  <td className="px-4 py-2.5 text-stone-400 text-xs">{item.paidDate ? new Date(item.paidDate + 'T12:00:00').toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-2.5">{statusBadge(item.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
