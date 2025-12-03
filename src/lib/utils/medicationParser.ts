/**
 * Medication Parser Utility
 * Extracts medication data from IntakeQ clinical notes
 */

// Words that should NEVER be captured as medication names
// These are common words that regex patterns might incorrectly match
const NON_MEDICATION_WORDS = new Set([
  'from', 'to', 'at', 'for', 'the', 'and', 'or', 'with', 'on', 'in', 'by',
  'current', 'medications', 'medication', 'meds', 'all', 'same', 'following',
  'previous', 'prior', 'new', 'existing', 'reviewed', 'patient', 'as',
  'dose', 'dosage', 'daily', 'twice', 'three', 'four', 'times', 'mg',
  'support', 'efforts', 'given', 'lack', 'ongoing', 'side', 'effects'
])

// Known medication names (lowercase) - helps distinguish real meds from common words
const KNOWN_MEDICATIONS = new Set([
  'gabapentin', 'buprenorphine', 'naltrexone', 'naloxone', 'suboxone',
  'fluoxetine', 'sertraline', 'escitalopram', 'citalopram', 'paroxetine',
  'venlafaxine', 'duloxetine', 'bupropion', 'wellbutrin', 'prozac', 'zoloft',
  'lexapro', 'cymbalta', 'effexor', 'paxil', 'trazodone', 'mirtazapine',
  'remeron', 'hydroxyzine', 'vistaril', 'atarax', 'buspirone', 'buspar',
  'clonazepam', 'klonopin', 'lorazepam', 'ativan', 'alprazolam', 'xanax',
  'diazepam', 'valium', 'quetiapine', 'seroquel', 'olanzapine', 'zyprexa',
  'risperidone', 'risperdal', 'aripiprazole', 'abilify', 'ziprasidone',
  'geodon', 'lurasidone', 'latuda', 'clozapine', 'clozaril',
  'lithium', 'depakote', 'valproate', 'lamotrigine', 'lamictal', 'carbamazepine',
  'tegretol', 'oxcarbazepine', 'trileptal', 'topiramate', 'topamax',
  'prazosin', 'clonidine', 'guanfacine', 'intuniv', 'propranolol', 'inderal',
  'ramelteon', 'rozerem', 'zolpidem', 'ambien', 'eszopiclone', 'lunesta',
  'suvorexant', 'belsomra', 'melatonin',
  'amphetamine', 'adderall', 'methylphenidate', 'ritalin', 'concerta',
  'lisdexamfetamine', 'vyvanse', 'atomoxetine', 'strattera',
  'methadone', 'vivitrol', 'sublocade', 'nicotine', 'varenicline', 'chantix'
])

/**
 * Check if a word is a valid medication name
 */
