import { NextRequest, NextResponse } from 'next/server'
import { resolveProviderForRequest } from '../_resolveProvider'
import { getPatientProgressData } from '@/lib/services/patientProgressService'
import { severityLabel } from '@/lib/outcome-measures'
import type { MeasureType } from '@/lib/outcome-measures'

export const maxDuration = 30

function escapeCsv(value: string | number): string {
  const s = String(value ?? '')
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export async function GET(request: NextRequest) {
  const resolved = await resolveProviderForRequest(request)
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status })
  }

  try {
    const measureRaw = new URL(request.url).searchParams.get('measureType')
    const measureType: MeasureType | null =
      measureRaw && measureRaw !== 'all' ? (measureRaw as MeasureType) : null
    const data = await getPatientProgressData({
      providerId: resolved.providerId,
      measureType,
    })

    if (data.patients.length === 0) {
      return new NextResponse('No data to export', { status: 404 })
    }

    const header = [
      'Patient',
      'Measure',
      'First Score',
      'First Severity',
      'First Date',
      'Last Score',
      'Last Severity',
      'Last Date',
      'Change',
      'Assessments',
      'Improved',
      'Response (50% reduction)',
      'Remission (< 5)',
    ]
    const rows = data.patients.map(p => {
      const first = p.scores[0]
      const last = p.scores[p.scores.length - 1]
      return [
        p.patientName,
        p.measureType,
        p.firstScore,
        severityLabel(first?.severity),
        first?.date || '',
        p.lastScore,
        severityLabel(last?.severity),
        last?.date || '',
        p.scoreChange,
        p.scores.length,
        p.scores.length >= 2 ? (p.improved ? 'Yes' : 'No') : '',
        p.scores.length >= 2 ? (p.responseAchieved ? 'Yes' : 'No') : '',
        p.scores.length >= 2 ? (p.remissionAchieved ? 'Yes' : 'No') : '',
      ].map(escapeCsv).join(',')
    })

    const csv = [header.join(','), ...rows].join('\n')
    const date = new Date().toISOString().slice(0, 10)
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="patient-progress-${date}.csv"`,
      },
    })
  } catch (error) {
    console.error('Error exporting provider patient progress:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
