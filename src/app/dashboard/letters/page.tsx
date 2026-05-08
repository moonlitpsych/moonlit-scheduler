'use client'

/**
 * Provider dashboard: Letters
 *
 * One-click letter generator. Three steps in one page:
 *   1. Search and select a patient (scoped to this provider's roster)
 *   2. Pick the letter type
 *   3. Edit recipient/diagnosis/body, then Download or Email
 *
 * Mirrors the partner-dashboard medication-report flow (server-rendered PDF).
 */

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Database } from '@/types/database'
import { providerImpersonationManager } from '@/lib/provider-impersonation'
import { formatDiagnosis } from '@/lib/data/psychiatricIcd10'
import {
  FileSignature,
  Search,
  X,
  Plus,
  Download,
  Loader2,
  Check,
} from 'lucide-react'

type LetterType =
  | 'proof_of_care'
  | 'proof_of_care_with_dx'
  | 'coordination_of_care'
  | 'work_leave'

const LETTER_TYPE_OPTIONS: { value: LetterType; title: string; description: string; needsDx: boolean }[] = [
  {
    value: 'proof_of_care',
    title: 'Proof of Care',
    description: 'Confirms the patient is established at Moonlit. No diagnosis included.',
    needsDx: false,
  },
  {
    value: 'proof_of_care_with_dx',
    title: 'Proof of Care + Diagnosis',
    description: 'Same as above, plus the patient’s diagnosis. For legal, FMLA, school, etc.',
    needsDx: true,
  },
  {
    value: 'coordination_of_care',
    title: 'Coordination of Care',
    description: 'Letter to another clinician with diagnosis and a brief clinical summary.',
    needsDx: true,
  },
  {
    value: 'work_leave',
    title: 'Consideration of Work Leave',
    description: 'Confirms condition merits reduced work hours or temporary leave.',
    needsDx: true,
  },
]

interface PatientResult {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  date_of_birth: string | null
  default_diagnosis_codes: string[]
  first_appointment_date: string | null
}

