/**
 * Medication Parser Utility
 * Extracts medication data from IntakeQ clinical notes
 */

export interface MedicationChange {
  medication: string
  changeType: 'added' | 'removed' | 'increased' | 'decreased' | 'continued' | 'restarted' | 'no_change'
  previousDosage?: string
  newDosage?: string
  frequency?: string  // "daily", "twice daily", "qhs", "PRN", etc.
  timing?: string     // "at bedtime", "in morning", "with food", etc.
  notes?: string
}

export interface ParsedMedicationData {
  hasChanges: boolean
  noChangeIndicator: boolean
  changes: MedicationChange[]
  previousMedications: string[]
  currentMedications: string[]
  parseMethod: string
  rawText?: string
}

/**
 * Parse medications from IntakeQ note (Questions array format)
 */
export function parseMedicationsFromNote(note: any): ParsedMedicationData {
  console.log('📋 Parsing medications from IntakeQ note...')

  // IntakeQ notes have a Questions array - find HPI and Assessment/Plan sections
  if (!note?.Questions || !Array.isArray(note.Questions)) {
    console.log('⚠️ No Questions array found in note')
    return createEmptyResult('No Questions array')
  }

  // Find relevant sections
  const hpiQuestion = note.Questions.find((q: any) =>
    q.Text?.toLowerCase().includes('hpi') ||
    q.Text?.toLowerCase().includes('history of present illness')
  )

  const assessmentQuestion = note.Questions.find((q: any) =>
    q.Text?.toLowerCase().includes('assessment') ||
    q.Text?.toLowerCase().includes('plan')
  )

  if (!hpiQuestion && !assessmentQuestion) {
    console.log('⚠️ No HPI or Assessment/Plan sections found')
    return createEmptyResult('No medication sections found')
  }

  // Extract text from these sections
  const hpiText = hpiQuestion?.Answer || ''
  const assessmentText = assessmentQuestion?.Answer || ''
  const combinedText = `${hpiText}\n\n${assessmentText}`

  console.log(`📝 Found medication sections (${combinedText.length} chars)`)

  // Check for "no change" indicators
  const noChangePatterns = [
    /no\s+(?:medication\s+)?change/i,
    /continue\s+all\s+current\s+medication/i,
    /unchanged/i,
    /stable\s+on\s+current/i
  ]

  const hasNoChangeIndicator = noChangePatterns.some(pattern =>
    pattern.test(combinedText)
  )

  // Extract medication names and dosages
  const medications = extractMedications(combinedText)

  if (medications.length === 0) {
    console.log('⚠️ No medications found in note')
    return {
      hasChanges: false,
      noChangeIndicator: hasNoChangeIndicator,
      changes: [],
      previousMedications: [],
      currentMedications: [],
      parseMethod: 'No medications found',
      rawText: combinedText.substring(0, 500)
    }
  }

  console.log(`✅ Extracted ${medications.length} medication entries`)

  return {
    hasChanges: medications.some(m => m.changeType !== 'continued' && m.changeType !== 'no_change'),
    noChangeIndicator: hasNoChangeIndicator,
    changes: medications,
    previousMedications: extractPreviousMeds(hpiText),
    currentMedications: extractCurrentMeds(assessmentText),
    parseMethod: 'IntakeQ Questions format',
    rawText: combinedText.substring(0, 500)
  }
}

/**
 * Extract frequency and timing information from medication context
 */
function extractFrequencyAndTiming(context: string): { frequency?: string; timing?: string } {
  const lowerContext = context.toLowerCase()

  // Frequency patterns
  const frequencyPatterns = [
    { pattern: /\bqhs\b/i, value: 'nightly at bedtime' },
    { pattern: /\bqam\b/i, value: 'every morning' },
    { pattern: /\bqd\b|\bdaily\b/i, value: 'daily' },
    { pattern: /\bbid\b|\btwice\s+(?:a\s+)?daily\b/i, value: 'twice daily' },
    { pattern: /\btid\b|\bthree\s+times\s+(?:a\s+)?daily\b/i, value: 'three times daily' },
    { pattern: /\bqid\b|\bfour\s+times\s+(?:a\s+)?daily\b/i, value: 'four times daily' },
    { pattern: /\bprn\b/i, value: 'as needed' },
    { pattern: /\bq\s*(\d+)\s*h\b/i, value: (match: RegExpMatchArray) => `every ${match[1]} hours` }
  ]

  // Timing patterns
  const timingPatterns = [
    { pattern: /\bat\s+(?:bed)?night\b/i, value: 'at night' },
    { pattern: /\bat\s+bedtime\b/i, value: 'at bedtime' },
    { pattern: /\bin\s+(?:the\s+)?morning\b/i, value: 'in the morning' },
    { pattern: /\bwith\s+food\b/i, value: 'with food' },
    { pattern: /\bon\s+empty\s+stomach\b/i, value: 'on empty stomach' },
    { pattern: /\bbefore\s+meals?\b/i, value: 'before meals' },
    { pattern: /\bafter\s+meals?\b/i, value: 'after meals' }
  ]

  let frequency: string | undefined
  let timing: string | undefined

  // Extract frequency
  for (const { pattern, value } of frequencyPatterns) {
    const match = lowerContext.match(pattern)
    if (match) {
      frequency = typeof value === 'function' ? value(match) : value
      break
    }
  }

  // Extract timing
  for (const { pattern, value } of timingPatterns) {
    if (pattern.test(lowerContext)) {
      timing = value
      break
    }
  }

  return { frequency, timing }
}

