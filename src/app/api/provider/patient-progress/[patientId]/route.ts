import { NextRequest, NextResponse } from 'next/server'
import { resolveProviderForRequest, isPatientInPanel } from '../_resolveProvider'
import { supabaseAdmin } from '@/lib/supabase'
import type { MeasureType, SeverityLevel } from '@/lib/outcome-measures'

export const maxDuration = 30

export interface PatientAssessment {
  id: string
  date: string
  measureType: MeasureType
  totalScore: number
  severity: SeverityLevel
  practitioner: string | null
  questionResponses: Array<{ questionNumber: number; responseText: string; score: number }> | null
}

export interface PatientDetailResponse {
  patientId: string
  patientName: string
  assessments: PatientAssessment[]
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ patientId: string }> }
) {
  const resolved = await resolveProviderForRequest(request)
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status })
  }

  try {
    const { patientId } = await params
    if (!(await isPatientInPanel(resolved.providerId, patientId))) {
      return NextResponse.json({ error: 'Patient not in your panel' }, { status: 403 })
    }

    const [{ data: patient }, { data: measures, error: measuresErr }] = await Promise.all([
      supabaseAdmin
        .from('patients')
        .select('id, first_name, last_name')
        .eq('id', patientId)
        .maybeSingle(),
      supabaseAdmin
        .from('outcome_measures')
        .select('id, administered_date, measure_type, total_score, severity, practitioner, question_responses')
        .eq('patient_id', patientId)
        .order('administered_date', { ascending: true }),
    ])
    if (measuresErr) throw new Error(measuresErr.message)

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    const assessments: PatientAssessment[] = (measures || []).map(m => ({
      id: m.id,
      date: m.administered_date,
      measureType: m.measure_type as MeasureType,
      totalScore: m.total_score,
      severity: m.severity as SeverityLevel,
      practitioner: m.practitioner,
      questionResponses: (m.question_responses as PatientAssessment['questionResponses']) || null,
    }))

    const payload: PatientDetailResponse = {
      patientId,
      patientName: `${patient.last_name || ''}, ${patient.first_name || ''}`.trim().replace(/^,\s*/, ''),
      assessments,
    }
    return NextResponse.json(payload)
  } catch (error) {
    console.error('Error loading patient progress detail:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
