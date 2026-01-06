import { NextRequest, NextResponse } from 'next/server'
import { parseCitationString, generateCitationKey } from '@/lib/offlabel/citationParser'

interface CrossRefWork {
  DOI?: string
  title?: string[]
  author?: Array<{ given?: string; family?: string }>
  'container-title'?: string[]
  published?: { 'date-parts'?: number[][] }
  volume?: string
  issue?: string
  page?: string
}

interface PubMedResult {
  uid: string
  title?: string
  authors?: Array<{ name: string }>
  source?: string
  pubdate?: string
  volume?: string
  issue?: string
  pages?: string
  elocationid?: string
}

/**
 * Search CrossRef for a citation and return DOI + metadata
 */
async function searchCrossRef(query: string): Promise<CrossRefWork | null> {
  try {
    const encodedQuery = encodeURIComponent(query)
    const response = await fetch(
      `https://api.crossref.org/works?query=${encodedQuery}&rows=1&mailto=hello@trymoonlit.com`,
      {
        headers: {
          'User-Agent': 'Moonlit-Psychiatry/1.0 (https://booking.trymoonlit.com; mailto:hello@trymoonlit.com)',
        },
      }
    )

    if (!response.ok) {
      console.error('[CrossRef] API error:', response.status)
      return null
    }

    const data = await response.json()
    const items = data?.message?.items

    if (items && items.length > 0) {
      return items[0] as CrossRefWork
    }

    return null
  } catch (error) {
    console.error('[CrossRef] Fetch error:', error)
    return null
  }
}

/**
 * Search PubMed for a citation and return PMID + metadata
 */
async function searchPubMed(query: string): Promise<PubMedResult | null> {
  try {
    // First, search for the article
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=1&retmode=json`
    const searchResponse = await fetch(searchUrl)

    if (!searchResponse.ok) {
      console.error('[PubMed] Search API error:', searchResponse.status)
      return null
    }

    const searchData = await searchResponse.json()
    const pmids = searchData?.esearchresult?.idlist

    if (!pmids || pmids.length === 0) {
      return null
    }

    const pmid = pmids[0]

    // Fetch article details
    const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pmid}&retmode=json`
    const summaryResponse = await fetch(summaryUrl)

    if (!summaryResponse.ok) {
      console.error('[PubMed] Summary API error:', summaryResponse.status)
      return { uid: pmid }
    }

    const summaryData = await summaryResponse.json()
    const result = summaryData?.result?.[pmid]

    if (result) {
      return {
        uid: pmid,
        title: result.title,
        authors: result.authors,
        source: result.source,
        pubdate: result.pubdate,
        volume: result.volume,
        issue: result.issue,
        pages: result.pages,
        elocationid: result.elocationid,
      }
    }

    return { uid: pmid }
  } catch (error) {
    console.error('[PubMed] Fetch error:', error)
    return null
  }
}

/**
 * Look up DOI directly in CrossRef
 */
async function lookupDOI(doi: string): Promise<CrossRefWork | null> {
  try {
    const response = await fetch(
      `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
      {
        headers: {
          'User-Agent': 'Moonlit-Psychiatry/1.0 (https://booking.trymoonlit.com; mailto:hello@trymoonlit.com)',
        },
      }
    )

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    return data?.message as CrossRefWork
  } catch (error) {
    console.error('[CrossRef] DOI lookup error:', error)
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const { citation } = await request.json()

    if (!citation || typeof citation !== 'string') {
      return NextResponse.json(
        { error: 'Citation string is required' },
        { status: 400 }
      )
    }

    // Step 1: Parse the citation string locally
    const parsed = parseCitationString(citation)

    // Step 2: If we found a DOI in the string, look it up directly
    let crossRefData: CrossRefWork | null = null
    if (parsed.doi) {
      crossRefData = await lookupDOI(parsed.doi)
    }

    // Step 3: If no DOI or lookup failed, search CrossRef
    if (!crossRefData) {
      // Build a search query from title + authors
      const searchQuery = [parsed.title, parsed.authors].filter(Boolean).join(' ')
      if (searchQuery.length > 10) {
        crossRefData = await searchCrossRef(searchQuery)
      }
    }

    // Step 4: Search PubMed for PMID
    let pubMedData: PubMedResult | null = null
    const pubMedQuery = [parsed.title, parsed.authors].filter(Boolean).join(' ')
    if (pubMedQuery.length > 10) {
      pubMedData = await searchPubMed(pubMedQuery)
    }

    // Step 5: Merge all data sources, preferring API data over parsed data
    const result = {
      authors: parsed.authors || formatCrossRefAuthors(crossRefData?.author) || '',
      title: crossRefData?.title?.[0] || pubMedData?.title || parsed.title || '',
      journal: crossRefData?.['container-title']?.[0] || pubMedData?.source || parsed.journal || null,
      year: extractYear(crossRefData?.published) || parsed.year || extractYearFromString(pubMedData?.pubdate) || null,
      volume: crossRefData?.volume || pubMedData?.volume || parsed.volume || null,
      issue: crossRefData?.issue || pubMedData?.issue || parsed.issue || null,
      pages: crossRefData?.page || pubMedData?.pages || parsed.pages || null,
      doi: crossRefData?.DOI || parsed.doi || null,
      pmid: pubMedData?.uid || parsed.pmid || null,
      citation_key: '',
    }

    // Generate citation key
    result.citation_key = generateCitationKey(result.authors, result.year)

    return NextResponse.json({
      success: true,
      reference: result,
      sources: {
        crossref: !!crossRefData,
        pubmed: !!pubMedData,
        parsed: true,
      },
    })
  } catch (error: any) {
    console.error('[POST /api/admin/offlabel/parse-citation]', error)
    return NextResponse.json(
      { error: error.message || 'Failed to parse citation' },
      { status: 500 }
    )
  }
}

// Helper functions

function formatCrossRefAuthors(authors?: CrossRefWork['author']): string {
  if (!authors || authors.length === 0) return ''

  const formatted = authors.slice(0, 3).map(a => {
    if (a.family && a.given) {
      return `${a.family} ${a.given.charAt(0)}`
    }
    return a.family || ''
  })

  if (authors.length > 3) {
    return formatted.join(', ') + ', et al.'
  }

  return formatted.join(', ')
}

function extractYear(published?: CrossRefWork['published']): number | null {
  const dateParts = published?.['date-parts']?.[0]
  if (dateParts && dateParts[0]) {
    return dateParts[0]
  }
  return null
}

function extractYearFromString(dateStr?: string): number | null {
  if (!dateStr) return null
  const match = dateStr.match(/\b(19\d{2}|20\d{2})\b/)
  return match ? parseInt(match[1], 10) : null
}
