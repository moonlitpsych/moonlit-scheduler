import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'
import { logAdminAudit } from '@/lib/services/auditService'
import { payerSanityCheck } from '@/lib/services/payerSanityCheckServiceFixed'
import { PracticeQMapping } from '@/components/admin/PracticeQMappingForm'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

interface SupervisionSetup {
  resident_id: string
  resident_name: string
  attending_id: string
  attending_name: string
  supervision_type: string
  start_date: string
}

interface ProviderContract {
  provider_id: string
  effective_date: string | null
  expiration_date: string | null
  status: string
}

interface ServiceInstance {
  id?: string
  service_id: string
  location: string
  pos_code: string
  active: boolean
}

interface CreateWithContractRequest {
  payerUpdates: {
    name?: string
    payer_type?: string
    state?: string
    status_code?: string
    effective_date?: string | null
    allows_supervised?: boolean
    supervision_level?: string | null
    requires_attending?: boolean
    requires_individual_contract?: boolean
    intakeq_location_id?: string | null
  }
  providerContracts: ProviderContract[]
  supervisionSetup: SupervisionSetup[]
  serviceInstances?: ServiceInstance[]
  practiceQMapping: PracticeQMapping | null
  auditNote: string
  runValidation?: boolean
}

export async function POST(request: NextRequest) {
  console.log('🚀 Creating new payer with contract')

  try {
    const body: CreateWithContractRequest = await request.json()

    if (!body.auditNote?.trim()) {
      return NextResponse.json(
        { error: 'Audit note is required for compliance' },
        { status: 400 }
      )
    }

    if (!body.payerUpdates?.name || !body.payerUpdates?.payer_type) {
      return NextResponse.json(
        { error: 'Payer name and type are required to create a new payer' },
        { status: 400 }
      )
    }

    const auditEntries: any[] = []
    const results = {
      payerCreated: false,
      contractsCreated: 0,
      contractsUpdated: 0,
      supervisionCreated: 0,
      serviceInstancesCreated: 0,
      serviceInstancesUpdated: 0,
      serviceInstancesDeleted: 0,
      practiceQMapped: false,
      validationResults: null as any,
      warnings: [] as string[]
    }

    // 1. CREATE PAYER
    const { data: createdPayer, error: createError } = await supabase
      .from('payers')
      .insert({
        name: body.payerUpdates.name,
        payer_type: body.payerUpdates.payer_type,
        state: body.payerUpdates.state || null,
        status_code: body.payerUpdates.status_code || null,
        effective_date: body.payerUpdates.effective_date || null,
        allows_supervised: body.payerUpdates.allows_supervised || false,
        supervision_level: body.payerUpdates.supervision_level || null,
        requires_attending: body.payerUpdates.requires_attending || false,
        requires_individual_contract: body.payerUpdates.requires_individual_contract || false,
        intakeq_location_id: body.payerUpdates.intakeq_location_id || null
      })
      .select()
      .single()

    if (createError || !createdPayer) {
      console.error('❌ Failed to create payer:', createError)
      return NextResponse.json(
        { error: 'Failed to create payer', details: createError?.message },
        { status: 500 }
      )
    }

    const payerId = createdPayer.id
    results.payerCreated = true
    auditEntries.push({
      actorUserId: 'admin',
      action: 'create_payer',
      entity: 'payers',
      entityId: payerId,
      before: null,
      after: createdPayer,
      note: `Payer created: ${body.auditNote}`
    })

    // 2. CREATE PROVIDER CONTRACTS
    for (const contract of body.providerContracts) {
      const { data: created, error: contractError } = await supabase
        .from('provider_payer_networks')
        .insert({
          provider_id: contract.provider_id,
          payer_id: payerId,
          effective_date: contract.effective_date,
          expiration_date: contract.expiration_date,
          status: contract.status || 'in_network',
          notes: `Created via new payer application: ${body.auditNote}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (contractError) {
        console.error('❌ Failed to create contract:', contractError)
        results.warnings.push(`Failed to create contract for provider ${contract.provider_id}`)
      } else {
        results.contractsCreated++
        auditEntries.push({
          actorUserId: 'admin',
          action: 'create_provider_contract',
          entity: 'provider_payer_networks',
          entityId: created.id,
          before: null,
          after: created,
          note: `Contract created via new payer: ${body.auditNote}`
        })
      }
    }

    // 3. CREATE SUPERVISION RELATIONSHIPS
    if (body.supervisionSetup.length > 0 && body.payerUpdates.allows_supervised) {
      for (const supervision of body.supervisionSetup) {
        const { data: created, error: supervisionError } = await supabase
          .from('supervision_relationships')
          .insert({
            payer_id: payerId,
            supervisor_provider_id: supervision.attending_id,
            supervisee_provider_id: supervision.resident_id,
            supervision_type: supervision.supervision_type,
            start_date: supervision.start_date,
            is_active: true,
            supervision_level: body.payerUpdates.supervision_level || 'sign_off_only',
            notes: `Created via new payer application: ${body.auditNote}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single()

        if (supervisionError) {
          console.error('❌ Failed to create supervision:', supervisionError)
          results.warnings.push(
            `Failed to create supervision for ${supervision.resident_name} under ${supervision.attending_name}`
          )
        } else {
          results.supervisionCreated++
          auditEntries.push({
            actorUserId: 'admin',
            action: 'create_supervision',
            entity: 'supervision_relationships',
            entityId: created.id,
            before: null,
            after: created,
            note: `Supervision created via new payer: ${body.auditNote}`
          })
        }
      }
    }

    // 4. CREATE SERVICE INSTANCES
    if (body.serviceInstances && body.serviceInstances.length > 0) {
      for (const instance of body.serviceInstances) {
        if (!instance.service_id) continue

        const { data: created, error: instanceError } = await supabase
          .from('service_instances')
          .insert({
            payer_id: payerId,
            service_id: instance.service_id,
            location: instance.location,
            pos_code: instance.pos_code,
            active: instance.active,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single()

        if (instanceError) {
          console.error('❌ Failed to create service instance:', instanceError)
          results.warnings.push(`Failed to create service instance for service ${instance.service_id}`)
        } else {
          results.serviceInstancesCreated++
          auditEntries.push({
            actorUserId: 'admin',
            action: 'create_service_instance',
            entity: 'service_instances',
            entityId: created.id,
            before: null,
            after: created,
            note: `Service instance created via new payer: ${body.auditNote}`
          })
        }
      }
    }

    // 5. STORE PRACTICEQ MAPPING
    if (body.practiceQMapping) {
      const mappingsToInsert: any[] = [
        {
          payer_id: payerId,
          system: 'practiceq',
          key_name: 'insurance_company_name',
          value: body.practiceQMapping.insurance_company_name
        },
        {
          payer_id: payerId,
          system: 'practiceq',
          key_name: 'payer_code',
          value: body.practiceQMapping.payer_code
        }
      ]

      body.practiceQMapping.aliases.forEach((alias, index) => {
        mappingsToInsert.push({
          payer_id: payerId,
          system: 'practiceq',
          key_name: `alias_${index + 1}`,
          value: alias
        })
      })

      const { error: mappingError } = await supabase
        .from('payer_external_mappings')
        .insert(mappingsToInsert)

      if (mappingError) {
        console.error('❌ Failed to store PracticeQ mappings:', mappingError)
        results.warnings.push('Failed to store PracticeQ configuration')
      } else {
        results.practiceQMapped = true
        auditEntries.push({
          actorUserId: 'admin',
          action: 'configure_practiceq',
          entity: 'payer_external_mappings',
          entityId: payerId,
          before: null,
          after: body.practiceQMapping,
          note: `PracticeQ configured: ${body.auditNote}`
        })
      }
    }

    // 6. RUN SANITY CHECKS
    if (body.runValidation !== false) {
      try {
        const validationResults = await payerSanityCheck.runAllChecks(
          payerId,
          body.payerUpdates.effective_date
        )
        results.validationResults = validationResults
      } catch (e: any) {
        console.warn('⚠️ Sanity checks failed:', e?.message)
      }
    }

    // 7. LOG AUDIT ENTRIES
    for (const entry of auditEntries) {
      try {
        await logAdminAudit(entry)
      } catch (error) {
        console.error('⚠️ Failed to log audit entry:', error)
      }
    }

    const summary = {
      success: true,
      message: 'Payer created successfully',
      payerId,
      results: {
        ...results,
        totalChanges: auditEntries.length,
        auditNote: body.auditNote
      },
      timestamp: new Date().toISOString()
    }

    console.log('✅ Payer creation completed:', summary)

    return NextResponse.json(summary)
  } catch (error: any) {
    console.error('❌ Create-with-contract error:', error)
    return NextResponse.json(
      {
        error: 'Failed to create payer with contract',
        details: error.message || 'Unknown error occurred'
      },
      { status: 500 }
    )
  }
}
