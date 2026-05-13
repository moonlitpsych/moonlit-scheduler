import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { resolveProviderForRequest } from '../../_resolveProvider'
import { supabaseAdmin } from '@/lib/supabase'
import type { MeasureType, SeverityLevel } from '@/lib/outcome-measures'
import { PatientReport } from './PatientReport'

export const runtime = 'nodejs'
export const maxDuration = 60

let letterheadBuffer: Buffer | null = null
function loadLetterhead(): Buffer | null {
  if (letterheadBuffer) return letterheadBuffer
  try {
    letterheadBuffer = fs.readFileSync(path.join(process.cwd(), 'public/letterhead-moonlit.png'))
    return letterheadBuffer
  } catch {
    return null
  }
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

    // Authorize: patient must be in this provider's panel.
    const { data: apptCheck } = await supabaseAdmin
      .from('appointments')
      .select('id')
      .eq('provider_id', resolved.providerId)
      .eq('patient_id', patientId)
      .limit(1)
    if (!apptCheck || apptCheck.length === 0) {
      return NextResponse.json({ error: 'Patient not in your panel' }, { status: 403 })
    }

    const [{ data: patient }, { data: measures }] = await Promise.all([
      supabaseAdmin
        .from('patients')
        .select('first_name, last_name')
        .eq('id', patientId)
        .maybeSingle(),
      supabaseAdmin
        .from('outcome_measures')
        .select('id, administered_date, measure_type, total_score, severity')
        .eq('patient_id', patientId)
        .order('administered_date', { ascending: true }),
    ])

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }
    if (!measures || measures.length === 0) {
      return NextResponse.json({ error: 'No assessments to export for this patient.' }, { status: 400 })
    }

    const patientName = `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || 'Patient'
    const assessments = measures.map(m => ({
      id: m.id,
      date: m.administered_date as string,
      measureType: m.measure_type as MeasureType,
      totalScore: m.total_score as number,
      severity: m.severity as SeverityLevel,
    }))

    const element = React.createElement(PatientReport, {
      patientName,
      assessments,
      generatedAt: new Date(),
      letterheadImage: loadLetterhead() || undefined,
    }) as Parameters<typeof renderToBuffer>[0]
    const buffer = await renderToBuffer(element)

    const slug = patientName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const today = new Date().toISOString().slice(0, 10)
    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="progress-${slug}-${today}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Error generating patient progress PDF:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
