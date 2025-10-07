import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveDurationMinutes } from '@/lib/services/effectiveDuration'
import { getIntakeqPractitionerId } from '@/lib/integrations/providerMap'
import { getIntakeqServiceId, hasLiveMapping } from '@/lib/integrations/serviceInstanceMap'
import { getActivePolicy } from '@/lib/billing/activePolicy'
import { ensureClient } from '@/lib/intakeq/client'

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const testMode = searchParams.get('mode') || 'overview'

        const results: any = {
            timestamp: new Date().toISOString(),
            mode: testMode,
            results: {}
        }

        if (testMode === 'overview' || testMode === 'mappings') {
            console.log('🧪 Testing PracticeQ booking mappings...')

            // Test known provider mapping
            try {
                const testProviderId = '35ab086b-2894-446d-9ab5-3d41613017ad' // Travis Norseth
                const practitionerId = await getIntakeqPractitionerId(testProviderId)
                results.results.provider_mapping_test = {
                    provider_id: testProviderId,
                    practitioner_id: practitionerId,
                    status: 'success'
                }
            } catch (error: any) {
                results.results.provider_mapping_test = {
                    error: error.message,
                    code: error.code,
                    status: 'error'
                }
            }

            // Test service instance mappings
            try {
                const testServiceInstanceIds = [
                    '12191f44-a09c-426f-8e22-0c5b8e57b3b7', // Common fallback
                    '1a659f8e-249a-4690-86e7-359c6c381bc0'  // Alternative
                ]

                const mappingResults = []
                for (const serviceInstanceId of testServiceInstanceIds) {
                    try {
                        const serviceId = await getIntakeqServiceId(serviceInstanceId)
                        const hasMapping = await hasLiveMapping(serviceInstanceId)
                        mappingResults.push({
                            service_instance_id: serviceInstanceId,
                            service_id: serviceId,
                            has_live_mapping: hasMapping,
                            status: 'success'
                        })
                    } catch (error: any) {
                        mappingResults.push({
                            service_instance_id: serviceInstanceId,
                            error: error.message,
                            code: error.code,
                            status: 'error'
                        })
                    }
                }

                results.results.service_mapping_test = {
                    total_tested: testServiceInstanceIds.length,
                    results: mappingResults,
                    status: 'completed'
                }
            } catch (error: any) {
                results.results.service_mapping_test = {
                    error: error.message,
                    status: 'error'
                }
            }
        }

        if (testMode === 'overview' || testMode === 'duration') {
            console.log('🧪 Testing duration system...')

            try {
                const testServiceInstanceId = '12191f44-a09c-426f-8e22-0c5b8e57b3b7'
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
        }

        if (testMode === 'overview' || testMode === 'policy') {
            console.log('🧪 Testing active policy system...')

            try {
                // Test with a mock patient ID (will likely fail but tests the function)
                const testPatientId = 'test-patient-123'
                const policy = await getActivePolicy(testPatientId)
                results.results.policy_test = {
                    patient_id: testPatientId,
                    policy_id: policy.policyId,
                    payer_name: policy.payerSnapshot.name,
                    member_id: policy.memberSnapshot.member_id,
                    status: 'success'
                }
            } catch (error: any) {
                results.results.policy_test = {
                    error: error.message,
                    code: error.code,
                    status: 'expected_error' // This will likely fail for test patient
                }
            }
        }

        if (testMode === 'overview' || testMode === 'client') {
            console.log('🧪 Testing IntakeQ client creation...')

            try {
                // Test with a mock patient ID (will likely fail but tests the function)
                const testPatientId = 'test-patient-123'
                const clientId = await ensureClient(testPatientId)
                results.results.client_test = {
                    patient_id: testPatientId,
                    intakeq_client_id: clientId,
                    status: 'success'
                }
            } catch (error: any) {
                results.results.client_test = {
                    error: error.message,
                    code: error.code,
                    status: 'expected_error' // This will likely fail for test patient
                }
            }
        }

        if (testMode === 'availability') {
            console.log('🧪 Testing availability with PQ mappings...')

            try {
                // Test availability endpoint with PQ mapping requirements
                const testResponse = await fetch(`${request.nextUrl.origin}/api/patient-booking/merged-availability`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        payer_id: 'molina', // Test with Molina
                        date: new Date().toISOString().split('T')[0], // Today
                        bypassGating: false // Require PQ mappings
                    })
                })

                if (testResponse.ok) {
                    const availabilityData = await testResponse.json()
                    results.results.availability_test = {
                        total_slots: availabilityData.data?.totalSlots || 0,
                        providers_count: availabilityData.data?.providers?.length || 0,
                        pq_mapping_required: availabilityData.data?.debug?.pq_mapping_required,
                        unique_durations: availabilityData.data?.debug?.unique_durations || [],
                        status: 'success'
                    }
                } else {
                    const errorData = await testResponse.json()
                    results.results.availability_test = {
                        error: errorData.error,
                        code: errorData.code,
                        status: 'error'
                    }
                }
            } catch (error: any) {
                results.results.availability_test = {
                    error: error.message,
                    status: 'error'
                }
            }
        }

        // Overall system readiness assessment
        const completedTests = Object.keys(results.results).length
        const successfulTests = Object.values(results.results).filter((test: any) =>
            test.status === 'success'
        ).length
        const expectedErrors = Object.values(results.results).filter((test: any) =>
            test.status === 'expected_error'
        ).length

        results.summary = {
            total_tests: completedTests,
            successful_tests: successfulTests,
            expected_errors: expectedErrors,
            actual_errors: completedTests - successfulTests - expectedErrors,
            system_readiness: successfulTests >= 2 ? 'ready' : 'needs_configuration',
            recommendations: []
        }

        // Add specific recommendations
        if (results.results.provider_mapping_test?.status === 'error') {
            results.summary.recommendations.push('Configure IntakeQ practitioner IDs for providers')
        }
        if (results.results.service_mapping_test?.status === 'error') {
            results.summary.recommendations.push('Configure service instance integrations with IntakeQ/PracticeQ')
        }
        if (results.results.duration_test?.status === 'error') {
            results.summary.recommendations.push('Ensure v_service_instance_effective view has duration data')
        }

        return NextResponse.json({
            success: true,
            data: results,
            message: 'PracticeQ booking flow test completed'
        })

    } catch (error: any) {
        console.error('❌ Error in booking flow test:', error)
        return NextResponse.json(
            {
                error: 'Booking flow test failed',
                details: error.message,
                success: false
            },
            { status: 500 }
        )
    }
}