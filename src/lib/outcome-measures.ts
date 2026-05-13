export type MeasureType = 'PHQ-9' | 'GAD-7'
export type SeverityLevel = 'minimal' | 'mild' | 'moderate' | 'moderately_severe' | 'severe'

export function severityLabel(severity: SeverityLevel | undefined | null): string {
  switch (severity) {
    case 'minimal': return 'Minimal'
    case 'mild': return 'Mild'
    case 'moderate': return 'Moderate'
    case 'moderately_severe': return 'Moderately Severe'
    case 'severe': return 'Severe'
    default: return ''
  }
}

export function severityColor(severity: SeverityLevel | undefined | null): string {
  switch (severity) {
    case 'minimal': return '#22c55e'
    case 'mild': return '#84cc16'
    case 'moderate': return '#eab308'
    case 'moderately_severe': return '#f97316'
    case 'severe': return '#ef4444'
    default: return '#94a3b8'
  }
}

export const PHQ9_MAX = 27
export const GAD7_MAX = 21

export function maxScore(measureType: MeasureType): number {
  return measureType === 'PHQ-9' ? PHQ9_MAX : GAD7_MAX
}

export interface PatientOutcomeScore {
  date: string
  score: number
  severity: SeverityLevel
}

export interface PatientOutcomeSummary {
  patientId: string
  patientName: string
  measureType: MeasureType
  scores: PatientOutcomeScore[]
  firstScore: number
  lastScore: number
  scoreChange: number
  improved: boolean
  responseAchieved: boolean
  remissionAchieved: boolean
}

export interface PatientProgressData {
  patients: PatientOutcomeSummary[]
  dateRange: { earliest: string; latest: string }
  uploadSummary: {
    totalMeasures: number
    phq9Count: number
    gad7Count: number
    patientCount: number
  }
}
