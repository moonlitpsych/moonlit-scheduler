'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Loader2, RefreshCw, Users, Filter, Zap, AlertTriangle, UserPlus } from 'lucide-react'

interface Relationship {
  id: string
  supervisor_provider_id: string
  supervisor_name: string
  supervisee_provider_id: string
  supervisee_name: string
  payer_id: string
  payer_name: string
  start_date: string | null
  end_date: string | null
  is_active: boolean
  supervision_level: string | null
}

interface ProviderLite { id: string; name: string; provider_type: string | null; role: string | null; is_active: boolean }
interface PayerLite { id: string; name: string; allows_supervised: boolean }

const todayStr = () => new Date().toISOString().split('T')[0]

// A row is "active" only if not deactivated and not past its end date.
function rowStatus(r: Relationship): { key: 'ongoing' | 'ending' | 'ended'; label: string; cls: string } {
  const t = todayStr()
  if (!r.is_active) return { key: 'ended', label: r.end_date ? `Ended ${r.end_date}` : 'Inactive', cls: 'bg-gray-100 text-gray-600' }
  if (r.end_date && r.end_date < t) return { key: 'ended', label: `Ended ${r.end_date}`, cls: 'bg-gray-100 text-gray-600' }
  if (r.end_date) return { key: 'ending', label: `Ends ${r.end_date}`, cls: 'bg-amber-100 text-amber-800' }
  return { key: 'ongoing', label: 'Ongoing', cls: 'bg-green-100 text-green-800' }
}

