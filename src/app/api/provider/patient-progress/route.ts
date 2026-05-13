import { NextRequest, NextResponse } from 'next/server'
import { resolveProviderForRequest } from './_resolveProvider'
import { getPatientProgressData } from '@/lib/services/patientProgressService'
import type { MeasureType } from '@/lib/outcome-measures'

export const maxDuration = 60

export async function GET(request: NextRequest) {
  const resolved = await resolveProviderForRequest(request)
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status })
  }

  try {
    const { searchParams } = new URL(request.url)
    const measureType = searchParams.get('measureType') as MeasureType | null
    const data = await getPatientProgressData({
      providerId: resolved.providerId,
      measureType: measureType && measureType !== 'all' ? measureType : null,
    })
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error loading provider patient progress:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
