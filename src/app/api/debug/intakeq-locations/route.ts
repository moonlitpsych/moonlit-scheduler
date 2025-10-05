import { NextResponse } from 'next/server'
import { intakeQService } from '@/lib/services/intakeQService'

export async function GET() {
  try {
    const settings = await intakeQService.getBookingSettings()
    return NextResponse.json({
      success: true,
      locations: settings.locations,
      services: settings.services,
      practitioners: settings.practitioners
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