export default function SupervisionManagementTab() {
  const [relationships, setRelationships] = useState<Relationship[]>([])
  const [providers, setProviders] = useState<ProviderLite[]>([])
  const [payers, setPayers] = useState<PayerLite[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)

  // Filters
  const [fSupervisor, setFSupervisor] = useState('')
  const [fSupervisee, setFSupervisee] = useState('')
  const [fPayer, setFPayer] = useState('')
  const [fStatus, setFStatus] = useState<'all' | 'active' | 'ended'>('active')

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Bulk-bar inputs
  const [bulkEndDate, setBulkEndDate] = useState('')
  const [reassignTo, setReassignTo] = useState('')
  const [reassignStart, setReassignStart] = useState('')

  // Phase-out macro inputs
  const [macroSupervisor, setMacroSupervisor] = useState('')
  const [macroPayer, setMacroPayer] = useState('') // '' = all payers
  const [macroEndDate, setMacroEndDate] = useState('')

  // Phase-in (bulk add) inputs
  const [piPayer, setPiPayer] = useState('')
  const [piSupervisor, setPiSupervisor] = useState('')
  const [piSupervisees, setPiSupervisees] = useState<Set<string>>(new Set())
  const [piStart, setPiStart] = useState('')
  const [piEnd, setPiEnd] = useState('')
  const [piCopyFrom, setPiCopyFrom] = useState('')
  const [piEligible, setPiEligible] = useState<Set<string>>(new Set()) // in-network supervisor ids for piPayer
  const [piEligibleLoading, setPiEligibleLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/admin/supervision')
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Failed to load')
      setRelationships(json.relationships || [])
      setProviders(json.providers || [])
      setPayers(json.payers || [])
      setSelected(new Set())
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    return relationships.filter(r => {
      if (fSupervisor && r.supervisor_provider_id !== fSupervisor) return false
      if (fSupervisee && r.supervisee_provider_id !== fSupervisee) return false
      if (fPayer && r.payer_id !== fPayer) return false
      const st = rowStatus(r).key
      if (fStatus === 'active' && st === 'ended') return false
      if (fStatus === 'ended' && st !== 'ended') return false
      return true
    })
  }, [relationships, fSupervisor, fSupervisee, fPayer, fStatus])

  // Distinct supervisors / supervisees for filter dropdowns
  const supervisors = useMemo(() => {
    const m = new Map<string, string>()
    relationships.forEach(r => m.set(r.supervisor_provider_id, r.supervisor_name))
    return [...m.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [relationships])
  const supervisees = useMemo(() => {
    const m = new Map<string, string>()
    relationships.forEach(r => m.set(r.supervisee_provider_id, r.supervisee_name))
    return [...m.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [relationships])

  const activeProviders = useMemo(
    () => providers.filter(p => p.is_active).sort((a, b) => a.name.localeCompare(b.name)),
    [providers]
  )

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  const allFilteredSelected = filtered.length > 0 && filtered.every(r => selected.has(r.id))
  const toggleAll = () => {
    setSelected(prev => {
      if (allFilteredSelected) {
        const next = new Set(prev); filtered.forEach(r => next.delete(r.id)); return next
      }
      const next = new Set(prev); filtered.forEach(r => next.add(r.id)); return next
    })
  }

  const runBulk = async (payload: any, successMsg: (n: number) => string) => {
    setBusy(true); setFlash(null)
    try {
      const res = await fetch('/api/admin/supervision', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Action failed')
      setFlash(successMsg(json.affected ?? 0))
      await load()
    } catch (e: any) {
      setFlash(`Error: ${e.message}`)
    } finally {
      setBusy(false)
    }
  }

  const selectedIds = [...selected]

  // Macro preview (client-side, mirrors the server filter)
  const macroPreview = useMemo(() => {
    if (!macroSupervisor) return []
    return relationships.filter(r =>
      r.supervisor_provider_id === macroSupervisor &&
      (!macroPayer || r.payer_id === macroPayer) &&
      r.is_active && rowStatus(r).key !== 'ended'
    )
  }, [relationships, macroSupervisor, macroPayer])

  // Phase-in: when the payer changes, fetch who is in-network for it (eligible supervisors).
  useEffect(() => {
    setPiSupervisor(''); setPiEligible(new Set())
    if (!piPayer) return
    setPiEligibleLoading(true)
    fetch(`/api/admin/payers/${piPayer}/contracts`, { credentials: 'include' })
      .then(r => r.json())
      .then(j => {
        const ids = new Set<string>((j.data || []).filter((c: any) => c.status === 'in_network').map((c: any) => c.provider_id))
        setPiEligible(ids)
      })
      .catch(() => setPiEligible(new Set()))
      .finally(() => setPiEligibleLoading(false))
  }, [piPayer])

  const piSupervisorOptions = useMemo(
    () => activeProviders.filter(p => piEligible.has(p.id)),
    [activeProviders, piEligible]
  )
  const piSuperviseeOptions = useMemo(
    () => activeProviders.filter(p => p.id !== piSupervisor),
    [activeProviders, piSupervisor]
  )
  // Supervisors who currently have rows for the chosen payer — source for "copy supervisees from".
  const piCopyFromOptions = useMemo(() => {
    const m = new Map<string, string>()
    relationships.filter(r => r.payer_id === piPayer).forEach(r => m.set(r.supervisor_provider_id, r.supervisor_name))
    return [...m.entries()].map(([id, name]) => ({ id, name }))
  }, [relationships, piPayer])

  const applyCopyFrom = (supId: string) => {
    setPiCopyFrom(supId)
    if (!supId) return
    const sees = relationships
      .filter(r => r.payer_id === piPayer && r.supervisor_provider_id === supId)
      .map(r => r.supervisee_provider_id)
      .filter(id => id !== piSupervisor)
    setPiSupervisees(new Set(sees))
  }
  const togglePiSupervisee = (id: string) => {
    setPiSupervisees(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const doPhaseIn = async () => {
    await runBulk(
      {
        action: 'create',
        params: {
          supervisor_provider_id: piSupervisor,
          payer_id: piPayer,
          supervisee_ids: [...piSupervisees],
          start_date: piStart,
          end_date: piEnd || undefined,
        },
        auditNote: `Phase-in: ${piSupervisees.size} supervisee(s) under new supervisor for payer, from ${piStart}`,
      },
      n => `Added ${n} relationship(s).`
    )
    setPiSupervisees(new Set()); setPiCopyFrom('')
  }

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[#BF9C73]" /></div>
  }
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
        <div><p className="text-sm text-red-700">{error}</p>
          <button onClick={load} className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm">Retry</button></div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {flash && (
        <div className={`px-4 py-2 rounded-lg text-sm ${flash.startsWith('Error') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-800 border border-green-200'}`}>
          {flash}
        </div>
      )}

      {/* Phase-out macro */}
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-[#BF9C73]" />
          <h3 className="font-semibold text-[#091747]">Phase out a supervisor</h3>
        </div>
        <p className="text-xs text-stone-500 mb-3">
          End-date every active relationship where the chosen supervisor supervises — for one payer or across all payers.
          Non-destructive (rows are kept, just end-dated). Supervision is keyed by payer + supervisor + supervisee.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold text-stone-500 mb-1">Supervisor</label>
            <select value={macroSupervisor} onChange={e => setMacroSupervisor(e.target.value)}
              className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm">
              <option value="">— select —</option>
              {supervisors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-500 mb-1">Payer</label>
            <select value={macroPayer} onChange={e => setMacroPayer(e.target.value)}
              className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm">
              <option value="">All payers</option>
              {payers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-500 mb-1">End date</label>
            <input type="date" value={macroEndDate} onChange={e => setMacroEndDate(e.target.value)}
              className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm" />
          </div>
          <button
            disabled={!macroSupervisor || !macroEndDate || macroPreview.length === 0 || busy}
            onClick={() => runBulk(
              { action: 'end_date', filter: { supervisor_provider_id: macroSupervisor, payer_id: macroPayer || undefined, only_active: true }, params: { end_date: macroEndDate }, auditNote: `Phase-out macro: end ${macroPreview.length} rows on ${macroEndDate}` },
              n => `Phased out ${n} relationship(s), end-dated ${macroEndDate}.`
            )}
            className="px-3 py-2 text-sm bg-[#091747] text-white rounded-lg disabled:opacity-40">
            {macroSupervisor && macroEndDate ? `End-date ${macroPreview.length} row(s)` : 'End-date'}
          </button>
        </div>
        {macroSupervisor && (
          <p className="text-xs text-stone-500 mt-2">
            {macroPreview.length} active relationship(s) match{macroPreview.length === 1 ? 'es' : ''}
            {macroPayer ? ` for ${payers.find(p => p.id === macroPayer)?.name}` : ' across all payers'}.
          </p>
        )}
      </div>

      {/* Phase-in (bulk add) macro */}
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <UserPlus className="w-4 h-4 text-[#BF9C73]" />
          <h3 className="font-semibold text-[#091747]">Add a supervisor (phase-in)</h3>
        </div>
        <p className="text-xs text-stone-500 mb-3">
          Create supervision rows for a supervisor across many supervisees at once for one payer. The supervisor list is
          restricted to providers in-network for the chosen payer (the only ones eligible to supervise it).
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <div>
            <label className="block text-xs font-semibold text-stone-500 mb-1">Payer</label>
            <select value={piPayer} onChange={e => setPiPayer(e.target.value)}
              className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm">
              <option value="">— select payer —</option>
              {payers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-500 mb-1">Supervisor (in-network only)</label>
            <select value={piSupervisor} onChange={e => setPiSupervisor(e.target.value)} disabled={!piPayer || piEligibleLoading}
              className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm disabled:bg-stone-50">
              <option value="">{!piPayer ? 'select a payer first' : piEligibleLoading ? 'loading…' : piSupervisorOptions.length ? '— select supervisor —' : 'no in-network providers'}</option>
              {piSupervisorOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-500 mb-1">Copy supervisees from (optional)</label>
            <select value={piCopyFrom} onChange={e => applyCopyFrom(e.target.value)} disabled={!piPayer}
              className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm disabled:bg-stone-50">
              <option value="">— none —</option>
              {piCopyFromOptions.map(s => <option key={s.id} value={s.id}>{s.name}'s supervisees</option>)}
            </select>
          </div>
        </div>

        {piSupervisor && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1">Start date</label>
                <input type="date" value={piStart} onChange={e => setPiStart(e.target.value)}
                  className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1">End date (optional)</label>
                <input type="date" value={piEnd} onChange={e => setPiEnd(e.target.value)}
                  className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm" />
              </div>
            </div>
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-stone-500">Supervisees ({piSupervisees.size} selected)</label>
                <button onClick={() => setPiSupervisees(new Set())} className="text-xs text-stone-500 underline">Clear</button>
              </div>
              <div className="max-h-40 overflow-y-auto border border-stone-200 rounded p-2 grid grid-cols-2 gap-1">
                {piSuperviseeOptions.map(p => (
                  <label key={p.id} className="flex items-center gap-2 text-sm px-1 py-0.5 hover:bg-stone-50 rounded cursor-pointer">
                    <input type="checkbox" checked={piSupervisees.has(p.id)} onChange={() => togglePiSupervisee(p.id)} />
                    <span className="text-[#091747]">{p.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-end">
              <button
                disabled={!piSupervisor || piSupervisees.size === 0 || !piStart || busy}
                onClick={doPhaseIn}
                className="px-3 py-2 text-sm bg-[#091747] text-white rounded-lg disabled:opacity-40">
                Add {piSupervisees.size || ''} relationship{piSupervisees.size === 1 ? '' : 's'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-[#BF9C73]" />
          <h3 className="font-semibold text-[#091747]">Relationships</h3>
          <span className="text-xs text-stone-500">({filtered.length} of {relationships.length})</span>
          <button onClick={load} disabled={loading} className="ml-auto flex items-center gap-1.5 px-2.5 py-1 text-xs border border-stone-300 rounded hover:bg-stone-50">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <select value={fSupervisor} onChange={e => setFSupervisor(e.target.value)} className="border border-stone-300 rounded px-2 py-1.5 text-sm">
            <option value="">All supervisors</option>
            {supervisors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={fSupervisee} onChange={e => setFSupervisee(e.target.value)} className="border border-stone-300 rounded px-2 py-1.5 text-sm">
            <option value="">All supervisees</option>
            {supervisees.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={fPayer} onChange={e => setFPayer(e.target.value)} className="border border-stone-300 rounded px-2 py-1.5 text-sm">
            <option value="">All payers</option>
            {payers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={fStatus} onChange={e => setFStatus(e.target.value as any)} className="border border-stone-300 rounded px-2 py-1.5 text-sm">
            <option value="active">Active only</option>
            <option value="ended">Ended only</option>
            <option value="all">All statuses</option>
          </select>
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="bg-[#091747] text-white rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{selected.size} selected</span>
            <button onClick={() => setSelected(new Set())} className="text-xs underline opacity-80">Clear</button>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-[11px] uppercase tracking-wide opacity-70 mb-1">End date</label>
              <div className="flex gap-1">
                <input type="date" value={bulkEndDate} onChange={e => setBulkEndDate(e.target.value)}
                  className="border border-white/30 bg-white/10 rounded px-2 py-1 text-sm" />
                <button disabled={!bulkEndDate || busy}
                  onClick={() => runBulk({ action: 'end_date', ids: selectedIds, params: { end_date: bulkEndDate }, auditNote: `Set end date ${bulkEndDate} on ${selectedIds.length} rows` }, n => `End-dated ${n} row(s).`)}
                  className="px-2.5 py-1 text-sm bg-[#BF9C73] rounded disabled:opacity-40">Apply</button>
              </div>
            </div>
            <button disabled={busy}
              onClick={() => runBulk({ action: 'deactivate', ids: selectedIds, auditNote: `Deactivate ${selectedIds.length} rows` }, n => `Deactivated ${n} row(s).`)}
              className="px-3 py-1.5 text-sm bg-white/10 border border-white/30 rounded">Deactivate (end now)</button>
            <button disabled={busy}
              onClick={() => runBulk({ action: 'reactivate', ids: selectedIds, auditNote: `Reactivate ${selectedIds.length} rows` }, n => `Reactivated ${n} row(s).`)}
              className="px-3 py-1.5 text-sm bg-white/10 border border-white/30 rounded">Reactivate</button>
            <div className="flex items-end gap-1">
              <div>
                <label className="block text-[11px] uppercase tracking-wide opacity-70 mb-1">Reassign supervisor</label>
                <select value={reassignTo} onChange={e => setReassignTo(e.target.value)}
                  className="border border-white/30 bg-white/10 rounded px-2 py-1 text-sm">
                  <option value="" className="text-black">— supervisor —</option>
                  {activeProviders.map(p => <option key={p.id} value={p.id} className="text-black">{p.name}</option>)}
                </select>
              </div>
              <input type="date" value={reassignStart} onChange={e => setReassignStart(e.target.value)}
                title="Optional new start date" className="border border-white/30 bg-white/10 rounded px-2 py-1 text-sm" />
              <button disabled={!reassignTo || busy}
                onClick={() => runBulk({ action: 'reassign', ids: selectedIds, params: { supervisor_provider_id: reassignTo, start_date: reassignStart || undefined }, auditNote: `Reassign ${selectedIds.length} rows` }, n => `Reassigned ${n} row(s).`)}
                className="px-2.5 py-1 text-sm bg-[#BF9C73] rounded disabled:opacity-40">Reassign</button>
            </div>
          </div>
          <p className="text-[11px] opacity-70">
            A new supervisor only enables bookings for payers they hold an effective in-network contract for — the booking engine enforces that.
          </p>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 border-b border-stone-200">
            <tr>
              <th className="px-4 py-2 w-8"><input type="checkbox" checked={allFilteredSelected} onChange={toggleAll} /></th>
              <th className="px-4 py-2 text-left font-medium text-[#091747]">Supervisee</th>
              <th className="px-4 py-2 text-left font-medium text-[#091747]">Supervisor</th>
              <th className="px-4 py-2 text-left font-medium text-[#091747]">Payer</th>
              <th className="px-4 py-2 text-left font-medium text-[#091747]">Start</th>
              <th className="px-4 py-2 text-left font-medium text-[#091747]">End</th>
              <th className="px-4 py-2 text-left font-medium text-[#091747]">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-stone-500">No relationships match these filters.</td></tr>
            ) : filtered.map(r => {
              const st = rowStatus(r)
              return (
                <tr key={r.id} className={`hover:bg-stone-50 ${selected.has(r.id) ? 'bg-[#BF9C73]/5' : ''}`}>
                  <td className="px-4 py-2"><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} /></td>
                  <td className="px-4 py-2 font-medium text-[#091747]">{r.supervisee_name}</td>
                  <td className="px-4 py-2 text-[#091747]">{r.supervisor_name}</td>
                  <td className="px-4 py-2 text-stone-600">{r.payer_name}</td>
                  <td className="px-4 py-2 text-stone-600">{r.start_date || '—'}</td>
                  <td className="px-4 py-2 text-stone-600">{r.end_date || <span className="text-stone-400">ongoing</span>}</td>
                  <td className="px-4 py-2"><span className={`px-2 py-0.5 text-xs rounded-full ${st.cls}`}>{st.label}</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