/**
 * Extract medication changes from clinical text
 */
function extractMedications(text: string): MedicationChange[] {
  const medications: MedicationChange[] = []

  // Remove HTML tags
  const cleanText = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')

  // Patterns for medication changes
  const patterns = [
    // "Increase sertraline from 50 mg to 100 mg"
    /increase\s+(\w+)\s+(?:from\s+)?(\d+\s*mg)\s+to\s+(\d+\s*mg)[^.]*?(?:\.|\n|$)/gi,

    // "Decrease prazosin 3 mg to 2 mg"
    /decrease\s+(\w+)\s+(?:from\s+)?(\d+\s*mg)\s+to\s+(\d+\s*mg)[^.]*?(?:\.|\n|$)/gi,

    // "Start sertraline 25 mg"
    /(?:start|initiate|begin)\s+(\w+)\s+(\d+\s*mg)[^.]*?(?:\.|\n|$)/gi,

    // "Discontinue trazodone"
    /(?:discontinue|stop|d\/c)\s+(\w+)[^.]*?(?:\.|\n|$)/gi,

    // "Continue naltrexone 50 mg"
    /continue\s+(\w+)\s+(\d+\s*mg)[^.]*?(?:\.|\n|$)/gi,

    // "Restart sertraline at 25 mg"
    /restart\s+(\w+)\s+(?:at\s+)?(\d+\s*mg)[^.]*?(?:\.|\n|$)/gi,

    // "- sertraline 50 mg daily"
    /-\s*(\w+)\s+(\d+\s*mg)[^.\n]*?(?:\.|\n|$)/gi
  ]

  patterns.forEach(pattern => {
    let match
    while ((match = pattern.exec(cleanText)) !== null) {
      const medication = match[1]
      const dosage1 = match[2]
      const dosage2 = match[3]

      let changeType: MedicationChange['changeType'] = 'continued'
      let previousDosage: string | undefined
      let newDosage: string | undefined

      const contextLower = match[0].toLowerCase()

      if (contextLower.includes('increase')) {
        changeType = 'increased'
        previousDosage = dosage1
        newDosage = dosage2
      } else if (contextLower.includes('decrease')) {
        changeType = 'decreased'
        previousDosage = dosage1
        newDosage = dosage2
      } else if (contextLower.includes('start') || contextLower.includes('initiate') || contextLower.includes('begin')) {
        changeType = 'added'
        newDosage = dosage1
      } else if (contextLower.includes('restart')) {
        changeType = 'restarted'
        newDosage = dosage1
      } else if (contextLower.includes('discontinue') || contextLower.includes('stop') || contextLower.includes('d/c')) {
        changeType = 'removed'
      } else if (contextLower.includes('continue')) {
        changeType = 'continued'
        newDosage = dosage1
      } else {
        // Default: assume current medication
        changeType = 'continued'
        newDosage = dosage1
      }

      // Extract frequency and timing from the full match context
      const { frequency, timing } = extractFrequencyAndTiming(match[0])

      medications.push({
        medication,
        changeType,
        previousDosage,
        newDosage,
        frequency,
        timing,
        notes: match[0].trim()
      })
    }
  })

  return medications
}

/**
 * Extract previous medications from HPI section
 */
function extractPreviousMeds(hpiText: string): string[] {
  const cleanText = hpiText.replace(/<[^>]*>/g, ' ')
  const medPattern = /-\s*(\w+)\s+\d+\s*mg/gi
  const matches = cleanText.matchAll(medPattern)

  const meds: string[] = []
  for (const match of matches) {
    meds.push(match[1])
  }

  return [...new Set(meds)] // Remove duplicates
}

/**
 * Extract current medications from Assessment/Plan section
 */
function extractCurrentMeds(assessmentText: string): string[] {
  const cleanText = assessmentText.replace(/<[^>]*>/g, ' ')
  const medPattern = /-\s*(\w+)\s+\d+\s*mg/gi
  const matches = cleanText.matchAll(medPattern)

  const meds: string[] = []
  for (const match of matches) {
    meds.push(match[1])
  }

  return [...new Set(meds)] // Remove duplicates
}

/**
 * Create empty result when no data is found
 */
function createEmptyResult(reason: string): ParsedMedicationData {
  return {
    hasChanges: false,
    noChangeIndicator: false,
    changes: [],
    previousMedications: [],
    currentMedications: [],
    parseMethod: reason
  }
}
