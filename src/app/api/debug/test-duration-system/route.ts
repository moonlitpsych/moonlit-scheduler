import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveDurationMinutes, getEffectiveDurationMinutesBatch } from '@/lib/utils/durationHelper'
import { getGatedServiceInstances, getPrimaryServiceInstance } from '@/lib/utils/serviceInstanceGating'

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const testMode = searchParams.get('mode') || 'overview'

        const results: any = {
            timestamp: new Date().toISOString(),
            mode: testMode,
            results: {}
        }

        if (testMode === 'overview' || testMode === 'duration') {
            console.log('🧪 Testing duration helper...')

            // Test individual duration lookup (will fail if service doesn't exist)
            try {
                const testServiceInstanceId = '12191f44-a09c-426f-8e22-0c5b8e57b3b7' // Common fallback ID
                const duration = await getEffectiveDurationMinutes(testServiceInstanceId)
                results.results.duration_test = {
                    service_instance_id: testServiceInstanceId,
                    duration_minutes: duration,
                    status: 'success'
                }
            } catch (error: any) {
                results.results.duration_test = {
                    error: error.message,
                    code: error.code,
                    status: 'error'
                }
            }

            // Test batch duration lookup
            try {
                const testIds = [
                    '12191f44-a09c-426f-8e22-0c5b8e57b3b7',
                    '1a659f8e-249a-4690-86e7-359c6c381bc0'
                ]
                const durations = await getEffectiveDurationMinutesBatch(testIds)
                results.results.batch_duration_test = {
                    input_ids: testIds,
                    durations,
                    count: Object.keys(durations).length,
                    status: 'success'
                }
            } catch (error: any) {
                results.results.batch_duration_test = {
                    error: error.message,
                    code: error.code,
                    status: 'error'
                }
            }
        }

        if (testMode === 'overview' || testMode === 'gating') {
            console.log('🧪 Testing service instance gating...')

            // Test gated service instances
            try {
                const gatedInstances = await getGatedServiceInstances({
                    bypassGating: false
                })
                results.results.gating_test = {
                    total_instances: gatedInstances.length,
                    sample_instance: gatedInstances[0] || null,
                    active_instances: gatedInstances.filter(i => i.active).length,
                    mapped_instances: gatedInstances.filter(i => i.has_integration_mapping).length,
                    with_duration: gatedInstances.filter(i => i.duration_minutes !== null).length,
                    status: 'success'
                }
            } catch (error: any) {
                results.results.gating_test = {
                    error: error.message,
                    status: 'error'
                }
            }

            // Test bypassed gating
            try {
                const allInstances = await getGatedServiceInstances({
                    bypassGating: true
                })
                results.results.bypass_gating_test = {
                    total_instances: allInstances.length,
                    gated_vs_total: `${results.results.gating_test?.total_instances || 0}/${allInstances.length}`,
                    status: 'success'
                }
            } catch (error: any) {
                results.results.bypass_gating_test = {
                    error: error.message,
                    status: 'error'
                }
            }
        }

        if (testMode === 'overview' || testMode === 'provider') {
            console.log('🧪 Testing provider service instance lookup...')

            // Test primary service instance for a known provider
            try {
                const testProviderId = '35ab086b-2894-446d-9ab5-3d41613017ad' // Travis Norseth
                const testPayerId = 'cash-payment'

                const primaryInstance = await getPrimaryServiceInstance(
                    testProviderId,
                    testPayerId,
                    false // don't bypass gating
                )

                results.results.provider_test = {
                    provider_id: testProviderId,
                    payer_id: testPayerId,
                    primary_instance: primaryInstance,
                    has_instance: !!primaryInstance,
                    instance_id: primaryInstance?.id,
                    duration_minutes: primaryInstance?.duration_minutes,
                    status: 'success'
                }
            } catch (error: any) {
                results.results.provider_test = {
                    error: error.message,
                    status: 'error'
                }
            }
        }

        return NextResponse.json({
            success: true,
            data: results,
            message: 'Duration system test completed'
        })

    } catch (error: any) {
        console.error('❌ Error in duration system test:', error)
        return NextResponse.json(
            {
                error: 'Duration system test failed',
                details: error.message,
                success: false
            },
            { status: 500 }
        )
    }
}