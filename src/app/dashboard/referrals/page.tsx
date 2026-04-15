'use client'

import { useState } from 'react'
import { Network } from 'lucide-react'
import ReferralGeneratorForm from '@/components/admin/referral-network/ReferralGeneratorForm'
import ReferralResultsView from '@/components/admin/referral-network/ReferralResultsView'
import { providerImpersonationManager } from '@/lib/provider-impersonation'
import type { ReferralSearchCriteria, ReferralSearchResult } from '@/types/referral-network'

export default function ProviderReferralsPage() {
  const [results, setResults] = useState<ReferralSearchResult | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const [pdfUrl, setPdfUrl] = useState<string | undefined>()
  const [lastCriteria, setLastCriteria] = useState<ReferralSearchCriteria | null>(null)

  const handleSearch = async (criteria: ReferralSearchCriteria) => {
    setIsSearching(true)
    setPdfUrl(undefined)
    setLastCriteria(criteria)

    try {
      const response = await fetch('/api/admin/referral-network/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(criteria),
      })
      if (!response.ok) throw new Error('Search failed')
      const data: ReferralSearchResult = await response.json()
      setResults(data)
    } catch (error) {
      console.error('Search error:', error)
      setResults(null)
    } finally {
      setIsSearching(false)
    }
  }

  const handleGeneratePDF = async () => {
    if (!results || !lastCriteria) return
    setIsGeneratingPDF(true)

    try {
      const impersonation = providerImpersonationManager.getImpersonatedProvider()

      const response = await fetch('/api/admin/referral-network/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          search_criteria: lastCriteria,
          organizations: results.organizations,
          payer_name: results.payer_name,
          care_type_names: results.care_type_names,
          specialty_tag_names: results.specialty_tag_names,
          impersonated_provider_id: impersonation?.provider?.id,
        }),
      })

      if (!response.ok) throw new Error('PDF generation failed')
      const data = await response.json()

      if (data.pdf_url) {
        setPdfUrl(data.pdf_url)
        window.open(data.pdf_url, '_blank')
      } else if (data.pdf_base64) {
        const byteCharacters = atob(data.pdf_base64)
        const byteNumbers = new Array(byteCharacters.length)
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i)
        }
        const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'application/pdf' })
        const url = URL.createObjectURL(blob)
        setPdfUrl(url)
        window.open(url, '_blank')
      }
    } catch (error) {
      console.error('PDF generation error:', error)
    } finally {
      setIsGeneratingPDF(false)
    }
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-[#BF9C73]/10 rounded-lg">
            <Network className="h-6 w-6 text-[#BF9C73]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#091747] font-['Newsreader']">
              Patient Referrals
            </h1>
            <p className="text-sm text-gray-500">
              Find outside resources for your patient and generate a PDF to hand them
            </p>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="font-medium text-blue-800 mb-1">How to Use</h3>
        <ol className="text-sm text-blue-700 list-decimal list-inside space-y-1">
          <li>Select the patient&apos;s insurance payer</li>
          <li>Choose the type(s) of care they need (therapy, inpatient, etc.)</li>
          <li>Optionally filter by specialty needs (psychosis, court-ordered, etc.)</li>
          <li>Click &quot;Find Resources&quot; to see matching organizations</li>
          <li>Generate a PDF to share with the patient</li>
        </ol>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-1">
          <ReferralGeneratorForm onSearch={handleSearch} isLoading={isSearching} />
        </div>
        <div className="xl:col-span-2">
          <ReferralResultsView
            results={results}
            onGeneratePDF={handleGeneratePDF}
            isGeneratingPDF={isGeneratingPDF}
            pdfUrl={pdfUrl}
          />
        </div>
      </div>
    </div>
  )
}
