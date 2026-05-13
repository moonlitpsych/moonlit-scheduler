'use client'

import { useEffect, useState, Fragment } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { X, ChevronDown, ChevronRight, FileText } from 'lucide-react'
import {
  maxScore,
  severityColor,
  severityLabel,
  questionText,
  type MeasureType,
  type SeverityLevel,
} from '@/lib/outcome-measures'
import { providerImpersonationManager } from '@/lib/provider-impersonation'
import type { PatientAssessment, PatientDetailResponse } from '@/app/api/provider/patient-progress/[patientId]/route'

interface Props {
  patientId: string | null
  onClose: () => void
}

interface SeverityBand {
  from: number
  to: number
  level: SeverityLevel
}

const PHQ9_BANDS: SeverityBand[] = [
  { from: 0, to: 4, level: 'minimal' },
  { from: 5, to: 9, level: 'mild' },
  { from: 10, to: 14, level: 'moderate' },
  { from: 15, to: 19, level: 'moderately_severe' },
  { from: 20, to: 27, level: 'severe' },
]
const GAD7_BANDS: SeverityBand[] = [
  { from: 0, to: 4, level: 'minimal' },
  { from: 5, to: 9, level: 'mild' },
  { from: 10, to: 14, level: 'moderate' },
  { from: 15, to: 21, level: 'severe' },
]

function bandsFor(m: MeasureType): SeverityBand[] {
  return m === 'PHQ-9' ? PHQ9_BANDS : GAD7_BANDS
}

