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

interface ApplyContractRequest {
  payerUpdates: {
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ payerId: string }> }
) {
  const { payerId } = await params
  console.log('🚀 Applying comprehensive contract for payer:', payerId)

  try {
    const body: ApplyContractRequest = await request.json()

    // Validate required fields
    if (!body.auditNote?.trim()) {
      return NextResponse.json(
        { error: 'Audit note is required for compliance' },
        { status: 400 }
      )
    }

    // Track all changes for audit
    const auditEntries: any[] = []
    const results = {
      payerUpdated: false,
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

    // Begin transaction-like operations
    // Note: Supabase doesn't support true transactions via REST API,
    // but we'll track all operations and can manually rollback if needed

    // 1. UPDATE PAYER
    if (Object.keys(body.payerUpdates).length > 0) {
      console.log('📝 Updating payer configuration...')

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

      const updateData: any = {
        ...body.payerUpdates,
        updated_at: new Date().toISOString()
      }

      const { data: updatedPayer, error: updateError } = await supabase
        .from('payers')
        .update(updateData)
        .eq('id', payerId)
        .select()
        .single()

      if (updateError) {
        console.error('❌ Failed to update payer:', updateError)
        return NextResponse.json(
          { error: 'Failed to update payer configuration', details: updateError },
          { status: 500 }
        )
      }

      results.payerUpdated = true
      auditEntries.push({
        actorUserId: 'admin', // TODO: Get actual user ID from session
        action: 'update_payer_contract',
        entity: 'payers',
        entityId: payerId,
        before: currentPayer,
        after: updatedPayer,
        note: `Contract application: ${body.auditNote}`
      })
    }

    // 2. CREATE/UPDATE PROVIDER CONTRACTS
    for (const contract of body.providerContracts) {
      console.log('📝 Processing provider contract:', contract.provider_id)

      // Check if contract already exists
      const { data: existing } = await supabase
        .from('provider_payer_networks')
        .select('*')
        .eq('provider_id', contract.provider_id)
        .eq('payer_id', payerId)
        .single()

      if (existing) {
        // Update existing contract
        const { data: updated, error: updateError } = await supabase
          .from('provider_payer_networks')
          .update({
            effective_date: contract.effective_date,
            expiration_date: contract.expiration_date,
            status: contract.status || 'in_network',
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
          .select()
          .single()

        if (updateError) {
          console.error('❌ Failed to update contract:', updateError)
          results.warnings.push(`Failed to update contract for provider ${contract.provider_id}`)
        } else {
          results.contractsUpdated++
          auditEntries.push({
            actorUserId: 'admin',
            action: 'update_provider_contract',
            entity: 'provider_payer_networks',
            entityId: existing.id,
            before: existing,
            after: updated,
            note: `Contract update via payer application: ${body.auditNote}`
          })
        }
      } else {
        // Create new contract
        const { data: created, error: createError } = await supabase
          .from('provider_payer_networks')
          .insert({
            provider_id: contract.provider_id,
            payer_id: payerId,
            effective_date: contract.effective_date,
            expiration_date: contract.expiration_date,
            status: contract.status || 'in_network',
            notes: `Created via contract application: ${body.auditNote}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single()

        if (createError) {
          console.error('❌ Failed to create contract:', createError)
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
            note: `Contract creation via payer application: ${body.auditNote}`
          })
        }
      }
    }

    // 3. MANAGE SUPERVISION RELATIONSHIPS (CREATE, UPDATE, DELETE)
    // First, handle deletions - get existing relationships and delete any not in the new list
    const { data: existingSupervision } = await supabase
      .from('supervision_relationships')
      .select('*')
      .eq('payer_id', payerId)

    if (existingSupervision && existingSupervision.length > 0) {
      console.log(`📋 Found ${existingSupervision.length} existing supervision relationships`)

      // Find relationships to delete (exist in DB but not in new list)
      for (const existing of existingSupervision) {
        const stillExists = body.supervisionSetup.find(
          s => s.attending_id === existing.supervisor_provider_id &&
               s.resident_id === existing.supervisee_provider_id
        )

        if (!stillExists) {
          console.log(`🗑️ Deleting supervision: ${existing.supervisee_provider_id} → ${existing.supervisor_provider_id}`)
          const { error: deleteError } = await supabase
            .from('supervision_relationships')
            .delete()
            .eq('id', existing.id)

          if (!deleteError) {
            results.supervisionDeleted = (results.supervisionDeleted || 0) + 1
            auditEntries.push({
              actorUserId: 'admin',
              action: 'delete_supervision',
              entity: 'supervision_relationships',
              entityId: existing.id,
              before: existing,
              after: null,
              note: `Supervision deleted via payer contract: ${body.auditNote}`
            })
          }
        }
      }
    }

    // Now create/update relationships from the new list
    if (body.supervisionSetup.length > 0 && body.payerUpdates.allows_supervised) {
      console.log(`📝 Processing ${body.supervisionSetup.length} supervision relationships...`)

      for (const supervision of body.supervisionSetup) {
        // Check if relationship already exists
        const { data: existing } = await supabase
          .from('supervision_relationships')
          .select('*')
          .eq('supervisor_provider_id', supervision.attending_id)
          .eq('supervisee_provider_id', supervision.resident_id)
          .eq('payer_id', payerId)
          .single()

        if (existing) {
          // Update existing relationship if needed
          const { data: updated, error: updateError } = await supabase
            .from('supervision_relationships')
            .update({
              supervision_type: supervision.supervision_type,
              start_date: supervision.start_date,
              is_active: true,
              supervision_level: body.payerUpdates.supervision_level || 'sign_off_only',
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id)
            .select()
            .single()

          if (!updateError) {
            auditEntries.push({
              actorUserId: 'admin',
              action: 'update_supervision',
              entity: 'supervision_relationships',
              entityId: existing.id,
              before: existing,
              after: updated,
              note: `Supervision update via payer contract: ${body.auditNote}`
            })
          }
        } else {
          // Create new supervision relationship
          // Use the correct column names from the actual database schema
          const supervisionData: any = {
            payer_id: payerId,
            supervisor_provider_id: supervision.attending_id,
            supervisee_provider_id: supervision.resident_id,
            supervision_type: supervision.supervision_type,
            start_date: supervision.start_date,
            is_active: true,
            supervision_level: body.payerUpdates.supervision_level || 'sign_off_only',
            notes: `Created via contract application: ${body.auditNote}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }

          const { data: created, error: createError } = await supabase
            .from('supervision_relationships')
            .insert(supervisionData)
            .select()
            .single()

          if (createError) {
            console.error('❌ Failed to create supervision:', createError)
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
              note: `Supervision created via payer contract: ${body.auditNote}`
            })
          }
        }
      }
    }

    // 4. MANAGE SERVICE INSTANCES (CREATE, UPDATE, DELETE)
    if (body.serviceInstances && body.serviceInstances.length >= 0) {
      console.log(`📦 Processing service instances...`)

      // First, get existing service instances
      const { data: existingInstances } = await supabase
        .from('service_instances')
        .select('*')
        .eq('payer_id', payerId)

      if (existingInstances && existingInstances.length > 0) {
        console.log(`📋 Found ${existingInstances.length} existing service instances`)

        // Find instances to delete (exist in DB but not in new list)
        for (const existing of existingInstances) {
          const stillExists = body.serviceInstances.find(
            si => si.id === existing.id ||
                  (si.service_id === existing.service_id &&
                   si.location === existing.location &&
                   si.pos_code === existing.pos_code)
          )

          if (!stillExists) {
            console.log(`🗑️ Deleting service instance: ${existing.id}`)
            const { error: deleteError } = await supabase
              .from('service_instances')
              .delete()
              .eq('id', existing.id)

            if (!deleteError) {
              results.serviceInstancesDeleted++
              auditEntries.push({
                actorUserId: 'admin',
                action: 'delete_service_instance',
                entity: 'service_instances',
                entityId: existing.id,
                before: existing,
                after: null,
                note: `Service instance deleted via payer contract: ${body.auditNote}`
              })
            }
          }
        }
      }

      // Now create/update service instances from the new list
      for (const instance of body.serviceInstances) {
        if (!instance.service_id) continue

        // Check if instance already exists
        const { data: existing } = await supabase
          .from('service_instances')
          .select('*')
          .eq('service_id', instance.service_id)
          .eq('payer_id', payerId)
          .eq('location', instance.location)
          .eq('pos_code', instance.pos_code)
          .maybeSingle()

        if (existing) {
          // Update existing instance
          const { data: updated, error: updateError } = await supabase
            .from('service_instances')
            .update({
              active: instance.active,
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id)
            .select()
            .single()

          if (!updateError) {
            results.serviceInstancesUpdated++
            auditEntries.push({
              actorUserId: 'admin',
              action: 'update_service_instance',
              entity: 'service_instances',
              entityId: existing.id,
              before: existing,
              after: updated,
              note: `Service instance update via payer contract: ${body.auditNote}`
            })
          } else {
            console.error('❌ Failed to update service instance:', updateError)
            results.warnings.push(`Failed to update service instance for service ${instance.service_id}`)
          }
        } else {
          // Create new service instance
          const instanceData = {
            payer_id: payerId,
            service_id: instance.service_id,
            location: instance.location,
            pos_code: instance.pos_code,
            active: instance.active,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }

          const { data: created, error: createError } = await supabase
            .from('service_instances')
            .insert(instanceData)
            .select()
            .single()

          if (createError) {
            console.error('❌ Failed to create service instance:', createError)
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
              note: `Service instance created via payer contract: ${body.auditNote}`
            })
          }
        }
      }
    }

    // 5. STORE PRACTICEQ MAPPING
    if (body.practiceQMapping) {
      console.log('📝 Storing PracticeQ mappings...')

      // Delete any existing mappings for this payer
      await supabase
        .from('payer_external_mappings')
        .delete()
        .eq('payer_id', payerId)
        .eq('system', 'practiceq')

      // Insert new mappings
      const mappingsToInsert = [
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

      // Add aliases
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

      // Optionally backfill patient policies with PracticeQ code
      if (body.practiceQMapping.payer_code) {
        const { error: backfillError } = await supabase
          .from('patient_insurance_policies')
          .update({
            pq_carrier_id: body.practiceQMapping.payer_code,
            updated_at: new Date().toISOString()
          })
          .eq('payer_id', payerId)
          .is('pq_carrier_id', null)

        if (backfillError) {
          console.warn('⚠️ Failed to backfill patient policies:', backfillError)
          results.warnings.push('Failed to backfill existing patient insurance policies')
        }
      }
    }

    // 6. RUN SANITY CHECKS
    if (body.runValidation !== false) {
      console.log('🔍 Running sanity checks...')
      const validationResults = await payerSanityCheck.runAllChecks(
        payerId,
        body.payerUpdates.effective_date
      )
      results.validationResults = validationResults

      // Add validation summary to audit
      if (validationResults.hasErrors || validationResults.hasWarnings) {
        auditEntries.push({
          actorUserId: 'admin',
          action: 'validation_check',
          entity: 'payers',
          entityId: payerId,
          before: null,
          after: {
            hasErrors: validationResults.hasErrors,
            hasWarnings: validationResults.hasWarnings,
            errorCount: validationResults.validations.filter(v => v.level === 'error').length,
            warningCount: validationResults.validations.filter(v => v.level === 'warning').length
          },
          note: `Validation performed: ${body.auditNote}`
        })
      }
    }

    // 7. LOG ALL AUDIT ENTRIES
    for (const entry of auditEntries) {
      try {
        await logAdminAudit(entry)
      } catch (error) {
        console.error('⚠️ Failed to log audit entry:', error)
        // Don't fail the whole operation for audit logging failure
      }
    }

    // Generate summary
    const summary = {
      success: true,
      message: 'Contract application completed successfully',
      results: {
        ...results,
        totalChanges: auditEntries.length,
        auditNote: body.auditNote
      },
      timestamp: new Date().toISOString()
    }

    console.log('✅ Contract application completed:', summary)

    return NextResponse.json(summary)

  } catch (error: any) {
    console.error('❌ Contract application error:', error)
    return NextResponse.json(
      {
        error: 'Failed to apply contract',
        details: error.message || 'Unknown error occurred'
      },
      { status: 500 }
    )
  }
}