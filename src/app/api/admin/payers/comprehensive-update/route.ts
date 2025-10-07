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

    // Auto-create service instances for new payer
    console.log('📦 Auto-creating service instances for new payer...')
    const defaultServices = [
      {
        name: 'Intake',
        serviceId: 'f0a05d4c-188a-4f1b-9600-54d6c27a3f62',
        intakeqId: '137bcec9-6d59-4cd8-910f-a1d9c0616319'
      },
      {
        name: 'Follow-up (Short)',
        serviceId: '4b6e81ed-e30e-4127-ba71-21aa9fac8cd1',
        intakeqId: '436ebccd-7e5b-402d-9f13-4c5733e3af8c'
      },
      {
        name: 'Follow-up (Extended)',
        serviceId: 'a6cdf789-41f7-484d-a948-272547eb566e',
        intakeqId: 'f0490d0a-992f-4f14-836f-0e41e11be14d'
      }
    ]

    for (const service of defaultServices) {
      // Create service_instance
      const { data: instance, error: instanceError } = await supabase
        .from('service_instances')
        .insert({
          service_id: service.serviceId,
          payer_id: newPayer.id
        })
        .select()
        .single()

      if (instanceError) {
        console.error(`❌ Failed to create ${service.name} instance:`, instanceError)
        continue
      }

      console.log(`✅ Created ${service.name} service instance: ${instance.id}`)

      // Create IntakeQ integration mapping
      const { error: integrationError } = await supabase
        .from('service_instance_integrations')
        .insert({
          service_instance_id: instance.id,
          system: 'intakeq',
          external_id: service.intakeqId
        })

      if (integrationError) {
        console.error(`❌ Failed to create IntakeQ mapping for ${service.name}:`, integrationError)
      } else {
        console.log(`✅ Created IntakeQ mapping for ${service.name}`)
      }

      // Log to audit trail
      auditEntries.push({
        actorUserId: mockUserId,
        action: 'create_service_instance' as any,
        entity: 'service_instances' as any,
        entityId: instance.id,
        before: null,
        after: instance,
        note: `Auto-created ${service.name} service instance for new payer`
      })
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
          status: newContract.status || 'in_network',
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