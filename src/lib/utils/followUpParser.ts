/**
 * Follow-Up Parser Utility
 * Extracts follow-up information from IntakeQ clinical notes
 *
 * Per requirements: Returns EXACT phrasing from physician without modification
 */

export interface ParsedFollowUp {
  text: string | null           // Exact phrasing from physician
  noteId: string | null         // IntakeQ note ID for reference
  noteDate: string | null       // Date of the note
}

/**
 * Parse follow-up information from IntakeQ note
 *
 * Strategy:
 * 1. Look for a dedicated "Follow-Up" or "Return Visit" Question
 * 2. Fall back to extracting from end of "Assessment and Plan" section
 * 3. Return exact text without parsing/modification
 */
export function parseFollowUpFromNote(note: any): ParsedFollowUp {
  // Handle note date - can be Unix timestamp (_noteDate from sync script) or ISO string
  let noteDate: string | null = null
  if (note?._noteDate) {
    // Unix timestamp in milliseconds from notes/summary API
    noteDate = new Date(note._noteDate).toISOString()
  } else if (note?.Date && typeof note.Date === 'number') {
    // Unix timestamp from IntakeQ
    noteDate = new Date(note.Date).toISOString()
  } else if (note?.DateCreated || note?.CreatedDate) {
    // ISO string date
    noteDate = note.DateCreated || note.CreatedDate
  }

  const emptyResult: ParsedFollowUp = {
    text: null,
    noteId: note?.Id || null,
    noteDate
  }

  // Check for Questions array
  if (!note?.Questions || !Array.isArray(note.Questions)) {
    return emptyResult
  }

  // Strategy 1: Look for dedicated follow-up section
  const followUpQuestion = note.Questions.find((q: any) => {
    const text = q.Text?.toLowerCase() || ''
    return (
      text.includes('follow-up') ||
      text.includes('follow up') ||
      text.includes('followup') ||
      text.includes('return visit') ||
      text.includes('next visit') ||
      text.includes('next appointment') ||
      text.includes('f/u')
    )
  })

  if (followUpQuestion?.Answer) {
    const answer = cleanText(followUpQuestion.Answer)
    if (answer && answer.length > 0) {
      return {
        text: answer,
        noteId: note.Id || null,
        noteDate
      }
    }
  }

  // Strategy 2: Extract from end of "Assessment and Plan" section
  const assessmentQuestion = note.Questions.find((q: any) =>
    q.Text?.toLowerCase().includes('assessment and plan')
  ) || note.Questions.find((q: any) =>
    q.Text?.toLowerCase().includes('plan') &&
    !q.Text?.toLowerCase().includes('risk assessment')
  )

  if (assessmentQuestion?.Answer) {
    const followUpText = extractFollowUpFromAssessment(assessmentQuestion.Answer)
    if (followUpText) {
      return {
        text: followUpText,
        noteId: note.Id || null,
        noteDate
      }
    }
  }

  return emptyResult
}

/**
 * Extract follow-up information from the end of Assessment and Plan text
 * Looks for patterns like "Return in X weeks", "Follow up in X", etc.
 */
function extractFollowUpFromAssessment(text: string): string | null {
  const cleanedText = cleanText(text)
  if (!cleanedText) return null

  // Patterns that indicate follow-up information
  // These are matched case-insensitively
  const followUpPatterns = [
    // Direct follow-up mentions
    /(?:follow[- ]?up|f\/u|return|recheck|revisit|see (?:patient )?again|next (?:visit|appointment))[\s:]+.{5,100}?(?:\.|$)/gi,
    // "in X weeks/months" patterns
    /(?:return|follow[- ]?up|see (?:patient )?again|recheck).*?(?:in|after)\s+\d+\s+(?:day|week|month|year)s?.*?(?:\.|$)/gi,
    // Scheduled for patterns
    /(?:scheduled?|book(?:ed)?|plan(?:ned)?).*?(?:follow[- ]?up|return|visit).*?(?:\.|$)/gi,
    // PRN/as needed patterns
    /(?:return|follow[- ]?up|see).*?(?:prn|as needed|if needed|if symptoms).*?(?:\.|$)/gi
  ]

  // Split text into sentences/lines and look at the end portion
  const lines = cleanedText.split(/[.\n]/).filter(l => l.trim().length > 0)

  // Search from the end of the text (last 5 lines/sentences)
  const lastLines = lines.slice(-5)

  for (const line of lastLines.reverse()) {
    const trimmedLine = line.trim()

    // Check each pattern
    for (const pattern of followUpPatterns) {
      pattern.lastIndex = 0 // Reset regex state
      const match = pattern.exec(trimmedLine)
      if (match) {
        return match[0].trim()
      }
    }

    // Also check if the line itself contains follow-up keywords
    const lowerLine = trimmedLine.toLowerCase()
    if (
      lowerLine.includes('follow') ||
      lowerLine.includes('return') ||
      lowerLine.includes('recheck') ||
      lowerLine.includes('next visit') ||
      lowerLine.includes('f/u')
    ) {
      return trimmedLine
    }
  }

  return null
}

/**
 * Clean HTML entities and tags from text
 */
function cleanText(text: string): string {
  if (!text) return ''

  return text
    .replace(/<[^>]*>/g, ' ')      // Remove HTML tags
    .replace(/&nbsp;/g, ' ')       // Replace &nbsp;
    .replace(/&amp;/g, '&')        // Replace &amp;
    .replace(/&lt;/g, '<')         // Replace &lt;
    .replace(/&gt;/g, '>')         // Replace &gt;
    .replace(/&quot;/g, '"')       // Replace &quot;
    .replace(/&#39;/g, "'")        // Replace &#39;
    .replace(/\s+/g, ' ')          // Normalize whitespace
    .trim()
}
