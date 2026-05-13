import { supabaseAdmin } from '@/lib/supabase'
import type {
  MeasureType,
  PatientOutcomeSummary,
  PatientProgressData,
  SeverityLevel,
} from '@/lib/outcome-measures'

const REMISSION_THRESHOLD = 5

export interface GetPatientProgressParams {
  providerId: string
  measureType?: MeasureType | null
}

function emptyResult(): PatientProgressData {
  return {
    patients: [],
    dateRange: { earliest: '', latest: '' },
    uploadSummary: { totalMeasures: 0, phq9Count: 0, gad7Count: 0, patientCount: 0 },
  }
}

export async function getPatientProgressData(
  params: GetPatientProgressParams
): Promise<PatientProgressData> {
  const { providerId, measureType } = params

  const { data: apptRows, error: apptErr } = await supabaseAdmin
    .from('appointments')
    .select('patient_id')
    .eq('provider_id', providerId)
    .not('patient_id', 'is', null)

  if (apptErr) throw new Error(apptErr.message)

  const patientIds = [...new Set((apptRows || []).map(r => r.patient_id as string).filter(Boolean))]
  if (patientIds.length === 0) return emptyResult()

  let measuresQuery = supabaseAdmin
    .from('outcome_measures')
    .select('*')
    .in('patient_id', patientIds)
    .order('administered_date', { ascending: true })

  if (measureType) measuresQuery = measuresQuery.eq('measure_type', measureType)

  const { data: measures, error: measuresError } = await measuresQuery
  if (measuresError) throw new Error(measuresError.message)
  if (!measures || measures.length === 0) return emptyResult()

  const measuredPatientIds = [...new Set(measures.map(m => m.patient_id))]
  const { data: patients } = await supabaseAdmin
    .from('patients')
    .select('id, first_name, last_name')
    .in('id', measuredPatientIds)

  const patientMap = new Map((patients || []).map(p => [p.id, p]))

  const grouped = new Map<string, typeof measures>()
  for (const m of measures) {
    const key = `${m.patient_id}__${m.measure_type}`
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(m)
  }

  const summaries: PatientOutcomeSummary[] = []
  for (const [key, list] of grouped) {
    const [patientId, measureTypeKey] = key.split('__')
    const patient = patientMap.get(patientId)
    if (!patient) continue

    const sorted = [...list].sort((a, b) =>
      String(a.administered_date).localeCompare(String(b.administered_date))
    )
    const scores = sorted.map(m => ({
      date: m.administered_date as string,
      score: m.total_score as number,
      severity: m.severity as SeverityLevel,
    }))
    const firstScore = scores[0].score
    const lastScore = scores[scores.length - 1].score
    const scoreChange = lastScore - firstScore

    summaries.push({
      patientId,
      patientName: `${patient.last_name || ''}, ${patient.first_name || ''}`.trim().replace(/^,\s*/, ''),
      measureType: measureTypeKey as MeasureType,
      scores,
      firstScore,
      lastScore,
      scoreChange,
      improved: lastScore < firstScore,
      responseAchieved: firstScore > 0 && lastScore <= firstScore * 0.5,
      remissionAchieved: lastScore < REMISSION_THRESHOLD,
    })
  }

  const allDates: string[] = []
  let phq9Count = 0
  let gad7Count = 0
  for (const s of summaries) {
    for (const sc of s.scores) allDates.push(sc.date)
    if (s.measureType === 'PHQ-9') phq9Count += s.scores.length
    else if (s.measureType === 'GAD-7') gad7Count += s.scores.length
  }
  allDates.sort()

  return {
    patients: summaries.sort((a, b) => a.patientName.localeCompare(b.patientName)),
    dateRange: {
      earliest: allDates[0] || '',
      latest: allDates[allDates.length - 1] || '',
    },
    uploadSummary: {
      totalMeasures: phq9Count + gad7Count,
      phq9Count,
      gad7Count,
      patientCount: new Set(summaries.map(s => s.patientId)).size,
    },
  }
}
