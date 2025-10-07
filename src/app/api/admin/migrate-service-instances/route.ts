/**
 * API endpoint to execute service instances migration
 * Implements dry-run mode for safety
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { dryRun = true } = body

        const results = {
            dryRun,
            steps: [] as any[],
            errors: [] as string[]
        }

        // Step 1: Check for duplicates (skip for now)
        results.steps.push({
            step: 'duplicate_check',
            message: 'Skipped - will be prevented by UNIQUE constraint'
        })

        // Step 2: Find payers that need service instances
        const { data: payersNeedingInstances, error: payersError } = await supabaseAdmin
            .from('payers')
            .select(`
                id,
                name,
                effective_date,
                status_code
            `)
            .not('effective_date', 'is', null)
            .in('status_code', ['approved', null])

        if (payersError) {
            results.errors.push(`Payers query failed: ${payersError.message}`)
            return NextResponse.json({ success: false, ...results }, { status: 500 })
        }

        // Filter to only those with contracts
        const payersWithContracts = []
        for (const payer of payersNeedingInstances) {
            const { data: contracts } = await supabaseAdmin
                .from('provider_payer_networks')
                .select('id')
                .eq('payer_id', payer.id)
                .limit(1)

            if (contracts && contracts.length > 0) {
                payersWithContracts.push(payer)
            }
        }

        results.steps.push({
            step: 'identify_payers',
            payersWithContracts: payersWithContracts.length,
            payers: payersWithContracts.map(p => ({ id: p.id, name: p.name }))
        })

        // Step 3: Check orphaned instances
        const { data: orphanedInstances, error: orphanError } = await supabaseAdmin
            .from('service_instances')
            .select('id')
            .is('payer_id', null)

        if (!orphanError) {
            results.steps.push({
                step: 'orphaned_instances',
                count: orphanedInstances?.length || 0
            })
        }

        if (dryRun) {
            results.steps.push({
                step: 'dry_run_summary',
                message: 'This is a DRY RUN. No changes were made.',
                wouldCreate: {
                    serviceInstances: payersWithContracts.length * 3,
                    integrations: payersWithContracts.length * 3
                },
                wouldDelete: {
                    orphanedInstances: orphanedInstances?.length || 0
                }
            })

            return NextResponse.json({ success: true, ...results })
        }

        // ACTUAL EXECUTION MODE
        let instancesCreated = 0
        let integrationsCreated = 0

        // Service definitions
        const services = [
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

        for (const payer of payersWithContracts) {
            for (const service of services) {
                // Check if instance already exists
                const { data: existing } = await supabaseAdmin
                    .from('service_instances')
                    .select('id')
                    .eq('payer_id', payer.id)
                    .eq('service_id', service.serviceId)
                    .maybeSingle()

                if (!existing) {
                    // Create service instance
                    const { data: newInstance, error: instanceError } = await supabaseAdmin
                        .from('service_instances')
                        .insert({
                            service_id: service.serviceId,
                            payer_id: payer.id
                        })
                        .select('id')
                        .single()

                    if (instanceError) {
                        results.errors.push(`Failed to create ${service.name} for ${payer.name}: ${instanceError.message}`)
                        continue
                    }

                    instancesCreated++

                    // Create IntakeQ integration
                    const { error: integrationError } = await supabaseAdmin
                        .from('service_instance_integrations')
                        .insert({
                            service_instance_id: newInstance.id,
                            system: 'intakeq',
                            external_id: service.intakeqId
                        })

                    if (integrationError) {
                        results.errors.push(`Failed to create IntakeQ mapping for ${service.name} / ${payer.name}: ${integrationError.message}`)
                    } else {
                        integrationsCreated++
                    }
                }
            }
        }

        // Delete orphaned instances
        const { error: deleteIntegrationsError } = await supabaseAdmin
            .from('service_instance_integrations')
            .delete()
            .in('service_instance_id', orphanedInstances.map(i => i.id))

        if (deleteIntegrationsError) {
            results.errors.push(`Failed to delete orphaned integrations: ${deleteIntegrationsError.message}`)
        }

        const { error: deleteInstancesError } = await supabaseAdmin
            .from('service_instances')
            .delete()
            .is('payer_id', null)

        if (deleteInstancesError) {
            results.errors.push(`Failed to delete orphaned instances: ${deleteInstancesError.message}`)
        }

        results.steps.push({
            step: 'execution_complete',
            instancesCreated,
            integrationsCreated,
            orphanedDeleted: orphanedInstances?.length || 0
        })

        return NextResponse.json({ success: results.errors.length === 0, ...results })

    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 })
    }
}
