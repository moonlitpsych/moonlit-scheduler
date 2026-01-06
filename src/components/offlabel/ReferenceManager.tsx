'use client'

import { useState } from 'react'
import { Plus, Trash2, ChevronDown, ChevronUp, ExternalLink, Clipboard, Loader2, Check, X } from 'lucide-react'
import type { OffLabelReference, OffLabelDraftReference } from '@/lib/offlabel/types'

type Reference = Omit<OffLabelReference | OffLabelDraftReference, 'id' | 'post_id' | 'draft_id' | 'created_at'> & {
  id?: string
}

interface ReferenceManagerProps {
  references: Reference[]
  onChange: (references: Reference[]) => void
  readOnly?: boolean
}

export function ReferenceManager({
  references,
  onChange,
  readOnly = false,
}: ReferenceManagerProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)
  const [showPasteModal, setShowPasteModal] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [parseProgress, setParseProgress] = useState<{ current: number; total: number } | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [parseResults, setParseResults] = useState<{ success: number; failed: number } | null>(null)

  const addReference = () => {
    const newRef: Reference = {
      citation_key: '',
      authors: '',
      title: '',
      journal: null,
      year: new Date().getFullYear(),
      doi: null,
      pmid: null,
      url: null,
    }
    onChange([...references, newRef])
    setExpandedIndex(references.length)
  }

  const updateReference = (index: number, field: keyof Reference, value: any) => {
    const updated = [...references]
    updated[index] = { ...updated[index], [field]: value }
    onChange(updated)
  }

  const removeReference = (index: number) => {
    const updated = references.filter((_, i) => i !== index)
    onChange(updated)
    if (expandedIndex === index) {
      setExpandedIndex(null)
    } else if (expandedIndex !== null && expandedIndex > index) {
      setExpandedIndex(expandedIndex - 1)
    }
  }

  const toggleExpand = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index)
  }

  const handleParseCitation = async () => {
    if (!pasteText.trim()) return

    // Split by blank lines to get individual citations
    const citations = pasteText
      .split(/\n\s*\n/)
      .map(c => c.trim())
      .filter(c => c.length > 10) // Filter out empty or too-short entries

    if (citations.length === 0) {
      setParseError('No valid citations found. Separate multiple citations with blank lines.')
      return
    }

    setParsing(true)
    setParseError(null)
    setParseResults(null)
    setParseProgress({ current: 0, total: citations.length })

    const newRefs: Reference[] = []
    let failedCount = 0

    try {
      for (let i = 0; i < citations.length; i++) {
        setParseProgress({ current: i + 1, total: citations.length })

        try {
          const response = await fetch('/api/admin/offlabel/parse-citation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ citation: citations[i] }),
          })

          if (!response.ok) {
            failedCount++
            continue
          }

          const data = await response.json()

          if (data.success && data.reference) {
            newRefs.push({
              citation_key: data.reference.citation_key || '',
              authors: data.reference.authors || '',
              title: data.reference.title || '',
              journal: data.reference.journal || null,
              year: data.reference.year || new Date().getFullYear(),
              doi: data.reference.doi || null,
              pmid: data.reference.pmid || null,
              url: null,
            })
          } else {
            failedCount++
          }
        } catch {
          failedCount++
        }
      }

      // Add all successfully parsed references
      if (newRefs.length > 0) {
        onChange([...references, ...newRefs])
        setExpandedIndex(references.length) // Expand first new reference
      }

      setParseResults({ success: newRefs.length, failed: failedCount })

      // Close modal after showing results (longer delay for multiple)
      setTimeout(() => {
        setShowPasteModal(false)
        setPasteText('')
        setParseResults(null)
        setParseProgress(null)
      }, newRefs.length > 1 ? 2000 : 1000)

    } catch (error: any) {
      setParseError(error.message || 'Failed to parse citations')
    } finally {
      setParsing(false)
    }
  }

  const closePasteModal = () => {
    setShowPasteModal(false)
    setPasteText('')
    setParseError(null)
    setParseResults(null)
    setParseProgress(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-[#091747]">
          References
          <span className="text-[#091747]/50 font-normal ml-2">
            ({references.length} citation{references.length !== 1 ? 's' : ''})
          </span>
        </label>
        {!readOnly && (
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => setShowPasteModal(true)}
              className="flex items-center space-x-1 text-sm text-[#BF9C73] hover:text-[#A8865F] transition-colors"
            >
              <Clipboard className="h-4 w-4" />
              <span>Paste Citation</span>
            </button>
            <button
              type="button"
              onClick={addReference}
              className="flex items-center space-x-1 text-sm text-[#091747]/50 hover:text-[#091747] transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Add Manually</span>
            </button>
          </div>
        )}
      </div>

      {/* Paste Citation Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200">
              <h3 className="text-lg font-semibold text-[#091747]">Paste Citation</h3>
              <button
                onClick={closePasteModal}
                className="p-1 text-[#091747]/50 hover:text-[#091747] transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-[#091747]/70">
                Paste one or more citations. Separate multiple citations with a blank line. We&apos;ll automatically extract metadata and look up DOI/PMID.
              </p>

              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={"e.g., Kerner NA, Roose SP. Obstructive sleep apnea is linked to depression. Am J Geriatr Psychiatry. 2016;24(6):496-508.\n\nMoncrieff J, et al. The serotonin theory of depression. Mol Psychiatry. 2022;27(8):3243-3256."}
                rows={6}
                className="w-full px-4 py-3 border-2 border-stone-200 rounded-lg focus:outline-none focus:border-[#BF9C73] resize-none text-sm"
                autoFocus
                disabled={parsing}
              />

              {parseError && (
                <div className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">
                  {parseError}
                </div>
              )}

              {parseProgress && parsing && (
                <div className="flex items-center space-x-2 text-sm text-[#BF9C73] bg-[#BF9C73]/10 px-4 py-2 rounded-lg">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Parsing citation {parseProgress.current} of {parseProgress.total}...</span>
                </div>
              )}

              {parseResults && (
                <div className={`flex items-center space-x-2 text-sm px-4 py-2 rounded-lg ${
                  parseResults.failed === 0
                    ? 'text-green-600 bg-green-50'
                    : parseResults.success > 0
                      ? 'text-amber-600 bg-amber-50'
                      : 'text-red-600 bg-red-50'
                }`}>
                  <Check className="h-4 w-4" />
                  <span>
                    {parseResults.success > 0 && `Added ${parseResults.success} citation${parseResults.success !== 1 ? 's' : ''}`}
                    {parseResults.failed > 0 && parseResults.success > 0 && ', '}
                    {parseResults.failed > 0 && `${parseResults.failed} failed to parse`}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end space-x-3 px-6 py-4 border-t border-stone-200 bg-stone-50">
              <button
                onClick={closePasteModal}
                className="px-4 py-2 text-[#091747]/70 hover:text-[#091747] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleParseCitation}
                disabled={parsing || !pasteText.trim() || !!parseResults}
                className="flex items-center space-x-2 px-4 py-2 bg-[#BF9C73] hover:bg-[#A8865F] text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {parsing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Parsing{parseProgress && parseProgress.total > 1 ? ` ${parseProgress.current}/${parseProgress.total}` : ''}...</span>
                  </>
                ) : parseResults ? (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Done!</span>
                  </>
                ) : (
                  <>
                    <Clipboard className="h-4 w-4" />
                    <span>Parse & Add</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {references.length === 0 ? (
        <div className="text-center py-8 bg-stone-50 rounded-lg border-2 border-dashed border-stone-200">
          <p className="text-[#091747]/50 text-sm">
            No references yet.{' '}
            {!readOnly && (
              <button
                onClick={addReference}
                className="text-[#BF9C73] hover:underline"
              >
                Add one
              </button>
            )}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {references.map((ref, index) => (
            <div
              key={index}
              className="border-2 border-stone-200 rounded-lg overflow-hidden"
            >
              {/* Collapsed Header */}
              <div
                className="flex items-center justify-between px-4 py-3 bg-stone-50 cursor-pointer hover:bg-stone-100 transition-colors"
                onClick={() => toggleExpand(index)}
              >
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <span className="text-sm font-medium text-[#091747]/50 w-8">
                    [{index + 1}]
                  </span>
                  <div className="flex-1 min-w-0">
                    {ref.authors && ref.title ? (
                      <p className="text-sm text-[#091747] truncate">
                        <span className="font-medium">{ref.citation_key || ref.authors.split(',')[0]}</span>
                        {' — '}
                        {ref.title}
                      </p>
                    ) : (
                      <p className="text-sm text-[#091747]/50 italic">
                        New reference (click to edit)
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {ref.doi && (
                    <a
                      href={`https://doi.org/${ref.doi}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-1 text-[#BF9C73] hover:text-[#A8865F]"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                  {!readOnly && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        removeReference(index)
                      }}
                      className="p-1 text-red-400 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                  {expandedIndex === index ? (
                    <ChevronUp className="h-4 w-4 text-[#091747]/50" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-[#091747]/50" />
                  )}
                </div>
              </div>

              {/* Expanded Form */}
              {expandedIndex === index && (
                <div className="p-4 space-y-4 bg-white border-t border-stone-200">
                  <div className="grid grid-cols-2 gap-4">
                    {/* Citation Key */}
                    <div>
                      <label className="block text-xs font-medium text-[#091747]/70 mb-1">
                        Citation Key
                      </label>
                      <input
                        type="text"
                        value={ref.citation_key}
                        onChange={(e) => updateReference(index, 'citation_key', e.target.value)}
                        placeholder="hori2025"
                        className="w-full px-3 py-2 text-sm border-2 border-stone-200 rounded-lg focus:outline-none focus:border-[#BF9C73]"
                        disabled={readOnly}
                      />
                    </div>

                    {/* Year */}
                    <div>
                      <label className="block text-xs font-medium text-[#091747]/70 mb-1">
                        Year *
                      </label>
                      <input
                        type="number"
                        value={ref.year}
                        onChange={(e) => updateReference(index, 'year', parseInt(e.target.value) || new Date().getFullYear())}
                        className="w-full px-3 py-2 text-sm border-2 border-stone-200 rounded-lg focus:outline-none focus:border-[#BF9C73]"
                        disabled={readOnly}
                      />
                    </div>
                  </div>

                  {/* Authors */}
                  <div>
                    <label className="block text-xs font-medium text-[#091747]/70 mb-1">
                      Authors *
                    </label>
                    <input
                      type="text"
                      value={ref.authors}
                      onChange={(e) => updateReference(index, 'authors', e.target.value)}
                      placeholder="Hori H, Kunugi H, et al."
                      className="w-full px-3 py-2 text-sm border-2 border-stone-200 rounded-lg focus:outline-none focus:border-[#BF9C73]"
                      disabled={readOnly}
                    />
                  </div>

                  {/* Title */}
                  <div>
                    <label className="block text-xs font-medium text-[#091747]/70 mb-1">
                      Title *
                    </label>
                    <input
                      type="text"
                      value={ref.title}
                      onChange={(e) => updateReference(index, 'title', e.target.value)}
                      placeholder="Efficacy of pramipexole augmentation for treatment-resistant depression"
                      className="w-full px-3 py-2 text-sm border-2 border-stone-200 rounded-lg focus:outline-none focus:border-[#BF9C73]"
                      disabled={readOnly}
                    />
                  </div>

                  {/* Journal */}
                  <div>
                    <label className="block text-xs font-medium text-[#091747]/70 mb-1">
                      Journal
                    </label>
                    <input
                      type="text"
                      value={ref.journal || ''}
                      onChange={(e) => updateReference(index, 'journal', e.target.value || null)}
                      placeholder="Lancet Psychiatry"
                      className="w-full px-3 py-2 text-sm border-2 border-stone-200 rounded-lg focus:outline-none focus:border-[#BF9C73]"
                      disabled={readOnly}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* DOI */}
                    <div>
                      <label className="block text-xs font-medium text-[#091747]/70 mb-1">
                        DOI
                      </label>
                      <input
                        type="text"
                        value={ref.doi || ''}
                        onChange={(e) => updateReference(index, 'doi', e.target.value || null)}
                        placeholder="10.1016/S2215-0366(25)00XXX-X"
                        className="w-full px-3 py-2 text-sm border-2 border-stone-200 rounded-lg focus:outline-none focus:border-[#BF9C73]"
                        disabled={readOnly}
                      />
                    </div>

                    {/* PMID */}
                    <div>
                      <label className="block text-xs font-medium text-[#091747]/70 mb-1">
                        PMID
                      </label>
                      <input
                        type="text"
                        value={ref.pmid || ''}
                        onChange={(e) => updateReference(index, 'pmid', e.target.value || null)}
                        placeholder="12345678"
                        className="w-full px-3 py-2 text-sm border-2 border-stone-200 rounded-lg focus:outline-none focus:border-[#BF9C73]"
                        disabled={readOnly}
                      />
                    </div>
                  </div>

                  {/* URL */}
                  <div>
                    <label className="block text-xs font-medium text-[#091747]/70 mb-1">
                      URL (if no DOI)
                    </label>
                    <input
                      type="text"
                      value={ref.url || ''}
                      onChange={(e) => updateReference(index, 'url', e.target.value || null)}
                      placeholder="https://..."
                      className="w-full px-3 py-2 text-sm border-2 border-stone-200 rounded-lg focus:outline-none focus:border-[#BF9C73]"
                      disabled={readOnly}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