function isValidMedicationName(word: string): boolean {
  if (!word || word.length < 3) return false
  const lower = word.toLowerCase()
  // Reject known non-medication words
  if (NON_MEDICATION_WORDS.has(lower)) return false
  // Accept known medications
  if (KNOWN_MEDICATIONS.has(lower)) return true
  // Accept words that look like medication names (not common English words)
  // Heuristic: real meds often have uncommon letter patterns
  return true // Allow through for now, but flag non-medications above
}

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

  // Find "Assessment and Plan:" specifically (not "Risk Assessment:")
  const assessmentQuestion = note.Questions.find((q: any) =>
    q.Text?.toLowerCase().includes('assessment and plan')
  ) || note.Questions.find((q: any) =>
    // Fallback: Look for "plan" but exclude "risk assessment"
    q.Text?.toLowerCase().includes('plan') &&
    !q.Text?.toLowerCase().includes('risk assessment')
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
  const addedMedications = new Set<string>() // Track to avoid duplicates

  // Remove HTML tags and normalize whitespace
  const cleanText = text.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ')

  // FIRST: Handle special "Continue Current Medications" boilerplate pattern
  // This pattern has medications listed inline after the colon
  // e.g., "Continue Current Medications (as reviewed): Fluoxetine: 40 mg daily Gabapentin: 300 mg..."
  const continueCurrentMedsPattern = /continue\s+current\s+medications?\s*\([^)]*\)\s*:\s*(.+?)(?=\.|$)/gi
  let continueMatch
  while ((continueMatch = continueCurrentMedsPattern.exec(cleanText)) !== null) {
    const medicationListText = continueMatch[1]
    console.log(`   📋 Found "Continue Current Medications" block: ${medicationListText.substring(0, 100)}...`)

    // Parse inline medication list: "Fluoxetine: 40 mg daily Gabapentin: 300 mg in the morning..."
    // Simpler pattern that reliably captures MedName: dose (handles "25mg" without space too)
    const inlineMedPattern = /([A-Z][a-z]{2,})\s*:\s*(\d+)\s*mg/gi
    let inlineMatch
    while ((inlineMatch = inlineMedPattern.exec(medicationListText)) !== null) {
      const medName = inlineMatch[1]
      const dosage = `${inlineMatch[2]} mg`

      if (isValidMedicationName(medName) && !addedMedications.has(medName.toLowerCase())) {
        addedMedications.add(medName.toLowerCase())
        // Extract context around this medication for frequency/timing
        const medIndex = medicationListText.indexOf(medName)
        const nextMedIndex = medicationListText.slice(medIndex + medName.length).search(/[A-Z][a-z]{2,}\s*:/)
        const contextEnd = nextMedIndex > 0 ? medIndex + medName.length + nextMedIndex : medicationListText.length
        const context = medicationListText.slice(medIndex, contextEnd)
        const { frequency, timing } = extractFrequencyAndTiming(context)

        medications.push({
          medication: medName,
          changeType: 'continued',
          newDosage: dosage,
          frequency: frequency || (context.includes('daily') ? 'daily' : undefined),
          timing: timing || (context.includes('night') ? 'at night' : context.includes('morning') ? 'in the morning' : undefined),
          notes: `Continue ${medName} ${dosage}`.trim()
        })
      }
    }
  }

  // Patterns for medication changes - note: using named groups for clarity would be ideal but sticking with indexed
  const patterns = [
    // "Increase Depakote dose to 1000 mg" or "Increase sertraline from 50 mg to 100 mg"
    // IMPROVED: Require valid medication name after "increase" (not "from")
    /increase\s+([A-Za-z][A-Za-z]+)(?:\s+dose)?\s+(?:from\s+)?(?:(\d+\s*mg)\s+)?to\s+(\d+\s*mg)[^.]*?(?:\.|\n|$)/gi,

    // "Decrease prazosin 3 mg to 2 mg"
    /decrease\s+([A-Za-z][A-Za-z]+)\s+(?:from\s+)?(\d+\s*mg)\s+to\s+(\d+\s*mg)[^.]*?(?:\.|\n|$)/gi,

    // "Start sertraline 25 mg" or "Start Gabapentin 300 mg BID"
    /(?:start|initiate|begin)\s+([A-Za-z][A-Za-z]+)\s+(\d+\s*mg)[^.]*?(?:\.|\n|$)/gi,

    // "Discontinue trazodone"
    /(?:discontinue|stop|d\/c)\s+([A-Za-z][A-Za-z]+)[^.]*?(?:\.|\n|$)/gi,

    // "Continue naltrexone 50 mg" or "Continue mirtazapine for sleep"
    // IMPROVED: Only match if followed by valid medication name
    /continue\s+([A-Za-z][A-Za-z]+)(?:\s+and\s+([A-Za-z]+))?(?:\s+(\d+\s*mg))?[^.]*?(?:\.|\n|$)/gi,

    // "Restart sertraline at 25 mg"
    /restart\s+([A-Za-z][A-Za-z]+)\s+(?:at\s+)?(\d+\s*mg)[^.]*?(?:\.|\n|$)/gi,

    // "- sertraline 50 mg daily"
    /-\s*([A-Za-z][A-Za-z]+)\s+(\d+\s*mg)[^.\n]*?(?:\.|\n|$)/gi
  ]

  patterns.forEach(pattern => {
    let match
    while ((match = pattern.exec(cleanText)) !== null) {
      const medication = match[1]

      // CRITICAL: Skip invalid medication names (like "from", "to", "Medications", etc.)
      if (!isValidMedicationName(medication)) {
        console.log(`   ⚠️ Skipping invalid medication name: "${medication}"`)
        continue
      }

      // Skip if we already added this medication
      if (addedMedications.has(medication.toLowerCase())) {
        continue
      }

      const secondMed = match[2] // For "continue X and Y" pattern
      const dosage = match[3] || match[2] // Dosage might be in match[2] or match[3]

      let changeType: MedicationChange['changeType'] = 'continued'
      let previousDosage: string | undefined
      let newDosage: string | undefined

      const contextLower = match[0].toLowerCase()

      if (contextLower.includes('increase')) {
        changeType = 'increased'
        // For increase pattern: match[2] = old dose, match[3] = new dose
        previousDosage = match[2]?.includes('mg') ? match[2] : undefined
        newDosage = match[3]
      } else if (contextLower.includes('decrease')) {
        changeType = 'decreased'
        previousDosage = match[2]
        newDosage = match[3]
      } else if (contextLower.includes('start') || contextLower.includes('initiate') || contextLower.includes('begin')) {
        changeType = 'added'
        newDosage = match[2]
      } else if (contextLower.includes('restart')) {
        changeType = 'restarted'
        newDosage = match[2]
      } else if (contextLower.includes('discontinue') || contextLower.includes('stop') || contextLower.includes('d/c')) {
        changeType = 'removed'
      } else if (contextLower.includes('continue')) {
        changeType = 'continued'
        // For continue pattern: dosage is optional, might be in match[3]
        newDosage = match[3]?.includes('mg') ? match[3] : undefined
      } else {
        // Default: assume current medication
        changeType = 'continued'
        newDosage = match[2]?.includes('mg') ? match[2] : undefined
      }

      // Extract frequency and timing from the full match context
      const { frequency, timing } = extractFrequencyAndTiming(match[0])

      // Add the primary medication
      addedMedications.add(medication.toLowerCase())
      medications.push({
        medication,
        changeType,
        previousDosage,
        newDosage,
        frequency,
        timing,
        notes: match[0].trim()
      })

      // If "continue X and Y" pattern, add second medication (only if valid)
      if (secondMed && contextLower.includes('continue') && !secondMed.includes('mg') && isValidMedicationName(secondMed)) {
        if (!addedMedications.has(secondMed.toLowerCase())) {
          addedMedications.add(secondMed.toLowerCase())
          medications.push({
            medication: secondMed,
            changeType: 'continued',
            previousDosage: undefined,
            newDosage: undefined,
            frequency,
            timing,
            notes: match[0].trim()
          })
        }
      }
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
  const cleanText = assessmentText.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ')
  const meds: string[] = []

  // Pattern 1: Bullet list format "- medication dose"
  const bulletPattern = /-\s*(\w+)\s+\d+\s*mg/gi
  for (const match of cleanText.matchAll(bulletPattern)) {
    const med = match[1]
    if (isValidMedicationName(med)) {
      meds.push(med)
    }
  }

  // Pattern 2: "including X, Y, and Z" format
  const includingPattern = /including\s+([\w\s,]+?)(?:regimen|and\s+[\w\s]+patch)/gi
  for (const match of cleanText.matchAll(includingPattern)) {
    const medList = match[1]
    // Split on commas and "and"
    const individualMeds = medList.split(/,\s*|\s+and\s+/)
    for (const med of individualMeds) {
      const trimmed = med.trim()
      if (trimmed && trimmed.length > 2 && isValidMedicationName(trimmed)) {
        meds.push(trimmed)
      }
    }
  }

  // Pattern 3: "Continue X" format - but skip "Continue Current Medications"
  const continuePattern = /continue\s+(?!current\s+medications?)([A-Za-z][A-Za-z]+)/gi
  for (const match of cleanText.matchAll(continuePattern)) {
    const med = match[1]
    if (isValidMedicationName(med)) {
      meds.push(med)
    }
  }

  // Pattern 4: "Increase X to..." format (X is current med)
  const increasePattern = /increase\s+([A-Za-z][A-Za-z]+)/gi
  for (const match of cleanText.matchAll(increasePattern)) {
    const med = match[1]
    if (isValidMedicationName(med)) {
      meds.push(med)
    }
  }

  // Pattern 5: Parse inline medication list "MedName: dose MedName2: dose2"
  // e.g., "Fluoxetine: 40 mg daily Gabapentin: 300 mg..."
  const inlineMedPattern = /([A-Z][a-z]{2,})\s*:\s*\d+\s*mg/gi
  for (const match of cleanText.matchAll(inlineMedPattern)) {
    const med = match[1]
    if (isValidMedicationName(med)) {
      meds.push(med)
    }
  }

  // Filter and return unique valid medications
  return [...new Set(meds.filter(m => isValidMedicationName(m)))]
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
