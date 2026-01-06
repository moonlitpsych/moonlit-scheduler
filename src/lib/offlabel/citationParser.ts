// Citation Parser Utility
// Parses standard academic citation formats and extracts metadata

export interface ParsedCitation {
  authors: string
  title: string
  journal: string | null
  year: number | null
  volume: string | null
  issue: string | null
  pages: string | null
  doi: string | null
  pmid: string | null
}

/**
 * Parse a citation string into structured components
 * Handles common formats like:
 * - "Author A, Author B. Title. Journal. Year;Vol(Issue):Pages."
 * - "Author A, Author B. Title. Journal. Year;Vol:Pages. doi:10.xxx"
 */
export function parseCitationString(citation: string): ParsedCitation {
  const result: ParsedCitation = {
    authors: '',
    title: '',
    journal: null,
    year: null,
    volume: null,
    issue: null,
    pages: null,
    doi: null,
    pmid: null,
  }

  // Clean up the citation
  let text = citation.trim()

  // Extract DOI if present (doi:10.xxx or https://doi.org/10.xxx)
  const doiMatch = text.match(/(?:doi[:\s]*|https?:\/\/doi\.org\/)(10\.[^\s]+)/i)
  if (doiMatch) {
    result.doi = doiMatch[1].replace(/[.,;]$/, '') // Remove trailing punctuation
    text = text.replace(doiMatch[0], '').trim()
  }

  // Extract PMID if present
  const pmidMatch = text.match(/(?:PMID[:\s]*|PubMed[:\s]*)(\d+)/i)
  if (pmidMatch) {
    result.pmid = pmidMatch[1]
    text = text.replace(pmidMatch[0], '').trim()
  }

  // Extract year (4-digit number, typically 1900-2099)
  const yearMatch = text.match(/\b(19\d{2}|20\d{2})\b/)
  if (yearMatch) {
    result.year = parseInt(yearMatch[1], 10)
  }

  // Try to parse standard format: Authors. Title. Journal. Year;Vol(Issue):Pages.
  // Split by periods, being careful about abbreviations
  const parts = splitCitationIntoParts(text)

  if (parts.length >= 2) {
    // First part is usually authors
    result.authors = parts[0].trim()

    // Second part is usually the title
    if (parts.length >= 2) {
      result.title = parts[1].trim()
    }

    // Third part onwards contains journal info
    if (parts.length >= 3) {
      const journalPart = parts.slice(2).join('. ')

      // Extract volume, issue, pages from patterns like "2016;24(6):496-508"
      const volMatch = journalPart.match(/(\d{4})\s*[;:]\s*(\d+)(?:\((\d+)\))?[:\s]*(\d+[-–]\d+)?/)
      if (volMatch) {
        result.volume = volMatch[2] || null
        result.issue = volMatch[3] || null
        result.pages = volMatch[4]?.replace('–', '-') || null
      }

      // Journal name is what's left after removing year/volume/pages info
      let journalName = journalPart
        .replace(/\d{4}\s*[;:].*$/, '') // Remove year;vol:pages
        .replace(/\s+$/, '')
        .trim()

      if (journalName) {
        result.journal = journalName
      }
    }
  }

  return result
}

/**
 * Split citation into logical parts, handling abbreviations like "et al." and journal names
 */
function splitCitationIntoParts(text: string): string[] {
  // Handle "et al." specially - it marks end of authors
  // Pattern: "Author A, Author B, et al. Title..."
  const etAlMatch = text.match(/^(.+?(?:,\s*)?et\s+al\.)\s+(.+)$/i)
  if (etAlMatch) {
    const authors = etAlMatch[1].trim()
    const rest = etAlMatch[2]

    // Now split the rest (title + journal info) by periods
    const restParts = splitByPeriods(rest)
    return [authors, ...restParts]
  }

  // No "et al." - use standard splitting
  return splitByPeriods(text)
}

/**
 * Split text by sentence-ending periods, handling abbreviations
 */
function splitByPeriods(text: string): string[] {
  // Temporarily replace common abbreviations that contain periods
  const abbrevs: Record<string, string> = {
    'Jr.': 'JR_PLACEHOLDER',
    'Sr.': 'SR_PLACEHOLDER',
    'Dr.': 'DR_PLACEHOLDER',
    'vs.': 'VS_PLACEHOLDER',
    'Fig.': 'FIG_PLACEHOLDER',
    'vol.': 'VOL_PLACEHOLDER',
    'no.': 'NO_PLACEHOLDER',
    'pp.': 'PP_PLACEHOLDER',
  }

  let processed = text
  for (const [abbrev, placeholder] of Object.entries(abbrevs)) {
    processed = processed.replace(new RegExp(abbrev.replace('.', '\\.'), 'gi'), placeholder)
  }

  // Also handle journal abbreviations (single capital letter followed by period)
  // Like "Am." "J." "Psychiatry." but not at end of sentence
  processed = processed.replace(/\b([A-Z][a-z]*)\.\s+(?=[A-Z])/g, '$1_ABBREV_PLACEHOLDER ')

  // Split by periods followed by space and capital letter (sentence boundary)
  const parts = processed.split(/\.\s+(?=[A-Z])/)

  // Restore abbreviations
  return parts.map(part => {
    let restored = part
    for (const [abbrev, placeholder] of Object.entries(abbrevs)) {
      restored = restored.replace(new RegExp(placeholder, 'g'), abbrev)
    }
    restored = restored.replace(/_ABBREV_PLACEHOLDER/g, '.')
    return restored.replace(/\.$/, '').trim() // Remove trailing period
  })
}

/**
 * Generate a citation key from authors and year
 * e.g., "hori2025" or "kerner2016"
 * Handles formats like "Moncrieff J" or "Kerner NA" where initials follow last name
 */
export function generateCitationKey(authors: string, year: number | null): string {
  // Get first author's name (before the first comma)
  const firstAuthor = authors.split(',')[0].trim()

  // Split by space and find the last name
  // Format is typically "LastName Initials" like "Moncrieff J" or "Kerner NA"
  const parts = firstAuthor.split(/\s+/)

  // The last name is the first part that has more than 2 characters
  // (initials are typically 1-2 chars like "J" or "NA")
  let lastName = ''
  for (const part of parts) {
    if (part.length > 2 && !part.match(/^[A-Z]{1,3}$/)) {
      lastName = part
      break
    }
  }

  // Fallback: just use first part if no clear last name found
  if (!lastName && parts.length > 0) {
    lastName = parts[0]
  }

  const cleanName = lastName.toLowerCase().replace(/[^a-z]/g, '')

  return `${cleanName || 'unknown'}${year || 'nd'}`
}
