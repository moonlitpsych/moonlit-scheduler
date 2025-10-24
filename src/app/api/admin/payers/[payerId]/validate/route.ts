import { NextRequest, NextResponse } from 'next/server'
import { payerSanityCheck } from '@/lib/services/payerSanityCheckServiceFixed'

interface ValidationRequest {
  payerUpdates: any
  providerContracts: any[]
  supervisionSetup: any[]
  effectiveDate?: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ payerId: string }> }
) {
  try {
    const { payerId } = await params
    const body: ValidationRequest = await request.json()

    console.log('🔍 Running validation for payer:', payerId)

    // Run comprehensive sanity checks
    const results = await payerSanityCheck.runAllChecks(
      payerId,
      body.effectiveDate || body.payerUpdates?.effective_date
    )

    // Generate summary report
    const report = payerSanityCheck.generateSummaryReport(results)
    console.log('📋 Validation Report:\n', report)

    return NextResponse.json(results)

  } catch (error: any) {
    console.error('❌ Validation error:', error)
    return NextResponse.json(
      {
        error: 'Failed to run validation',
        details: error.message
      },
      { status: 500 }
    )
  }
}