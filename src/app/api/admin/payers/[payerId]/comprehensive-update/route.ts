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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ payerId: string }> }
) {
  try {
    const body: ComprehensiveUpdateRequest = await request.json()

    // Validate required audit note
    if (!body.note?.trim()) {
      return NextResponse.json(
        { error: 'Audit note is required' },
        { status: 400 }
      )
    }

    const { payerId } = await params
    console.log('🔍 Comprehensive update for payer:', body.isNewPayer ? 'NEW' : payerId)

    // Mock user ID for now
    const mockUserId = 'admin-user-id'

    // Start transaction logic
    let payerResult: any
    let auditEntries: any[] = []

    if (body.isNewPayer) {
      // This route is for updates only, redirect new payers to the create route
      return NextResponse.json(
        { error: 'Use the create route for new payers' },
        { status: 400 }
      )
    } else {
      // Update existing payer
      const { data: currentPayer, error: fetchError } = await supabase
        .from('payers')
        .select('*')
        .eq('id', payerId)
        .single()

      if (fetchError || !currentPayer) {
        return NextResponse.json(
          { error: 'Payer not found' },
          { status: 404 }
        )
      }

      // Prepare update data
      const updateData: any = {
        updated_at: new Date().toISOString()
      }

      Object.keys(body.payerData).forEach(key => {
        if (body.payerData[key] !== currentPayer[key]) {
          updateData[key] = body.payerData[key]
        }
      })

      if (Object.keys(updateData).length > 1) { // More than just updated_at
        const { data: updatedPayer, error: updateError } = await supabase
          .from('payers')
          .update(updateData)
          .eq('id', payerId)
          .select()
          .single()

        if (updateError) {
          console.error('❌ Payer update error:', updateError)
          return NextResponse.json(
            { error: 'Failed to update payer' },
            { status: 500 }
          )
        }

        payerResult = updatedPayer
        auditEntries.push({
          actorUserId: mockUserId,
          action: 'update_payer' as const,
          entity: 'payers' as const,
          entityId: payerId,
          before: currentPayer,
          after: updatedPayer,
          note: body.note
        })
      } else {
        payerResult = currentPayer
      }
    }

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
        note: `Contract created as part of payer update: ${body.note}`
      })
    }

    // Handle contract updates
    for (const contractUpdate of body.contractUpdates) {
      if (!contractUpdate.id) continue

      console.log('📝 Updating contract:', contractUpdate.id)

      const { data: currentContract, error: fetchContractError } = await supabase
        .from('provider_payer_networks')
        .select('*')
        .eq('id', contractUpdate.id)
        .single()

      if (fetchContractError) {
        console.error('❌ Error fetching contract:', fetchContractError)
        continue
      }

      const contractUpdateData: any = {
        updated_at: new Date().toISOString()
      }

      // Only update fields that have changed
      const fieldsToCheck = ['effective_date', 'expiration_date', 'status', 'billing_provider_id']
      fieldsToCheck.forEach(field => {
        if (contractUpdate[field] !== currentContract[field]) {
          contractUpdateData[field] = contractUpdate[field]
        }
      })

      if (Object.keys(contractUpdateData).length > 1) { // More than just updated_at
        const { data: updatedContract, error: updateContractError } = await supabase
          .from('provider_payer_networks')
          .update(contractUpdateData)
          .eq('id', contractUpdate.id)
          .select()
          .single()

        if (updateContractError) {
          console.error('❌ Error updating contract:', updateContractError)
          continue
        }

        auditEntries.push({
          actorUserId: mockUserId,
          action: 'update_contract' as const,
          entity: 'provider_payer_networks' as const,
          entityId: contractUpdate.id,
          before: currentContract,
          after: updatedContract,
          note: `Contract updated as part of payer update: ${body.note}`
        })
      }
    }

    // Log all audit entries
    for (const entry of auditEntries) {
      await logAdminAudit(entry)
    }

    console.log(`✅ Comprehensive update completed: ${auditEntries.length} changes made`)

    return NextResponse.json({
      success: true,
      payer: payerResult,
      changes: auditEntries.length,
      message: `Successfully ${body.isNewPayer ? 'created' : 'updated'} payer and ${body.newContracts.length + body.contractUpdates.length} contracts`
    })

  } catch (error) {
    console.error('❌ Comprehensive update error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}