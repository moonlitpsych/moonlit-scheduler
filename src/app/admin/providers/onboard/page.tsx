/**
 * Provider Onboarding Wizard
 *
 * Upload the "Join Moonlit" intake CSV → review/edit the mapped provider rows
 * and licenses → commit. Each commit creates the provider row, a Supabase auth
 * account (temp password), and provider_licenses rows.
 *
 * Scope: row + auth + licenses only. Payer contracts, supervision, availability
 * and IntakeQ settings remain separate processes.
 */
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Wand2, Upload, Loader2, AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Plus, Trash2, ArrowLeft } from 'lucide-react'

interface License {
  license_type: string | null
  issuing_state: string | null
  license_number: string | null
  license_image_url: string | null
  expiration_date: string | null
  start_date: string | null
}
interface Candidate {
  index: number
  degreeRaw: string
  provider: Record<string, any>
  licenses: License[]
  warnings: string[]
  existing: { byEmail: boolean; byNpi: boolean; providerId?: string; note?: string }
  selected: boolean
  expanded: boolean
}

const PROVIDER_FIELDS: { key: string; label: string; type?: string }[] = [
  { key: 'first_name', label: 'First name' },
  { key: 'last_name', label: 'Last name' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'npi', label: 'NPI' },
  { key: 'title', label: 'Title' },
  { key: 'provider_type', label: 'Provider type' },
  { key: 'role', label: 'Role' },
  { key: 'phone_number', label: 'Phone' },
  { key: 'date_of_birth', label: 'Date of birth' },
  { key: 'location_of_birth', label: 'Birthplace' },
  { key: 'med_school_org', label: 'Medical / grad school' },
  { key: 'med_school_grad_year', label: 'School grad year', type: 'number' },
  { key: 'residency_org', label: 'Residency program' },
  { key: 'residency_grad_year', label: 'Residency grad year', type: 'number' },
  { key: 'utah_id', label: 'UtahID' },
  { key: 'caqh_provider_id', label: 'CAQH ID' },
]

