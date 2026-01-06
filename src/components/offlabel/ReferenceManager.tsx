'use client'

import { useState } from 'react'
import { Plus, Trash2, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
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
          <button
            type="button"
            onClick={addReference}
            className="flex items-center space-x-1 text-sm text-[#BF9C73] hover:text-[#A8865F] transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Add Reference</span>
          </button>
        )}
      </div>

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
