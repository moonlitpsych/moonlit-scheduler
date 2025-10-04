import { NextResponse } from 'next/server'
import { intakeQService } from '@/lib/services/intakeQService'

export async function GET() {
  try {
    const services = await intakeQService.listServices()

    return NextResponse.json({
      success: true,
      services,
      count: services.length
    })

  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    )
  }
}
