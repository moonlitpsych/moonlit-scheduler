'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, AlertTriangle, RefreshCw, Plus, X, GraduationCap, Users } from 'lucide-react'
import {
  ProviderTransitionEnriched,
  TRANSITION_TYPE_LABELS,
  TRANSITION_STATUS_LABELS,
  ProviderTransitionType,
} from '@/types/provider-transitions'

interface SuccessionCandidate {
  id: string
  first_name: string | null
  last_name: string | null
  role: string | null
}

interface ApiResponse {
  success: boolean
  transitions: ProviderTransitionEnriched[]
  succession_candidates: SuccessionCandidate[]
  error?: string
}

type ActionType = 'bridge' | 'promote' | 'defer' | 'cancel' | 'mark_complete'

export default function TransitionsAdminPage() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openModal, setOpenModal] = useState<{ tx: ProviderTransitionEnriched; action: ActionType } | null>(null)
  const [showNewModal, setShowNewModal] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/transitions')
      const json: ApiResponse = await res.json()
      if (!json.success) throw new Error(json.error || 'Failed')
      setData(json)
    } catch (err: any) {
      setError(err.message || 'Failed to load transitions')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#BF9C73]" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-xl">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-800">Error</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
              <button onClick={load} className="mt-3 px-3 py-1.5 bg-red-600 text-white rounded text-sm">Retry</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Group open transitions by month
  const grouped = new Map<string, ProviderTransitionEnriched[]>()
  for (const t of data?.transitions ?? []) {
    const monthKey = t.effective_date.slice(0, 7) // YYYY-MM
    if (!grouped.has(monthKey)) grouped.set(monthKey, [])
    grouped.get(monthKey)!.push(t)
  }

  const formatMonth = (key: string) => {
    const [y, m] = key.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  const providerName = (p: ProviderTransitionEnriched['provider']) =>
    `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unknown'

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#091747] font-['Newsreader']">Provider Transitions</h1>
          <p className="text-sm text-gray-500 mt-1">
            Lifecycle changes (graduations, departures, leaves) — review and act on each.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-stone-300 rounded-lg hover:bg-stone-50 text-sm">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button onClick={() => setShowNewModal(true)}
            className="flex items-center gap-2 px-3 py-2 bg-[#091747] text-white rounded-lg text-sm">
            <Plus className="w-4 h-4" /> New Transition
          </button>
        </div>
      </div>

      {/* Open transitions */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-stone-200 flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-[#BF9C73]" />
          <h2 className="font-semibold text-[#091747]">Open transitions</h2>
          <span className="text-xs text-gray-500">({data?.transitions.length ?? 0})</span>
        </div>

        {(!data?.transitions || data.transitions.length === 0) ? (
          <p className="p-8 text-center text-gray-500 text-sm">No open transitions.</p>
        ) : (
          [...grouped.entries()].map(([monthKey, txs]) => (
            <div key={monthKey}>
              <div className="px-5 py-2 bg-stone-50 border-b border-stone-100 text-xs font-semibold uppercase tracking-wider text-stone-500">
                {formatMonth(monthKey)}
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-stone-100">
                  {txs.map(t => {
                    const days = t.days_until_effective
                    const dayLabel = days >= 0 ? `${days}d out` : `${Math.abs(days)}d OVERDUE`
                    const dayColor = days < 0 ? 'text-red-600' : days <= 30 ? 'text-amber-600' : 'text-stone-500'
                    return (
                      <tr key={t.id} className="hover:bg-stone-50">
                        <td className="px-5 py-3">
                          <div className="font-medium text-[#091747]">{providerName(t.provider)}</div>
                          <div className="text-xs text-gray-500">
                            {TRANSITION_TYPE_LABELS[t.transition_type]} · {TRANSITION_STATUS_LABELS[t.status]}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-xs">
                          <div className="text-[#091747]">{t.effective_date}</div>
                          <div className={dayColor}>{dayLabel}</div>
                        </td>
                        <td className="px-5 py-3 text-xs text-stone-600">
                          <div>{t.active_supervisions.length} active supervisions</div>
                          <div>{t.future_appointment_count} future appts</div>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="inline-flex gap-1.5">
                            {t.transition_type === 'residency_graduation' && (() => {
                              const month = new Date().getMonth() + 1
                              const inWindow = month === 6 || month === 7
                              return (
                                <button
                                  onClick={() => inWindow && setOpenModal({ tx: t, action: 'promote' })}
                                  disabled={!inWindow}
                                  title={inWindow ? '' : 'Promote is only available in June or July'}
                                  className={`px-2.5 py-1 text-xs rounded ${
                                    inWindow
                                      ? 'bg-[#091747] text-white hover:opacity-90'
                                      : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                                  }`}
                                >
                                  Promote
                                </button>
                              )
                            })()}
                            {t.transition_type !== 'residency_graduation' && (
                              <button onClick={() => setOpenModal({ tx: t, action: 'mark_complete' })}
                                className="px-2.5 py-1 text-xs bg-[#091747] text-white rounded hover:opacity-90">
                                Mark complete
                              </button>
                            )}
                            <button onClick={() => setOpenModal({ tx: t, action: 'bridge' })}
                              className="px-2.5 py-1 text-xs bg-amber-100 text-amber-800 rounded hover:bg-amber-200">
                              Bridge
                            </button>
                            <button onClick={() => setOpenModal({ tx: t, action: 'defer' })}
                              className="px-2.5 py-1 text-xs bg-stone-100 text-stone-700 rounded hover:bg-stone-200">
                              Defer
                            </button>
                            <button onClick={() => setOpenModal({ tx: t, action: 'cancel' })}
                              className="px-2.5 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200">
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))
        )}
      </div>

      {/* Succession candidates */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-200 flex items-center gap-2">
          <Users className="w-4 h-4 text-[#BF9C73]" />
          <h2 className="font-semibold text-[#091747]">Supervision succession candidates</h2>
          <span className="text-xs text-gray-500">
            ({data?.succession_candidates.length ?? 0})
          </span>
        </div>
        <p className="px-5 pt-3 text-xs text-gray-500">
          Active attendings without an active supervisee — potential supervisors for next year's residents.
        </p>
        <div className="p-5">
          {(!data?.succession_candidates || data.succession_candidates.length === 0) ? (
            <p className="text-sm text-stone-500">Every attending is currently supervising someone.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {data.succession_candidates.map(p => (
                <span key={p.id} className="px-2.5 py-1 text-xs bg-stone-100 text-stone-700 rounded">
                  {(p.first_name || '') + ' ' + (p.last_name || '')}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {openModal && (
        <ActionModal
          transition={openModal.tx}
          action={openModal.action}
          onClose={() => setOpenModal(null)}
          onSaved={() => { setOpenModal(null); load() }}
        />
      )}

      {showNewModal && (
        <NewTransitionModal
          onClose={() => setShowNewModal(false)}
          onSaved={() => { setShowNewModal(false); load() }}
        />
      )}
    </div>
  )
}

// ---------- Action modal ----------

function ActionModal({
  transition,
  action,
  onClose,
  onSaved,
}: {
  transition: ProviderTransitionEnriched
  action: ActionType
  onClose: () => void
  onSaved: () => void
}) {
  const [bridgeUntil, setBridgeUntil] = useState(transition.effective_date)
  const [newDate, setNewDate] = useState(transition.effective_date)
  const [notes, setNotes] = useState(transition.notes || '')
  const [willContinue, setWillContinue] = useState<string>(
    transition.will_continue_at_moonlit === null ? '' : String(transition.will_continue_at_moonlit)
  )
  const [interestSupervise, setInterestSupervise] = useState<string>(
    transition.interested_in_supervising === null ? '' : String(transition.interested_in_supervising)
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const titles: Record<ActionType, string> = {
    bridge: 'Bridge supervision',
    promote: 'Promote to attending',
    defer: 'Defer transition',
    cancel: 'Cancel transition',
    mark_complete: 'Mark transition complete',
  }

  const submit = async () => {
    setSubmitting(true)
    setError(null)

    const body: any = { action }
    if (action === 'bridge') body.bridge_until = bridgeUntil
    if (action === 'defer') body.new_effective_date = newDate
    if (notes !== (transition.notes || '')) body.notes = notes
    if (action === 'promote') {
      if (willContinue !== '') body.will_continue_at_moonlit = willContinue === 'true'
      if (interestSupervise !== '') body.interested_in_supervising = interestSupervise === 'true'
    }

    try {
      const res = await fetch(`/api/admin/transitions/${transition.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Action failed')
      onSaved()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const providerName = `${transition.provider.first_name || ''} ${transition.provider.last_name || ''}`.trim()

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
          <h3 className="font-semibold text-[#091747]">{titles[action]}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-stone-500" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="text-sm">
            <div className="text-stone-500">Provider</div>
            <div className="font-medium text-[#091747]">{providerName}</div>
          </div>

          {action === 'promote' && (
            <>
              <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-800">
                This will: flip role to <code>psychiatrist</code>, end-date {transition.active_supervisions.length} active
                supervision{transition.active_supervisions.length === 1 ? '' : 's'}, and create one credentialing task per payer
                with a 90-day due date.
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1">Will continue at Moonlit?</label>
                <select value={willContinue} onChange={e => setWillContinue(e.target.value)}
                  className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm">
                  <option value="">— select —</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1">Interested in supervising residents?</label>
                <select value={interestSupervise} onChange={e => setInterestSupervise(e.target.value)}
                  className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm">
                  <option value="">— select —</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
            </>
          )}

          {action === 'bridge' && (
            <div>
              <label className="block text-xs font-semibold text-stone-500 mb-1">Bridge supervision through</label>
              <input type="date" value={bridgeUntil} onChange={e => setBridgeUntil(e.target.value)}
                className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm" />
              <p className="text-xs text-stone-500 mt-1">
                Updates `end_date` on all {transition.active_supervisions.length} active supervisions.
              </p>
            </div>
          )}

          {action === 'defer' && (
            <div>
              <label className="block text-xs font-semibold text-stone-500 mb-1">New effective date</label>
              <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
                className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm" />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-stone-500 mb-1">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm" />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="px-5 py-3 border-t border-stone-200 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-stone-600">Cancel</button>
          <button onClick={submit} disabled={submitting}
            className="px-3 py-1.5 text-sm bg-[#091747] text-white rounded disabled:opacity-50">
            {submitting ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------- New transition modal ----------

function NewTransitionModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [providers, setProviders] = useState<{ id: string; first_name: string; last_name: string }[]>([])
  const [providerId, setProviderId] = useState('')
  const [type, setType] = useState<ProviderTransitionType>('attending_departure')
  const [date, setDate] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/providers-list').then(r => r.json()).then(j => {
      setProviders(j.providers || j.data || [])
    }).catch(() => {})
  }, [])

  const submit = async () => {
    if (!providerId || !type || !date) {
      setError('Provider, type, and effective date are required')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/transitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider_id: providerId, transition_type: type, effective_date: date, notes }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Failed')
      onSaved()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
          <h3 className="font-semibold text-[#091747]">New transition</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-stone-500" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-stone-500 mb-1">Provider</label>
            <select value={providerId} onChange={e => setProviderId(e.target.value)}
              className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm">
              <option value="">— select provider —</option>
              {providers.map(p => (
                <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-500 mb-1">Type</label>
            <select value={type} onChange={e => setType(e.target.value as ProviderTransitionType)}
              className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm">
              {Object.entries(TRANSITION_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-500 mb-1">Effective date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-500 mb-1">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="px-5 py-3 border-t border-stone-200 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-stone-600">Cancel</button>
          <button onClick={submit} disabled={submitting}
            className="px-3 py-1.5 text-sm bg-[#091747] text-white rounded disabled:opacity-50">
            {submitting ? 'Saving…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}
