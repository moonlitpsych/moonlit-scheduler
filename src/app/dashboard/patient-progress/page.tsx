'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { RefreshCw, Download, TrendingDown, TrendingUp, Minus, Search } from 'lucide-react'
import {
  severityLabel,
  severityColor,
  maxScore,
  type PatientProgressData,
  type PatientOutcomeSummary,
} from '@/lib/outcome-measures'
import ScoreSparkline from './components/ScoreSparkline'
import PatientDetailDrawer from './components/PatientDetailDrawer'
import { providerImpersonationManager } from '@/lib/provider-impersonation'

type SortField = 'patientName' | 'firstScore' | 'lastScore' | 'scoreChange'
type SortDir = 'asc' | 'desc'

export default function PatientProgressPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<PatientProgressData | null>(null)
  const [measureFilter, setMeasureFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [openPatientId, setOpenPatientId] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField>('patientName')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams()
    if (measureFilter !== 'all') params.set('measureType', measureFilter)
    const impersonation = providerImpersonationManager.getImpersonatedProvider()
    if (impersonation?.provider?.id) params.set('providerId', impersonation.provider.id)
    return params
  }, [measureFilter])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/provider/patient-progress?${buildQuery()}`)
      if (res.ok) {
        setData(await res.json())
      } else {
        setData(null)
      }
    } catch (error) {
      console.error('Failed to load patient progress:', error)
    } finally {
      setLoading(false)
    }
  }, [buildQuery])

  useEffect(() => { loadData() }, [loadData])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir(field === 'patientName' ? 'asc' : 'desc')
    }
  }

  const sortIcon = (field: SortField) => {
    if (sortField !== field) return <span className="text-slate-300 ml-1">↕</span>
    return <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  const visiblePatients = useMemo<PatientOutcomeSummary[]>(() => {
    if (!data) return []
    const sorted = [...data.patients]
    sorted.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'patientName': cmp = a.patientName.localeCompare(b.patientName); break
        case 'firstScore': cmp = a.firstScore - b.firstScore; break
        case 'lastScore': cmp = a.lastScore - b.lastScore; break
        case 'scoreChange': cmp = a.scoreChange - b.scoreChange; break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    const norm = (s: string) =>
      s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
    const tokens = norm(searchQuery).split(/\s+/).filter(Boolean)
    if (tokens.length === 0) return sorted

    return sorted.filter(p => {
      const name = norm(p.patientName)
      return tokens.every(t => name.includes(t))
    })
  }, [data, sortField, sortDir, searchQuery])

  const handleExportCsv = () => {
    window.open(`/api/provider/patient-progress/export?${buildQuery()}`, '_blank')
  }

  const statusBadge = (p: PatientOutcomeSummary) => {
    if (p.scores.length < 2) return <span className="px-2 py-0.5 text-xs rounded bg-slate-100 text-slate-500">New</span>
    if (p.remissionAchieved) return <span className="px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-700">In Remission</span>
    if (p.responseAchieved) return <span className="px-2 py-0.5 text-xs rounded bg-green-100 text-green-700">Response</span>
    if (p.improved) return <span className="px-2 py-0.5 text-xs rounded bg-emerald-50 text-emerald-700">Improved</span>
    if (p.scoreChange === 0) return <span className="px-2 py-0.5 text-xs rounded bg-slate-100 text-slate-600">Stable</span>
    return <span className="px-2 py-0.5 text-xs rounded bg-red-100 text-red-700">Worsened</span>
  }

  const changeIcon = (change: number) => {
    if (change < 0) return <TrendingDown className="w-3.5 h-3.5 text-green-600 inline" />
    if (change > 0) return <TrendingUp className="w-3.5 h-3.5 text-red-600 inline" />
    return <Minus className="w-3.5 h-3.5 text-slate-400 inline" />
  }

  const multi = data?.patients.filter(p => p.scores.length >= 2) || []
  const pctImproved = multi.length > 0 ? Math.round((multi.filter(p => p.improved).length / multi.length) * 100) + '%' : '—'
  const pctRemission = multi.length > 0 ? Math.round((multi.filter(p => p.remissionAchieved).length / multi.length) * 100) + '%' : '—'

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#091747] font-['Newsreader']">Patient Progress</h1>
          <p className="text-sm text-slate-500 mt-1">PHQ-9 &amp; GAD-7 trends for your patients</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            disabled={!data || data.patients.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 rounded text-sm font-medium hover:bg-slate-200 disabled:opacity-50"
            title="Raw CSV — internal use only"
          >
            <Download className="w-4 h-4" /> CSV
          </button>
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-slate-600"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <select
          value={measureFilter}
          onChange={e => setMeasureFilter(e.target.value)}
          className="px-3 py-1.5 border rounded text-sm bg-white"
        >
          <option value="all">All Measures</option>
          <option value="PHQ-9">PHQ-9</option>
          <option value="GAD-7">GAD-7</option>
        </select>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search patient name…"
            className="w-full pl-8 pr-3 py-1.5 border rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#BF9C73] focus:border-[#BF9C73]"
          />
        </div>
        {data && searchQuery && (
          <span className="text-xs text-slate-500">
            {visiblePatients.length} of {data.patients.length}
          </span>
        )}
      </div>

      {loading && !data ? (
        <div className="text-center py-12 text-slate-400">Loading...</div>
      ) : !data || data.patients.length === 0 ? (
        <div className="text-center py-12 bg-white border rounded-lg">
          <p className="text-slate-500">No PHQ-9 or GAD-7 scores recorded for your patients yet.</p>
          <p className="text-slate-400 text-sm mt-2">Outcome measures are uploaded by Moonlit admins from IntakeQ.</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <SummaryCard label="Patients Tracked" value={data.uploadSummary.patientCount} />
            <SummaryCard label="Total Assessments" value={data.uploadSummary.totalMeasures} />
            <SummaryCard label="% Improved" value={pctImproved} />
            <SummaryCard label="% In Remission" value={pctRemission} />
          </div>

          {/* Patient table */}
          <div className="border rounded-lg bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort('patientName')}>
                    Patient {sortIcon('patientName')}
                  </th>
                  <th className="px-4 py-2">Measure</th>
                  <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort('firstScore')}>
                    First {sortIcon('firstScore')}
                  </th>
                  <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort('lastScore')}>
                    Last {sortIcon('lastScore')}
                  </th>
                  <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort('scoreChange')}>
                    Change {sortIcon('scoreChange')}
                  </th>
                  <th className="px-4 py-2">Trend</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Assessments</th>
                </tr>
              </thead>
              <tbody>
                {visiblePatients.map(p => (
                  <tr
                    key={`${p.patientId}-${p.measureType}`}
                    onClick={() => setOpenPatientId(p.patientId)}
                    className="border-t hover:bg-[#FEF8F1] cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-2 font-medium text-[#091747]">{p.patientName}</td>
                    <td className="px-4 py-2">{p.measureType}</td>
                    <td className="px-4 py-2">
                      <span className="font-mono">{p.firstScore}</span>
                      <span className="ml-1 text-xs" style={{ color: severityColor(p.scores[0]?.severity) }}>
                        {severityLabel(p.scores[0]?.severity)}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="font-mono">{p.lastScore}</span>
                      <span className="ml-1 text-xs" style={{ color: severityColor(p.scores[p.scores.length - 1]?.severity) }}>
                        {severityLabel(p.scores[p.scores.length - 1]?.severity)}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {p.scores.length >= 2 ? (
                        <span className={`font-mono ${p.scoreChange < 0 ? 'text-green-600' : p.scoreChange > 0 ? 'text-red-600' : 'text-slate-500'}`}>
                          {changeIcon(p.scoreChange)} {p.scoreChange > 0 ? '+' : ''}{p.scoreChange}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-2">
                      <ScoreSparkline scores={p.scores} maxScore={maxScore(p.measureType)} />
                    </td>
                    <td className="px-4 py-2">{statusBadge(p)}</td>
                    <td className="px-4 py-2 text-slate-500">{p.scores.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <PatientDetailDrawer
        patientId={openPatientId}
        onClose={() => setOpenPatientId(null)}
      />
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white border rounded-lg p-4">
      <p className="text-xs text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-[#091747] mt-1">{value}</p>
    </div>
  )
}
