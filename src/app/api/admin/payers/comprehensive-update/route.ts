import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'
import { logAdminAudit } from '@/lib/services/auditService'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

interface ComprehensiveUpdateRequest {
  payerData: any
  contractUpdates: any[]
  newContracts: any[]
  contractDeletes: string[]
  isNewPayer: boolean
  note: string
}

export async function POST(request: NextRequest) {
  try {
    const body: ComprehensiveUpdateRequest = await request.json()

    // Validate required audit note
    if (!body.note?.trim()) {
      return NextResponse.json(
        { error: 'Audit note is required' },
        { status: 400 }
      )
    }

    console.log('🔍 Comprehensive update for payer:', body.isNewPayer ? 'NEW' : body.payerData.id)

    // Mock user ID for now
    const mockUserId = 'admin-user-id'

    // Start transaction logic
    let payerResult: any
    let auditEntries: any[] = []

    // Create new payer
    console.log('📝 Creating new payer:', body.payerData.name)

    const { data: newPayer, error: createError } = await supabase
      .from('payers')
      .insert({
        name: body.payerData.name,
        payer_type: body.payerData.payer_type,
        state: body.payerData.state,
        status_code: body.payerData.status_code,
        effective_date: body.payerData.effective_date,
        requires_attending: body.payerData.requires_attending,
        allows_supervised: body.payerData.allows_supervised,
        supervision_level: body.payerData.supervision_level,
        requires_individual_contract: body.payerData.requires_individual_contract
      })
      .select()
      .single()

    if (createError) {
      console.error('❌ Error creating payer:', createError)
      return NextResponse.json(
        { error: 'Failed to create payer' },
        { status: 500 }
      )
    }

    payerResult = newPayer
    auditEntries.push({
      actorUserId: mockUserId,
      action: 'create_payer' as const,
      entity: 'payers' as const,
      entityId: newPayer.id,
      before: null,
      after: newPayer,
      note: body.note
    })

    // Handle new contracts
    for (const newContract of body.newContracts) {
      if (!newContract.provider_id) {
        return NextResponse.json(
          { error: 'Provider is required for new contracts' },
          { status: 400 }
        )
      }

      console.log('📝 Creating new contract for provider:', newContract.provider_id)

      const { data: createdContract, error: contractError } = await supabase
        .from('provider_payer_networks')
        .insert({
          provider_id: newContract.provider_id,
          payer_id: payerResult.id,
          effective_date: newContract.effective_date,
          expiration_date: newContract.expiration_date,
          status: newContract.status || 'active',
          billing_provider_id: newContract.billing_provider_id
        })
        .select()
        .single()

      if (contractError) {
        console.error('❌ Error creating contract:', contractError)
        return NextResponse.json(
          { error: 'Failed to create provider contract' },
          { status: 500 }
        )
      }

      auditEntries.push({
        actorUserId: mockUserId,
        action: 'create_contract' as const,
        entity: 'provider_payer_networks' as const,
        entityId: createdContract.id,
        before: null,
        after: createdContract,
        note: `Contract created as part of payer creation: ${body.note}`
      })
    }

    // Log all audit entries
    for (const entry of auditEntries) {
      await logAdminAudit(entry)
    }

    console.log(`✅ Comprehensive payer creation completed: ${auditEntries.length} changes made`)

    return NextResponse.json({
      success: true,
      payer: payerResult,
      changes: auditEntries.length,
      message: `Successfully created payer and ${body.newContracts.length} contracts`
    })

  } catch (error) {
    console.error('❌ Comprehensive update error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}