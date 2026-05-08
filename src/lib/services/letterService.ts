/**
 * Provider letter templating.
 *
 * Generates the default body text for each letter type. The provider can
 * fully edit the result in the dashboard before generating the PDF, so this
 * is just a sensible starting point — not authoritative clinical content.
 */

import { formatDiagnosis } from '@/lib/data/psychiatricIcd10'

export type LetterType =
  | 'proof_of_care'
  | 'proof_of_care_with_dx'
  | 'coordination_of_care'
  | 'work_leave'

export interface LetterTemplateInput {
  letterType: LetterType
  patientName: string
  patientDob?: string | null
  providerName: string             // e.g. "C. Rufus Sweeney"
  providerCredentials: string      // e.g. "MD"
  firstAppointmentDate?: string | null   // ISO or pretty
  diagnosisCodes?: string[]
  recipientName?: string | null
  recipientOrganization?: string | null
  // Work-leave specific
  leaveStartDate?: string | null
  leaveEndDate?: string | null
}

export const LETTER_TYPE_LABELS: Record<LetterType, string> = {
  proof_of_care: 'Proof of Care',
  proof_of_care_with_dx: 'Proof of Care with Diagnosis',
  coordination_of_care: 'Coordination of Care',
  work_leave: 'Consideration of Work Leave',
}

export const LETTER_TYPE_TITLES: Record<LetterType, string> = {
  proof_of_care: 'TO WHOM IT MAY CONCERN',
  proof_of_care_with_dx: 'TO WHOM IT MAY CONCERN',
  coordination_of_care: 'COORDINATION OF CARE',
  work_leave: 'TO WHOM IT MAY CONCERN',
}

function formatDate(d?: string | null): string {
  if (!d) return ''
  const parsed = new Date(d)
  if (isNaN(parsed.getTime())) return d
  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function normalizeDiagnoses(codes?: string[]): string[] {
  if (!codes || codes.length === 0) return []
  return codes.map((c) => formatDiagnosis(c)).filter(Boolean)
}

/** Joins diagnoses for inline use in a sentence: "A, B, and C". */
function joinDiagnosesInline(codes: string[]): string {
  if (codes.length === 0) return ''
  if (codes.length === 1) return codes[0]
  if (codes.length === 2) return `${codes[0]} and ${codes[1]}`
  return `${codes.slice(0, -1).join(', ')}, and ${codes[codes.length - 1]}`
}

/** Renders diagnoses as a multi-line bullet block for the body. */
function diagnosisBlock(codes: string[]): string {
  if (codes.length === 0) return ''
  if (codes.length === 1) return codes[0]
  return codes.map((c) => `  • ${c}`).join('\n')
}

export function buildDefaultBody(input: LetterTemplateInput): string {
  const {
    letterType,
    patientName,
    patientDob,
    providerName,
    providerCredentials,
    firstAppointmentDate,
    diagnosisCodes = [],
    recipientName,
    recipientOrganization,
    leaveStartDate,
    leaveEndDate,
  } = input

  const dobLine = patientDob ? ` (DOB ${formatDate(patientDob)})` : ''
  const since = firstAppointmentDate
    ? ` since ${formatDate(firstAppointmentDate)}`
    : ''
  const dxList = normalizeDiagnoses(diagnosisCodes)
  const dxInline = joinDiagnosesInline(dxList)
  const dxBlock = diagnosisBlock(dxList)
  const dxNoun = dxList.length > 1 ? 'diagnoses' : 'diagnosis'

  switch (letterType) {
    case 'proof_of_care':
      return [
        `This letter confirms that ${patientName}${dobLine} is an established patient at Moonlit Psychiatry under the care of ${providerName}, ${providerCredentials}${since}.`,
        ``,
        `${patientName} continues to be engaged in treatment with our practice. Please contact our office at (385) 246-2522 if you require additional information.`,
      ].join('\n')

    case 'proof_of_care_with_dx':
      return [
        `This letter confirms that ${patientName}${dobLine} is an established patient at Moonlit Psychiatry under the care of ${providerName}, ${providerCredentials}${since}.`,
        ``,
        dxList.length === 0
          ? `${patientName} is being treated for a condition relevant to the purpose of this letter.`
          : dxList.length === 1
          ? `${patientName} has been evaluated and is being treated for the following diagnosis:\n\n${dxBlock}`
          : `${patientName} has been evaluated and is being treated for the following diagnoses:\n\n${dxBlock}`,
        ``,
        `Please contact our office at (385) 246-2522 if you require additional information.`,
      ].join('\n')

    case 'coordination_of_care': {
      const greeting = recipientName
        ? `Dear ${recipientName}${recipientOrganization ? ` (${recipientOrganization})` : ''}:`
        : `To the receiving clinician:`
      return [
        greeting,
        ``,
        `I am writing to coordinate care for our mutual patient, ${patientName}${dobLine}, who is established with Moonlit Psychiatry under my care${since}.`,
        ``,
        dxList.length === 0
          ? `Current ${dxNoun}: [provider to specify].`
          : dxList.length === 1
          ? `Current diagnosis:\n\n${dxBlock}`
          : `Current diagnoses:\n\n${dxBlock}`,
        ``,
        `[Brief clinical summary, current medications, and any items relevant to the receiving clinician.]`,
        ``,
        `Please reach out to our office at (385) 246-2522 or hello@trymoonlit.com with any questions or to coordinate further.`,
      ].join('\n')
    }

    case 'work_leave': {
      const range =
        leaveStartDate || leaveEndDate
          ? ` from ${formatDate(leaveStartDate) || '[start date]'} through ${formatDate(leaveEndDate) || '[end date]'}`
          : ''
      return [
        `This letter is in support of ${patientName}${dobLine}, an established patient under my psychiatric care at Moonlit Psychiatry${since}.`,
        ``,
        dxList.length === 0
          ? `${patientName} is being treated for a psychiatric condition.`
          : dxList.length === 1
          ? `${patientName} is currently being treated for ${dxInline}.`
          : `${patientName} is currently being treated for the following conditions: ${dxInline}.`,
        ``,
        `In my clinical judgment, ${patientName}'s current condition merits a temporary reduction in work hours and/or a leave of absence${range}. This recommendation is intended to support recovery and ongoing treatment.`,
        ``,
        `Please contact our office at (385) 246-2522 if you require additional information or documentation.`,
      ].join('\n')
    }
  }
}