export default function ProviderOnboardWizard() {
  const [step, setStep] = useState<'upload' | 'review' | 'done'>('upload')
  const [csvText, setCsvText] = useState('')
  const [fileName, setFileName] = useState('')
  const [parsing, setParsing] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [result, setResult] = useState<any>(null)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => setCsvText(reader.result as string)
    reader.readAsText(file)
  }

  const parse = async () => {
    setParsing(true); setError(null)
    try {
      const res = await fetch('/api/admin/providers/onboard/parse', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText }),
      })
      const data = await res.json()
      if (!data.success) { setError(data.error || 'Parse failed'); return }
      setCandidates(data.candidates.map((c: any) => ({
        ...c,
        selected: !c.existing.byEmail && !c.existing.byNpi, // default-select only new ones
        expanded: false,
      })))
      setStep('review')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setParsing(false)
    }
  }

  const update = (i: number, fn: (c: Candidate) => Candidate) =>
    setCandidates(prev => prev.map((c, idx) => (idx === i ? fn(c) : c)))

  const setProviderField = (i: number, key: string, value: string) =>
    update(i, c => ({ ...c, provider: { ...c.provider, [key]: value === '' ? null : value } }))

  const setLicenseField = (i: number, li: number, key: keyof License, value: string) =>
    update(i, c => ({ ...c, licenses: c.licenses.map((l, idx) => idx === li ? { ...l, [key]: value === '' ? null : value } : l) }))

  const addLicense = (i: number) =>
    update(i, c => ({ ...c, licenses: [...c.licenses, { license_type: '', issuing_state: '', license_number: '', license_image_url: null, expiration_date: null, start_date: null }] }))

  const removeLicense = (i: number, li: number) =>
    update(i, c => ({ ...c, licenses: c.licenses.filter((_, idx) => idx !== li) }))

  const commit = async () => {
    const selected = candidates.filter(c => c.selected)
    if (selected.length === 0) { setError('Select at least one provider to onboard.'); return }
    setCommitting(true); setError(null)
    try {
      const res = await fetch('/api/admin/providers/onboard/commit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidates: selected.map(c => ({
            provider: {
              ...c.provider,
              med_school_grad_year: c.provider.med_school_grad_year ? parseInt(c.provider.med_school_grad_year) : null,
              residency_grad_year: c.provider.residency_grad_year ? parseInt(c.provider.residency_grad_year) : null,
            },
            licenses: c.licenses,
          })),
        }),
      })
      const data = await res.json()
      if (!data.success) { setError(data.error || 'Commit failed'); return }
      setResult(data)
      setStep('done')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setCommitting(false)
    }
  }

  const selectedCount = candidates.filter(c => c.selected).length

  return (
    <div className="min-h-screen bg-moonlit-cream/30 p-8">
      <div className="max-w-6xl mx-auto">
        <Link href="/admin/providers" className="inline-flex items-center text-sm text-gray-600 hover:text-moonlit-navy mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Provider Management
        </Link>
        <div className="flex items-center gap-3 mb-2">
          <Wand2 className="w-7 h-7 text-moonlit-brown" />
          <h1 className="text-3xl font-bold text-moonlit-navy font-['Newsreader']">Onboard Providers from Form</h1>
        </div>
        <p className="text-gray-600 font-['Newsreader'] font-light mb-6">
          Upload the intake CSV to create provider records, auth accounts, and licenses in one pass.
          Payer contracts, supervision, availability, and IntakeQ are handled separately.
        </p>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* ---------------- STEP 1: UPLOAD ---------------- */}
        {step === 'upload' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <label htmlFor="csv-upload" className="block">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-10 text-center cursor-pointer hover:border-moonlit-brown">
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-700 font-medium">{fileName || 'Choose the intake form CSV'}</p>
                <p className="text-xs text-gray-500 mt-1">Google Forms "Join Moonlit" responses export</p>
              </div>
              <input id="csv-upload" type="file" accept=".csv,text/csv" onChange={handleFile} className="hidden" />
            </label>
            <button
              onClick={parse}
              disabled={!csvText || parsing}
              className="mt-6 inline-flex items-center px-5 py-2.5 rounded-md text-sm font-medium text-white bg-moonlit-brown hover:bg-moonlit-brown/90 disabled:opacity-50"
            >
              {parsing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Parsing…</> : 'Parse & Preview'}
            </button>
          </div>
        )}

        {/* ---------------- STEP 2: REVIEW ---------------- */}
        {step === 'review' && (
          <div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4 px-5 py-3 flex items-center justify-between">
              <p className="text-sm text-gray-700">
                {candidates.length} rows · <span className="font-semibold">{selectedCount} selected</span> for onboarding
              </p>
              <div className="flex gap-2">
                <button onClick={() => setStep('upload')} className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Back</button>
                <button
                  onClick={commit}
                  disabled={committing || selectedCount === 0}
                  className="inline-flex items-center px-4 py-1.5 text-sm font-medium text-white bg-moonlit-brown hover:bg-moonlit-brown/90 rounded-md disabled:opacity-50"
                >
                  {committing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Onboarding…</> : `Onboard ${selectedCount} provider${selectedCount === 1 ? '' : 's'}`}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {candidates.map((c, i) => {
                const exists = c.existing.byEmail || c.existing.byNpi
                return (
                  <div key={i} className={`bg-white rounded-lg shadow-sm border ${exists ? 'border-amber-200' : 'border-gray-200'}`}>
                    <div className="flex items-center gap-3 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={c.selected}
                        onChange={e => update(i, x => ({ ...x, selected: e.target.checked }))}
                        className="w-4 h-4 text-moonlit-brown rounded"
                      />
                      <button onClick={() => update(i, x => ({ ...x, expanded: !x.expanded }))} className="text-gray-400 hover:text-gray-700">
                        {c.expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-moonlit-navy truncate">
                          {c.provider.first_name} {c.provider.last_name}
                          <span className="ml-2 text-xs font-normal text-gray-500">{c.degreeRaw} · {c.provider.provider_type || '—'}</span>
                        </p>
                        <p className="text-xs text-gray-500 truncate">{c.provider.email} · NPI {c.provider.npi || '—'} · {c.licenses.length} license{c.licenses.length === 1 ? '' : 's'}</p>
                      </div>
                      {exists && (
                        <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-800 whitespace-nowrap">Already exists</span>
                      )}
                      {c.warnings.length > 0 && (
                        <span className="inline-flex items-center text-xs text-amber-700"><AlertTriangle className="w-3.5 h-3.5 mr-1" />{c.warnings.length}</span>
                      )}
                    </div>

                    {c.expanded && (
                      <div className="border-t border-gray-100 px-4 py-4 space-y-4">
                        {c.existing.note && (
                          <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">{c.existing.note}</div>
                        )}

                        {/* Provider fields */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {PROVIDER_FIELDS.map(f => (
                            <div key={f.key}>
                              <label className="block text-xs font-medium text-gray-500 mb-0.5">{f.label}</label>
                              <input
                                type={f.type || 'text'}
                                value={c.provider[f.key] ?? ''}
                                onChange={e => setProviderField(i, f.key, e.target.value)}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-moonlit-brown focus:border-moonlit-brown"
                              />
                            </div>
                          ))}
                          <div className="col-span-2 md:col-span-3">
                            <label className="block text-xs font-medium text-gray-500 mb-0.5">Languages (comma-separated)</label>
                            <input
                              type="text"
                              value={Array.isArray(c.provider.languages_spoken) ? c.provider.languages_spoken.join(', ') : ''}
                              onChange={e => update(i, x => ({ ...x, provider: { ...x.provider, languages_spoken: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } }))}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-moonlit-brown focus:border-moonlit-brown"
                            />
                          </div>
                        </div>

                        {/* Licenses */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-semibold text-moonlit-navy">Licenses</h4>
                            <button onClick={() => addLicense(i)} className="inline-flex items-center text-xs text-moonlit-brown hover:underline"><Plus className="w-3 h-3 mr-1" />Add license</button>
                          </div>
                          {c.licenses.length === 0 && <p className="text-xs text-gray-400">No licenses parsed.</p>}
                          <div className="space-y-2">
                            {c.licenses.map((l, li) => (
                              <div key={li} className="grid grid-cols-12 gap-2 items-center">
                                <input placeholder="Type" value={l.license_type ?? ''} onChange={e => setLicenseField(i, li, 'license_type', e.target.value)} className="col-span-3 px-2 py-1 text-sm border border-gray-300 rounded" />
                                <input placeholder="State" value={l.issuing_state ?? ''} onChange={e => setLicenseField(i, li, 'issuing_state', e.target.value)} className="col-span-2 px-2 py-1 text-sm border border-gray-300 rounded" />
                                <input placeholder="Number" value={l.license_number ?? ''} onChange={e => setLicenseField(i, li, 'license_number', e.target.value)} className="col-span-3 px-2 py-1 text-sm border border-gray-300 rounded" />
                                <input type="date" title="Expiration date" value={l.expiration_date ?? ''} onChange={e => setLicenseField(i, li, 'expiration_date', e.target.value)} className="col-span-3 px-2 py-1 text-sm border border-gray-300 rounded" />
                                <button onClick={() => removeLicense(i, li)} className="col-span-1 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Warnings */}
                        {c.warnings.length > 0 && (
                          <ul className="text-xs text-amber-700 list-disc list-inside space-y-0.5 bg-amber-50 border border-amber-100 rounded p-2">
                            {c.warnings.map((w, wi) => <li key={wi}>{w}</li>)}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ---------------- STEP 3: DONE ---------------- */}
        {step === 'done' && result && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
              <h2 className="text-xl font-bold text-moonlit-navy">Onboarding complete</h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              {result.summary.created} created · {result.summary.authCreated} auth accounts · {result.summary.licensesCreated} licenses · {result.summary.failed} failed
            </p>
            <div className="space-y-2">
              {result.results.map((r: any, i: number) => (
                <div key={i} className={`rounded border p-3 ${r.providerId ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                  <p className="font-medium text-sm text-moonlit-navy">{r.name} <span className="font-normal text-gray-500">({r.email})</span></p>
                  {r.providerId ? (
                    <p className="text-xs text-gray-600 mt-1">
                      Provider {r.providerId} · auth {r.authStatus}{r.tempPassword ? ` (temp pw: ${r.tempPassword})` : ''} · {r.licensesCreated} licenses
                      {r.licenseError && <span className="text-red-600"> · license error: {r.licenseError}</span>}
                      {r.errors?.length ? <span className="text-amber-700"> · {r.errors.join('; ')}</span> : null}
                    </p>
                  ) : (
                    <p className="text-xs text-red-700 mt-1">{(r.errors || []).join('; ')}</p>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-6 flex gap-3">
              <Link href="/admin/providers" className="px-4 py-2 text-sm font-medium text-white bg-moonlit-brown hover:bg-moonlit-brown/90 rounded-md">Go to Provider Management</Link>
              <button onClick={() => { setStep('upload'); setCsvText(''); setFileName(''); setCandidates([]); setResult(null) }} className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Onboard more</button>
            </div>
            <p className="text-xs text-gray-500 mt-4">
              Next steps for each new provider: payer contracts, supervision (residents), availability, IntakeQ settings, then flip <code>is_bookable</code> on.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
