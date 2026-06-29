'use client'

import { useState, useEffect } from 'react'
import { Users, UserCheck, AlertCircle, Plus, X, Calendar } from 'lucide-react'

interface Provider {
  id: string
  first_name: string
  last_name: string
  role: string
  provider_type: string | null
  is_active: boolean
}

interface SupervisionMapping {
  id?: string                 // existing relationship id; absent = new/unsaved row
  resident_id: string         // supervisee
  resident_name: string
  attending_id: string        // supervisor
  attending_name: string
  supervision_type: string
  start_date: string
  end_date?: string | null    // null/'' = ongoing
  is_active?: boolean         // false = ended/retired
}

interface SupervisionSetupPanelProps {
  payerId: string
  effectiveDate: string | null
  allowsSupervised: boolean
  supervisionLevel: string | null
  onSupervisionChange: (mappings: SupervisionMapping[]) => void
  // Controlled value: the parent owns the list and preloads existing relationships.
  existingSupervision?: SupervisionMapping[]
}

const isTestAccount = (p: Provider) =>
  (p.first_name === 'Miriam' && p.last_name === 'Admin') ||
  (p.first_name === 'Test' && p.last_name === 'Practitioner')

const today = () => new Date().toISOString().split('T')[0]

export default function SupervisionSetupPanel({
  payerId,
  effectiveDate,
  allowsSupervised,
  supervisionLevel,
  onSupervisionChange,
  existingSupervision = []
}: SupervisionSetupPanelProps) {
  const [providers, setProviders] = useState<Provider[]>([])
  // Provider ids holding a direct in-network contract for THIS payer — the only
  // providers eligible to SUPERVISE under it (billing independence is a contract,
  // not a provider type; mirrors v_bookable_provider_payer). Date is intentionally
  // not filtered here: a future-dated in-network contract still makes someone an
  // eligible supervisor, and the bookability engine enforces the supervisor's
  // contract dates at booking time.
  const [eligibleSupervisorIds, setEligibleSupervisorIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  // Draft for the "add relationship" form
  const [draftSupervisee, setDraftSupervisee] = useState('')
  const [draftSupervisor, setDraftSupervisor] = useState('')
  const [draftStart, setDraftStart] = useState('')
  const [draftEnd, setDraftEnd] = useState('')

  // Controlled value + mutators — the parent is the single source of truth.
  const value = existingSupervision
  const updateRow = (index: number, patch: Partial<SupervisionMapping>) =>
    onSupervisionChange(value.map((m, i) => (i === index ? { ...m, ...patch } : m)))
  // For a SAVED row (has id) the ✗ ends it (deactivate + end-date today) — this
  // persists on Apply. Hard delete is intentionally not available in the UI. For an
  // unsaved/new row, the ✗ just removes it from the list.
  const endOrRemove = (index: number) => {
    const m = value[index]
    if (m.id) {
      updateRow(index, { is_active: false, end_date: m.end_date || today() })
    } else {
      onSupervisionChange(value.filter((_, i) => i !== index))
    }
  }

  useEffect(() => {
    fetchData()
  }, [payerId])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [providersRes, contractsRes] = await Promise.all([
        fetch('/api/admin/providers', { credentials: 'include' }),
        payerId && payerId !== 'new'
          ? fetch(`/api/admin/payers/${payerId}/contracts`, { credentials: 'include' })
          : Promise.resolve(null)
      ])

      const provResult = await providersRes.json()
      if (providersRes.ok && provResult.success) {
        setProviders((provResult.data || []).map((p: any) => ({
          id: p.id,
          first_name: p.first_name,
          last_name: p.last_name,
          role: p.role,
          provider_type: p.provider_type || null,
          is_active: p.is_active ?? true
        })))
      }

      const supIds = new Set<string>()
      if (contractsRes?.ok) {
        const contractsResult = await contractsRes.json()
        for (const c of contractsResult.data || []) {
          if (c.status === 'in_network') supIds.add(c.provider_id)
        }
      }
      setEligibleSupervisorIds(supIds)
    } catch (error) {
      console.error('❌ Error loading supervision data:', error)
    } finally {
      setLoading(false)
    }
  }

  const nameOf = (id: string) => {
    const p = providers.find(x => x.id === id)
    return p ? `${p.first_name} ${p.last_name}` : 'Unknown'
  }

  const activeProviders = providers.filter(p => p.is_active && !isTestAccount(p))

  // Eligible supervisors (in-network for this payer). Defensive: always include any
  // supervisor already referenced by a row so the select renders correctly even if
  // their contract isn't returned for some reason.
  const referencedSupervisorIds = new Set(value.map(m => m.attending_id))
  const supervisorOptions = activeProviders.filter(
    p => eligibleSupervisorIds.has(p.id) || referencedSupervisorIds.has(p.id)
  )

  const addRelationship = () => {
    if (!draftSupervisee || !draftSupervisor) return
    onSupervisionChange([
      ...value,
      {
        resident_id: draftSupervisee,
        resident_name: nameOf(draftSupervisee),
        attending_id: draftSupervisor,
        attending_name: nameOf(draftSupervisor),
        supervision_type: 'general',
        start_date: draftStart || effectiveDate || today(),
        end_date: draftEnd || null,
        is_active: true
      }
    ])
    setDraftSupervisee('')
    setDraftSupervisor('')
    setDraftStart('')
    setDraftEnd('')
  }

  const statusLabel = (m: SupervisionMapping) => {
    if (m.is_active === false) return { text: m.end_date ? `Ended ${m.end_date}` : 'Ended', cls: 'bg-gray-100 text-gray-600' }
    if (m.end_date) return { text: `Ends ${m.end_date}`, cls: 'bg-amber-100 text-amber-800' }
    return { text: 'Ongoing', cls: 'bg-green-100 text-green-800' }
  }

  if (!allowsSupervised) {
    return (
      <div className="bg-gray-50 rounded-lg p-6">
        <div className="flex items-center space-x-3 text-gray-600">
          <AlertCircle className="h-5 w-5" />
          <div>
            <p className="font-medium">Supervision Not Enabled</p>
            <p className="text-sm text-gray-500 mt-1">
              Enable "Allows Supervised Care" in the Basic Info tab to configure supervision relationships.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          <Users className="h-5 w-5 text-[#BF9C73]" />
          <div>
            <h3 className="font-semibold text-[#091747]">Supervision Relationships</h3>
            <p className="text-sm text-gray-600">
              Who bills under a supervising provider for this payer, and for what date range.
            </p>
          </div>
        </div>
        {supervisionLevel && (
          <span className="px-3 py-1 bg-blue-50 text-blue-800 text-sm rounded-lg whitespace-nowrap">
            Level: {supervisionLevel.replace(/_/g, ' ')}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#BF9C73]" />
        </div>
      ) : (
        <>
          {/* Current relationships */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-700">Current relationships ({value.length})</h4>
              <span className="text-xs text-gray-500">End-date a row to phase a supervisor out — history is preserved.</span>
            </div>

            {value.length === 0 ? (
              <div className="text-center py-6 text-sm text-gray-500 border border-dashed border-gray-300 rounded-lg">
                No supervision relationships for this payer yet. Add one below.
              </div>
            ) : (
              <div className="space-y-2">
                {value.map((m, index) => {
                  const status = statusLabel(m)
                  return (
                    <div
                      key={m.id || `new-${index}`}
                      className={`p-3 rounded-lg border ${m.is_active === false ? 'border-gray-200 bg-gray-50' : 'border-gray-200 bg-white'}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <UserCheck className="h-4 w-4 text-blue-600" />
                          <span className="font-medium text-[#091747]">{m.resident_name || nameOf(m.resident_id)}</span>
                          {!m.id && (
                            <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full">New</span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-0.5 text-xs rounded-full ${status.cls}`}>{status.text}</span>
                          <button
                            onClick={() => endOrRemove(index)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded-full"
                            title={m.id ? 'End this relationship (deactivate + end-date today). Saved on Apply.' : 'Remove this unsaved row'}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div className="md:col-span-2">
                          <label className="block text-xs font-medium text-gray-600 mb-1">Supervised by</label>
                          <select
                            value={m.attending_id}
                            onChange={(e) => updateRow(index, { attending_id: e.target.value, attending_name: nameOf(e.target.value) })}
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20 focus:border-[#BF9C73]"
                          >
                            <option value="">Select supervisor…</option>
                            {supervisorOptions.map(p => (
                              <option key={p.id} value={p.id}>Dr. {p.first_name} {p.last_name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Start</label>
                          <input
                            type="date"
                            value={m.start_date || ''}
                            onChange={(e) => updateRow(index, { start_date: e.target.value })}
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20 focus:border-[#BF9C73]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">End (blank = ongoing)</label>
                          <div className="flex items-center space-x-1">
                            <input
                              type="date"
                              value={m.end_date || ''}
                              onChange={(e) => updateRow(index, { end_date: e.target.value || null, is_active: e.target.value ? m.is_active : true })}
                              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20 focus:border-[#BF9C73]"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Active toggle (retire without a future date) */}
                      <div className="mt-2 flex items-center justify-end">
                        <label className="flex items-center space-x-2 text-xs text-gray-600">
                          <input
                            type="checkbox"
                            checked={m.is_active !== false}
                            onChange={(e) => updateRow(index, {
                              is_active: e.target.checked,
                              // Retiring without a future end date stamps end_date today.
                              end_date: e.target.checked ? m.end_date : (m.end_date || today())
                            })}
                            className="w-3.5 h-3.5 text-[#BF9C73] border-gray-300 rounded"
                          />
                          <span>Active</span>
                        </label>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Add relationship */}
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h4 className="font-medium text-gray-700 mb-3 flex items-center space-x-2">
              <Plus className="h-4 w-4" />
              <span>Add relationship</span>
            </h4>

            {supervisorOptions.length === 0 && (
              <div className="mb-3 flex items-start space-x-2 text-sm text-amber-700 bg-amber-50 p-2 rounded">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>No eligible supervisors: a supervisor needs a direct in-network contract with this payer. Add their contract in the Provider Contracts tab first.</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Supervisee</label>
                <select
                  value={draftSupervisee}
                  onChange={(e) => setDraftSupervisee(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20 focus:border-[#BF9C73]"
                >
                  <option value="">Select provider…</option>
                  {activeProviders.map(p => (
                    <option key={p.id} value={p.id}>Dr. {p.first_name} {p.last_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Supervised by</label>
                <select
                  value={draftSupervisor}
                  onChange={(e) => setDraftSupervisor(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20 focus:border-[#BF9C73]"
                >
                  <option value="">Select supervisor…</option>
                  {supervisorOptions.map(p => (
                    <option key={p.id} value={p.id}>Dr. {p.first_name} {p.last_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Start</label>
                <input
                  type="date"
                  value={draftStart}
                  onChange={(e) => setDraftStart(e.target.value)}
                  placeholder={effectiveDate || ''}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20 focus:border-[#BF9C73]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">End (optional)</label>
                <input
                  type="date"
                  value={draftEnd}
                  onChange={(e) => setDraftEnd(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20 focus:border-[#BF9C73]"
                />
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-gray-500 flex items-center space-x-1">
                <Calendar className="h-3.5 w-3.5" />
                <span>Defaults to the payer effective date ({effectiveDate || 'today'}) if start is blank.</span>
              </p>
              <button
                onClick={addRelationship}
                disabled={!draftSupervisee || !draftSupervisor}
                className="px-3 py-1.5 text-sm bg-[#BF9C73] text-white rounded-lg hover:bg-[#BF9C73]/90 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Add
              </button>
            </div>
          </div>

          <p className="text-xs text-gray-500">
            Changes are staged here and persisted when you click <strong>Apply Contract</strong>. Ending a relationship
            (setting an end date or unchecking Active) keeps the row for history — it is never hard-deleted.
          </p>
        </>
      )}
    </div>
  )
}