function fmtDate(iso: string): string {
  if (!iso) return ''
  const [y, mo, d] = iso.split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[Number(mo) - 1]} ${Number(d)}, ${y}`
}

export default function PatientDetailDrawer({ patientId, onClose }: Props) {
  const [data, setData] = useState<PatientDetailResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!patientId) return
    setData(null)
    setError(null)
    setLoading(true)
    setExpanded(new Set())
    const impersonation = providerImpersonationManager.getImpersonatedProvider()
    const qs = impersonation?.provider?.id ? `?providerId=${encodeURIComponent(impersonation.provider.id)}` : ''
    fetch(`/api/provider/patient-progress/${patientId}${qs}`)
      .then(async r => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}))
          throw new Error(body?.error || `Request failed (${r.status})`)
        }
        return r.json()
      })
      .then((d: PatientDetailResponse) => setData(d))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [patientId])

  // Close on Escape
  useEffect(() => {
    if (!patientId) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [patientId, onClose])

  if (!patientId) return null

  const phq9 = (data?.assessments || []).filter(a => a.measureType === 'PHQ-9')
  const gad7 = (data?.assessments || []).filter(a => a.measureType === 'GAD-7')
  const hasAssessments = (data?.assessments?.length || 0) > 0

  const handleExportPdf = async () => {
    if (!patientId) return
    const impersonation = providerImpersonationManager.getImpersonatedProvider()
    const qs = impersonation?.provider?.id ? `?providerId=${encodeURIComponent(impersonation.provider.id)}` : ''
    const res = await fetch(`/api/provider/patient-progress/${patientId}/pdf${qs}`)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      alert(body?.error || 'Failed to generate PDF')
      return
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const slug = (data?.patientName || 'patient').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    a.href = url
    a.download = `progress-${slug}-${new Date().toISOString().slice(0, 10)}.pdf`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="flex-1 bg-black bg-opacity-30"
        onClick={onClose}
        aria-label="Close detail panel"
      />
      {/* Panel */}
      <div className="w-full max-w-3xl bg-white shadow-2xl overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-stone-200 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-xl font-bold text-[#091747] font-['Newsreader']">
              {data?.patientName || (loading ? 'Loading…' : 'Patient Detail')}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">PHQ-9 & GAD-7 progress</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPdf}
              disabled={!hasAssessments}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#BF9C73] text-white rounded text-sm font-medium hover:bg-[#a8865f] disabled:opacity-50"
              title="One-page PDF the patient can take home"
            >
              <FileText className="w-4 h-4" /> Patient PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-8">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
              {error}
            </div>
          )}
          {loading && !data && (
            <div className="text-sm text-slate-400">Loading patient history…</div>
          )}
          {data && data.assessments.length === 0 && (
            <div className="text-sm text-slate-500">
              No PHQ-9 or GAD-7 assessments recorded for this patient yet.
            </div>
          )}

          {phq9.length > 0 && (
            <MeasureSection measureType="PHQ-9" assessments={phq9} expanded={expanded} onToggle={toggle} />
          )}
          {gad7.length > 0 && (
            <MeasureSection measureType="GAD-7" assessments={gad7} expanded={expanded} onToggle={toggle} />
          )}
        </div>
      </div>
    </div>
  )
}

interface MeasureSectionProps {
  measureType: MeasureType
  assessments: PatientAssessment[]
  expanded: Set<string>
  onToggle: (id: string) => void
}

function MeasureSection({ measureType, assessments, expanded, onToggle }: MeasureSectionProps) {
  const max = maxScore(measureType)
  const bands = bandsFor(measureType)
  const chartData = assessments.map(a => ({
    date: a.date,
    label: fmtDate(a.date),
    score: a.totalScore,
    severity: a.severity,
  }))

  const first = assessments[0]
  const last = assessments[assessments.length - 1]
  const change = last.totalScore - first.totalScore

  return (
    <section>
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-lg font-semibold text-[#091747]">{measureType}</h3>
        <div className="text-sm text-slate-500">
          <span className="font-mono">{first.totalScore}</span>
          <span className="mx-1.5 text-slate-300">→</span>
          <span className="font-mono">{last.totalScore}</span>
          {assessments.length >= 2 && (
            <span className={`ml-2 font-mono ${change < 0 ? 'text-green-600' : change > 0 ? 'text-red-600' : 'text-slate-500'}`}>
              ({change > 0 ? '+' : ''}{change})
            </span>
          )}
          <span className="ml-3 text-xs text-slate-400">{assessments.length} assessment{assessments.length === 1 ? '' : 's'}</span>
        </div>
      </div>

      {/* Chart with severity bands */}
      <div className="bg-white border border-stone-200 rounded p-3 mb-4" style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            {bands.map(b => (
              <ReferenceArea
                key={b.level}
                y1={b.from}
                y2={b.to}
                fill={severityColor(b.level)}
                fillOpacity={0.08}
                ifOverflow="extendDomain"
              />
            ))}
            <ReferenceLine y={5} stroke="#94a3b8" strokeDasharray="2 2" label={{ value: 'Remission', position: 'right', fontSize: 10, fill: '#64748b' }} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
            <YAxis domain={[0, max]} tick={{ fontSize: 11, fill: '#64748b' }} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 6 }}
              formatter={(value, _name, item) => {
                const severity = (item?.payload as { severity?: SeverityLevel } | undefined)?.severity
                return [`${value}${severity ? ` (${severityLabel(severity)})` : ''}`, measureType]
              }}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke="#091747"
              strokeWidth={2}
              dot={{ r: 4, fill: '#091747' }}
              activeDot={{ r: 6 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* History table */}
      <div className="border border-stone-200 rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
            <tr>
              <th className="px-3 py-2 text-left w-8"></th>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-right">Score</th>
              <th className="px-3 py-2 text-left">Severity</th>
              <th className="px-3 py-2 text-left">Practitioner</th>
            </tr>
          </thead>
          <tbody>
            {assessments.map(a => {
              const isOpen = expanded.has(a.id)
              const hasQuestions = !!a.questionResponses && a.questionResponses.length > 0
              return (
                <Fragment key={a.id}>
                  <tr className="border-t border-stone-200">
                    <td className="px-3 py-2">
                      {hasQuestions ? (
                        <button
                          onClick={() => onToggle(a.id)}
                          className="p-0.5 text-slate-400 hover:text-slate-700"
                          aria-label={isOpen ? 'Hide responses' : 'Show responses'}
                        >
                          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 font-medium text-[#091747]">{fmtDate(a.date)}</td>
                    <td className="px-3 py-2 text-right font-mono">{a.totalScore}</td>
                    <td className="px-3 py-2">
                      <span className="text-xs" style={{ color: severityColor(a.severity) }}>
                        {severityLabel(a.severity)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-500">{a.practitioner || '—'}</td>
                  </tr>
                  {isOpen && hasQuestions && (
                    <tr className="bg-slate-50">
                      <td></td>
                      <td colSpan={4} className="px-3 py-3">
                        <ol className="space-y-1.5 text-xs">
                          {a.questionResponses!
                            .slice()
                            .sort((x, y) => x.questionNumber - y.questionNumber)
                            .map(q => (
                              <li key={q.questionNumber} className="flex items-start gap-3">
                                <span className="text-slate-400 font-mono w-5 flex-shrink-0 text-right">{q.questionNumber}.</span>
                                <span className="flex-1 text-slate-700">{questionText(measureType, q.questionNumber)}</span>
                                <span className="text-slate-500 italic w-44 flex-shrink-0">{q.responseText}</span>
                                <span className="font-mono text-slate-700 w-6 text-right flex-shrink-0">{q.score}</span>
                              </li>
                            ))}
                        </ol>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
