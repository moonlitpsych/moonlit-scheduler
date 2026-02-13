'use client'

import { useState } from 'react'
import { Download, FileText, Copy, Check, Search, ExternalLink } from 'lucide-react'
import ReferralOrganizationCard from './ReferralOrganizationCard'
import type { ReferralSearchResult, ReferralSearchCriteria } from '@/types/referral-network'

interface ReferralResultsViewProps {
  results: ReferralSearchResult | null
  onGeneratePDF: () => void
  isGeneratingPDF: boolean
  pdfUrl?: string
}

export default function ReferralResultsView({
  results,
  onGeneratePDF,
  isGeneratingPDF,
  pdfUrl
}: ReferralResultsViewProps) {
  const [copied, setCopied] = useState(false)

  // Handle copy summary to clipboard
  const handleCopy = async () => {
    if (!results) return

    const summary = results.organizations.map(org => {
      const lines = [org.name]
      if (org.phone) lines.push(`Phone: ${org.phone}`)
      if (org.fax) lines.push(`Fax: ${org.fax}`)
      if (org.website) lines.push(`Website: ${org.website}`)
      if (org.email) lines.push(`Email: ${org.email}`)
      return lines.join('\n')
    }).join('\n\n---\n\n')

    const header = `Referral Resources for ${results.payer_name}\nCare Types: ${results.care_type_names.join(', ')}\n${results.specialty_tag_names?.length ? `Specialties: ${results.specialty_tag_names.join(', ')}\n` : ''}\n---\n\n`

    try {
      await navigator.clipboard.writeText(header + summary)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  // No results yet
  if (!results) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <div className="p-4 bg-gray-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
          <Search className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-[#091747] mb-2">
          Search for Referral Resources
        </h3>
        <p className="text-gray-500 text-sm">
          Use the form to search for organizations that match your patient&apos;s insurance and care needs.
        </p>
      </div>
    )
  }

  // Empty results
  if (results.organizations.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8">
        {/* Search Summary */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="text-sm">
            <p className="font-medium text-yellow-800">No matching organizations found</p>
            <p className="text-yellow-700 mt-1">
              Insurance: <span className="font-medium">{results.payer_name}</span>
            </p>
            <p className="text-yellow-700">
              Care Types: <span className="font-medium">{results.care_type_names.join(', ')}</span>
            </p>
            {results.specialty_tag_names && results.specialty_tag_names.length > 0 && (
              <p className="text-yellow-700">
                Specialties: <span className="font-medium">{results.specialty_tag_names.join(', ')}</span>
              </p>
            )}
          </div>
        </div>

        <div className="text-center">
          <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-[#091747] mb-2">
            No Organizations Found
          </h3>
          <p className="text-gray-500 text-sm max-w-md mx-auto">
            We don&apos;t have any referral destinations in our network that match these criteria yet.
            Try different care types or specialties, or contact Moonlit for assistance.
          </p>
          {results.provider_directory_url && (
            <a
              href={results.provider_directory_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline mt-4"
            >
              <ExternalLink className="h-3 w-3" />
              Search {results.payer_name}&apos;s full provider directory
            </a>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header with Actions */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[#091747]">
              {results.total_count} Organization{results.total_count !== 1 ? 's' : ''} Found
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {results.payer_name} • {results.care_type_names.join(', ')}
              {results.specialty_tag_names && results.specialty_tag_names.length > 0 && (
                <> • {results.specialty_tag_names.join(', ')}</>
              )}
            </p>
            {results.provider_directory_url && (
              <a
                href={results.provider_directory_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline mt-1"
              >
                <ExternalLink className="h-3 w-3" />
                Search {results.payer_name}&apos;s full provider directory
              </a>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Copy Button */}
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-green-600">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy List
                </>
              )}
            </button>

            {/* PDF Button */}
            {pdfUrl ? (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 text-sm bg-[#BF9C73] text-white rounded-lg hover:bg-[#BF9C73]/90 transition-colors"
              >
                <Download className="h-4 w-4" />
                Download PDF
              </a>
            ) : (
              <button
                onClick={onGeneratePDF}
                disabled={isGeneratingPDF}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-[#BF9C73] text-white rounded-lg hover:bg-[#BF9C73]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGeneratingPDF ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4" />
                    Generate PDF
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Organization List */}
      <div className="p-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {results.organizations.map(org => (
            <ReferralOrganizationCard key={org.id} organization={org} />
          ))}
        </div>
      </div>
    </div>
  )
}
