import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { resolveProviderForRequest } from '../_resolveProvider'
import { getPatientProgressData } from '@/lib/services/patientProgressService'
import { supabaseAdmin } from '@/lib/supabase'
import type { MeasureType } from '@/lib/outcome-measures'
import { OutcomesReport } from './OutcomesReport'

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

export async function GET(request: NextRequest) {
  const resolved = await resolveProviderForRequest(request)
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status })
  }

  try {
    const measureType = new URL(request.url).searchParams.get('measureType') as MeasureType | null
    const data = await getPatientProgressData({
      providerId: resolved.providerId,
      measureType: measureType && measureType !== 'all' ? measureType : null,
    })

    if (data.patients.length === 0) {
      return NextResponse.json({ error: 'No outcomes data to export.' }, { status: 400 })
    }

    const { data: prov } = await supabaseAdmin
      .from('providers')
      .select('first_name, last_name, title')
      .eq('id', resolved.providerId)
      .maybeSingle()
    const providerName = prov
      ? `${prov.title ? prov.title + ' ' : ''}${prov.first_name || ''} ${prov.last_name || ''}`.trim()
      : 'Provider'

    const element = React.createElement(OutcomesReport, {
      data,
      providerName,
      measureFilter: measureType,
      generatedAt: new Date(),
      letterheadImage: loadLetterhead() || undefined,
    }) as Parameters<typeof renderToBuffer>[0]
    const buffer = await renderToBuffer(element)

    const today = new Date().toISOString().slice(0, 10)
    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="patient-progress-${today}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Error generating patient progress PDF:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