export default function LettersPage() {
  const supabase = useMemo(() => createClientComponentClient<Database>(), [])

  // ---------------- Auth + provider context ----------------
  const [providerId, setProviderId] = useState<string | null>(null)
  const [providerLabel, setProviderLabel] = useState<string>('')
  const [loadingContext, setLoadingContext] = useState(true)

  useEffect(() => {
    ;(async () => {
      try {
        const impersonation = providerImpersonationManager.getImpersonatedProvider()
        if (impersonation?.provider) {
          setProviderId(impersonation.provider.id)
          setProviderLabel(
            `${impersonation.provider.first_name} ${impersonation.provider.last_name}`,
          )
          setLoadingContext(false)
          return
        }

        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) {
          setLoadingContext(false)
          return
        }
        const { data: provider } = await supabase
          .from('providers')
          .select('id, first_name, last_name, title')
          .eq('auth_user_id', user.id)
          .eq('is_active', true)
          .maybeSingle()
        if (provider) {
          setProviderId(provider.id)
          setProviderLabel(`${provider.first_name} ${provider.last_name}`)
        }
      } finally {
        setLoadingContext(false)
      }
    })()
  }, [supabase])

  // ---------------- Step 1: patient search ----------------
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PatientResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState<PatientResult | null>(null)
  const debounceRef = useRef<number | null>(null)

  useEffect(() => {
    if (!providerId) return
    if (selectedPatient) return
    if (query.trim().length < 2) {
      setResults([])
      return
    }
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(async () => {
      setSearching(true)
      try {
        const params = new URLSearchParams({ q: query.trim(), providerId })
        const res = await fetch(`/api/provider-dashboard/patients/search?${params}`)
        const json = await res.json()
        setResults(json?.data || [])
      } finally {
        setSearching(false)
      }
    }, 250)
  }, [query, providerId, selectedPatient])

  // ---------------- Step 2: letter type ----------------
  const [letterType, setLetterType] = useState<LetterType | null>(null)

  // ---------------- Step 3: editor ----------------
  const [recipientName, setRecipientName] = useState('')
  const [recipientOrganization, setRecipientOrganization] = useState('')
  const [diagnosisCodes, setDiagnosisCodes] = useState<string[]>([])
  const [newDx, setNewDx] = useState('')
  const [bodyText, setBodyText] = useState('')
  const [leaveStartDate, setLeaveStartDate] = useState('')
  const [leaveEndDate, setLeaveEndDate] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generatedLetterId, setGeneratedLetterId] = useState<string | null>(null)
  const [generatedSignedUrl, setGeneratedSignedUrl] = useState<string | null>(null)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Track whether we've auto-generated body for the current (patient, type)
  // combo. Reset whenever those change. We only auto-generate ONCE — after
  // that, the provider uses "Refresh from template" if they want to start
  // over from the latest field values.
  const [hasGeneratedBody, setHasGeneratedBody] = useState(false)

  const currentLetterMeta = LETTER_TYPE_OPTIONS.find((o) => o.value === letterType)
  const needsDx = currentLetterMeta?.needsDx ?? false
  const isDxReady = !needsDx || diagnosisCodes.length > 0

  // When the patient or letter type changes: clear the previous body, seed
  // diagnosis chips from patient defaults, and reset the auto-generated flag
  // so the next effect can run.
  useEffect(() => {
    if (!selectedPatient || !letterType) return
    setHasGeneratedBody(false)
    setBodyText('')
    setErrorMsg(null)
    setDiagnosisCodes((prev) =>
      prev.length > 0
        ? prev
        : (selectedPatient.default_diagnosis_codes || []).map(formatDiagnosis),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPatient?.id, letterType])

  // Auto-generate the body once we have everything we need. For letter types
  // that require a diagnosis, this waits until the provider has added at
  // least one chip.
  useEffect(() => {
    if (!selectedPatient || !letterType || !providerId) return
    if (hasGeneratedBody) return
    if (!isDxReady) return
    setPreviewLoading(true)
    setErrorMsg(null)
    ;(async () => {
      try {
        const res = await fetch('/api/provider-dashboard/letters/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patientId: selectedPatient.id,
            providerId,
            letterType,
            diagnosisCodes,
            recipientName: recipientName || undefined,
            recipientOrganization: recipientOrganization || undefined,
            leaveStartDate: leaveStartDate || undefined,
            leaveEndDate: leaveEndDate || undefined,
          }),
        })
        const json = await res.json()
        if (json?.success) {
          setBodyText(json.data.bodyText)
          setHasGeneratedBody(true)
        } else {
          setErrorMsg(json?.error || 'Failed to load preview')
        }
      } finally {
        setPreviewLoading(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPatient?.id, letterType, providerId, isDxReady, hasGeneratedBody])

  const refreshFromTemplate = async () => {
    if (!selectedPatient || !letterType || !providerId) return
    setPreviewLoading(true)
    setErrorMsg(null)
    try {
      const res = await fetch('/api/provider-dashboard/letters/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: selectedPatient.id,
          providerId,
          letterType,
          diagnosisCodes,
          recipientName: recipientName || undefined,
          recipientOrganization: recipientOrganization || undefined,
          leaveStartDate: leaveStartDate || undefined,
          leaveEndDate: leaveEndDate || undefined,
        }),
      })
      const json = await res.json()
      if (json?.success) setBodyText(json.data.bodyText)
      else setErrorMsg(json?.error || 'Failed to refresh preview')
    } finally {
      setPreviewLoading(false)
    }
  }

  const generate = async (): Promise<{ letterId: string; signedUrl: string | null } | null> => {
    if (!selectedPatient || !letterType || !providerId) return null
    setGenerating(true)
    setErrorMsg(null)
    setStatusMsg(null)
    try {
      const res = await fetch('/api/provider-dashboard/letters/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: selectedPatient.id,
          providerId,
          letterType,
          bodyText,
          diagnosisCodes,
          recipientName: recipientName || undefined,
          recipientOrganization: recipientOrganization || undefined,
        }),
      })
      const json = await res.json()
      if (!json?.success) {
        setErrorMsg(json?.error || 'Failed to generate letter')
        return null
      }
      setGeneratedLetterId(json.data.letterId)
      setGeneratedSignedUrl(json.data.signedUrl)
      return { letterId: json.data.letterId as string, signedUrl: json.data.signedUrl as string | null }
    } finally {
      setGenerating(false)
    }
  }

  const handleDownload = async () => {
    let url = generatedSignedUrl
    if (!url) {
      const result = await generate()
      if (!result) return
      url = result.signedUrl
    }
    if (!url) {
      setErrorMsg('Generated letter, but no download URL was returned. Check the storage bucket setup.')
      return
    }
    // Programmatic anchor click: more reliable than window.open() after an
    // `await` (which loses user-gesture context and gets popup-blocked).
    // We *also* show the URL as a clickable link in the success banner as a
    // fallback in case the browser still blocks this.
    const a = document.createElement('a')
    a.href = url
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setStatusMsg('Letter generated. If a new tab did not open, use the link below.')
  }

  const resetFlow = () => {
    setSelectedPatient(null)
    setLetterType(null)
    setBodyText('')
    setRecipientName('')
    setRecipientOrganization('')
    setDiagnosisCodes([])
    setNewDx('')
    setLeaveStartDate('')
    setLeaveEndDate('')
    setGeneratedLetterId(null)
    setGeneratedSignedUrl(null)
    setStatusMsg(null)
    setErrorMsg(null)
    setQuery('')
    setResults([])
  }

  // After we generate a new letter for the same patient/type, invalidate the
  // cached letterId so a follow-up Email actually re-renders the latest body.
  useEffect(() => {
    setGeneratedLetterId(null)
    setGeneratedSignedUrl(null)
  }, [bodyText, recipientName, recipientOrganization, diagnosisCodes, letterType, selectedPatient?.id])

  if (loadingContext) {
    return (
      <div className="p-6">
        <div className="text-stone-500">Loading…</div>
      </div>
    )
  }

  if (!providerId) {
    return (
      <div className="p-6">
        <div className="text-red-600">
          No provider context found for this account. Letters can only be generated by a provider
          (or by an admin viewing a provider).
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#091747] font-['Newsreader'] flex items-center gap-3">
          <FileSignature className="h-8 w-8 text-[#BF9C73]" />
          Patient Letters
        </h1>
        <p className="text-stone-600 mt-2">
          Generate Moonlit-letterhead letters confirming care, diagnosis, or work-leave
          consideration for your patients. Signed by {providerLabel}.
        </p>
      </div>

      {/* Step indicator + reset */}
      {(selectedPatient || letterType) && (
        <div className="flex items-center justify-between mb-6 text-sm">
          <div className="flex items-center gap-2 text-stone-600">
            {selectedPatient ? (
              <span className="px-2 py-1 rounded bg-[#BF9C73]/15 text-[#091747] font-medium">
                {selectedPatient.first_name} {selectedPatient.last_name}
              </span>
            ) : null}
            {currentLetterMeta ? (
              <>
                <span className="text-stone-400">›</span>
                <span className="px-2 py-1 rounded bg-[#BF9C73]/15 text-[#091747] font-medium">
                  {currentLetterMeta.title}
                </span>
              </>
            ) : null}
          </div>
          <button
            onClick={resetFlow}
            className="text-stone-500 hover:text-red-600 underline underline-offset-2"
          >
            Start over
          </button>
        </div>
      )}

      {/* Step 1 — patient search */}
      {!selectedPatient && (
        <section className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
          <h2 className="text-xl font-semibold text-[#091747] font-['Newsreader'] mb-4">
            1. Choose a patient
          </h2>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-5 w-5 text-stone-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by first name, last name, or email…"
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-stone-300 focus:border-[#BF9C73] focus:outline-none focus:ring-1 focus:ring-[#BF9C73] bg-white"
              autoFocus
            />
          </div>
          <div className="mt-4">
            {searching && <div className="text-sm text-stone-500">Searching…</div>}
            {!searching && query.trim().length >= 2 && results.length === 0 && (
              <div className="text-sm text-stone-500">
                No patients in your roster match “{query}”. Letters can only be issued for patients
                you have an appointment with.
              </div>
            )}
            <ul className="divide-y divide-stone-200">
              {results.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => setSelectedPatient(p)}
                    className="w-full text-left py-3 px-2 hover:bg-stone-50 rounded-lg flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium text-[#091747]">
                        {p.first_name} {p.last_name}
                      </div>
                      <div className="text-xs text-stone-500">
                        {p.email}
                        {p.date_of_birth ? ` · DOB ${new Date(p.date_of_birth).toLocaleDateString()}` : ''}
                      </div>
                    </div>
                    {p.first_appointment_date && (
                      <div className="text-xs text-stone-500">
                        Established {new Date(p.first_appointment_date).toLocaleDateString()}
                      </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Step 2 — letter type */}
      {selectedPatient && !letterType && (
        <section className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
          <h2 className="text-xl font-semibold text-[#091747] font-['Newsreader'] mb-4">
            2. Choose the letter type
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {LETTER_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setLetterType(opt.value)}
                className="text-left p-4 rounded-xl border border-stone-200 hover:border-[#BF9C73] hover:shadow-md transition"
              >
                <div className="font-semibold text-[#091747] mb-1">{opt.title}</div>
                <div className="text-sm text-stone-600">{opt.description}</div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Step 3 — editor */}
      {selectedPatient && letterType && (
        <section className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 space-y-6">
          <h2 className="text-xl font-semibold text-[#091747] font-['Newsreader']">
            3. Edit and generate
          </h2>

          {/* Diagnosis chips — shown FIRST when required so the provider knows
              they must add at least one before the body is generated. */}
          {needsDx && (
            <div className="border border-[#BF9C73]/40 bg-[#BF9C73]/5 rounded-xl p-4">
              <label className="block text-sm font-semibold text-[#091747] mb-2">
                Diagnosis <span className="text-red-500">*</span>
                {diagnosisCodes.length === 0 && (
                  <span className="ml-2 font-normal text-stone-600">
                    — required to generate this letter
                  </span>
                )}
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {diagnosisCodes.map((dx, i) => (
                  <span
                    key={`${dx}-${i}`}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white border border-[#BF9C73]/40 text-[#091747] text-sm"
                  >
                    {dx}
                    <button
                      onClick={() => setDiagnosisCodes((prev) => prev.filter((_, idx) => idx !== i))}
                      className="hover:text-red-600"
                      aria-label="Remove"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {diagnosisCodes.length === 0 && (
                  <span className="text-sm text-stone-600">
                    No diagnoses yet. Add the patient’s diagnosis below to continue.
                  </span>
                )}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  const v = formatDiagnosis(newDx)
                  if (!v) return
                  setDiagnosisCodes((prev) => [...prev, v])
                  setNewDx('')
                }}
                className="flex gap-2"
              >
                <input
                  value={newDx}
                  onChange={(e) => setNewDx(e.target.value)}
                  placeholder='Type a code (e.g., "F33.1") or full label — we expand codes automatically'
                  className="flex-1 px-3 py-2 rounded-lg border border-stone-300 focus:border-[#BF9C73] focus:outline-none focus:ring-1 focus:ring-[#BF9C73] bg-white"
                />
                <button
                  type="submit"
                  className="px-3 py-2 rounded-lg bg-[#091747] text-white hover:bg-[#091747]/90 inline-flex items-center gap-1"
                >
                  <Plus className="h-4 w-4" /> Add
                </button>
              </form>
            </div>
          )}

          {/* Recipient + dates row */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Recipient name {letterType === 'coordination_of_care' ? <span className="text-red-500">*</span> : null}
              </label>
              <input
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:border-[#BF9C73] focus:outline-none focus:ring-1 focus:ring-[#BF9C73]"
                placeholder={letterType === 'coordination_of_care' ? 'e.g., Dr. Jane Doe' : 'Optional'}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Recipient organization
              </label>
              <input
                value={recipientOrganization}
                onChange={(e) => setRecipientOrganization(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:border-[#BF9C73] focus:outline-none focus:ring-1 focus:ring-[#BF9C73]"
                placeholder="Optional"
              />
            </div>
            {letterType === 'work_leave' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Leave start</label>
                  <input
                    type="date"
                    value={leaveStartDate}
                    onChange={(e) => setLeaveStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Leave end</label>
                  <input
                    type="date"
                    value={leaveEndDate}
                    onChange={(e) => setLeaveEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300"
                  />
                </div>
              </>
            )}
          </div>

          {/* Body editor — gated on diagnosis when required */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-stone-700">Letter body</label>
              {isDxReady && (
                <button
                  type="button"
                  onClick={refreshFromTemplate}
                  disabled={previewLoading}
                  className="text-sm text-[#091747] underline underline-offset-2 hover:text-[#BF9C73]"
                >
                  {previewLoading ? 'Refreshing…' : 'Refresh from template'}
                </button>
              )}
            </div>
            {!isDxReady ? (
              <div className="rounded-xl border-2 border-dashed border-stone-300 bg-stone-50 px-4 py-10 text-center">
                <div className="text-stone-700 font-medium">
                  Add at least one diagnosis above to generate the letter body.
                </div>
                <div className="text-stone-500 text-sm mt-1">
                  Once you add a diagnosis, the letter will populate automatically and you can edit it before downloading.
                </div>
              </div>
            ) : (
              <>
                <textarea
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  rows={14}
                  className="w-full px-4 py-3 rounded-xl border border-stone-300 focus:border-[#BF9C73] focus:outline-none focus:ring-1 focus:ring-[#BF9C73] font-mono text-sm leading-relaxed"
                  placeholder={previewLoading ? 'Loading…' : ''}
                />
                <p className="text-xs text-stone-500 mt-2">
                  Letterhead, date, recipient, “Re:” line, diagnosis block, and your signature are added
                  automatically. Edit only the body above.
                </p>
              </>
            )}
          </div>

          {/* Status */}
          {errorMsg && (
            <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {errorMsg}
            </div>
          )}
          {statusMsg && (
            <div className="px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm flex items-start gap-2">
              <Check className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div>{statusMsg}</div>
                {generatedSignedUrl && (
                  <a
                    href={generatedSignedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-1 text-green-800 underline underline-offset-2 hover:text-green-900 font-medium"
                  >
                    <Download className="h-3 w-3" />
                    Open / download PDF
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              onClick={handleDownload}
              disabled={generating || !bodyText.trim() || !isDxReady}
              title={!isDxReady ? 'Add at least one diagnosis first' : undefined}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#091747] text-white font-medium hover:bg-[#091747]/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Generate &amp; Download PDF
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
