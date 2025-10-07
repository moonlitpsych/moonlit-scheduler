import { NextRequest, NextResponse } from 'next/server'
import { getIntakeServiceInstanceForPayer, getIntakeDurationForPayer } from '@/lib/services/intakeResolver'

export async function GET(request: NextRequest) {
    // Disable in production
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ success: false, error: 'Disabled in production' }, { status: 404 });
    }

    try {
        const { searchParams } = new URL(request.url)
        const testMode = searchParams.get('mode') || 'overview'

        const results: any = {
            timestamp: new Date().toISOString(),
            mode: testMode,
            results: {}
        }

        if (testMode === 'overview' || testMode === 'resolver') {
            console.log('🧪 Testing Intake service instance resolver...')

            // Test Molina
            try {
                const molinaServiceInstanceId = await getIntakeServiceInstanceForPayer('molina')
                const molinaDuration = await getIntakeDurationForPayer('molina')
                results.results.molina_test = {
                    payer_id: 'molina',
                    service_instance_id: molinaServiceInstanceId,
                    duration_minutes: molinaDuration,
                    status: 'success'
                }
            } catch (error: any) {
                results.results.molina_test = {
                    payer_id: 'molina',
                    error: error.message,
                    code: error.code,
                    status: 'error'
                }
            }

            // Test Utah Medicaid FFS
            try {
                const utahServiceInstanceId = await getIntakeServiceInstanceForPayer('utah-medicaid-ffs')
                const utahDuration = await getIntakeDurationForPayer('utah-medicaid-ffs')
                results.results.utah_medicaid_test = {
                    payer_id: 'utah-medicaid-ffs',
                    service_instance_id: utahServiceInstanceId,
                    duration_minutes: utahDuration,
                    status: 'success'
                }
            } catch (error: any) {
                results.results.utah_medicaid_test = {
                    payer_id: 'utah-medicaid-ffs',
                    error: error.message,
                    code: error.code,
                    status: 'error'
                }
            }

            // Test unknown payer (should fail)
            try {
                const unknownServiceInstanceId = await getIntakeServiceInstanceForPayer('unknown-payer')
                results.results.unknown_payer_test = {
                    payer_id: 'unknown-payer',
                    service_instance_id: unknownServiceInstanceId,
                    status: 'unexpected_success'
                }
            } catch (error: any) {
                results.results.unknown_payer_test = {
                    payer_id: 'unknown-payer',
                    error: error.message,
                    code: error.code,
                    status: 'expected_error'
                }
            }
        }

        if (testMode === 'availability') {
            console.log('🧪 Testing Intake-only availability API...')

            try {
                // Test availability endpoint with Intake-only resolver
                const testResponse = await fetch(`${request.nextUrl.origin}/api/patient-booking/merged-availability`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        payer_id: 'molina',
                        date: new Date().toISOString().split('T')[0] // Today
                    })
                })

                if (testResponse.ok) {
                    const availabilityData = await testResponse.json()
                    results.results.availability_test = {
                        success: availabilityData.success,
                        service_instance_id: availabilityData.data?.serviceInstanceId,
                        duration_minutes: availabilityData.data?.durationMinutes,
                        total_slots: availabilityData.data?.totalSlots || 0,
                        providers_count: availabilityData.data?.providers?.length || 0,
                        intake_only: availabilityData.data?.debug?.intake_only,
                        has_slots_with_service_instance: availabilityData.data?.slots?.some((slot: any) => slot.serviceInstanceId) || false,
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

        if (testMode === 'booking') {
            console.log('🧪 Testing Intake-only booking API contract...')

            try {
                // Test booking endpoint with Intake-only contract (dry run - will likely fail due to missing patient)
                const testResponse = await fetch(`${request.nextUrl.origin}/api/patient-booking/book`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        patientId: 'test-patient-123',
                        providerId: '35ab086b-2894-446d-9ab5-3d41613017ad', // Travis Norseth
                        payerId: 'molina',
                        start: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
                        locationType: 'telehealth',
                        notes: 'Test Intake booking via new API contract'
                    })
                })

                const bookingData = await testResponse.json()
                results.results.booking_test = {
                    success: bookingData.success,
                    error: bookingData.error,
                    code: bookingData.code,
                    has_service_instance: !!bookingData.data?.service?.instanceId,
                    service_type: bookingData.data?.service?.type,
                    status: testResponse.ok ? 'success' : 'expected_error'
                }
            } catch (error: any) {
                results.results.booking_test = {
                    error: error.message,
                    status: 'error'
                }
            }
        }

        // Overall assessment
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
            intake_flow_readiness: successfulTests >= 1 ? 'ready' : 'needs_configuration',
            key_validations: {
                single_service_instance_resolution: !!results.results.molina_test?.service_instance_id,
                payer_required_validation: results.results.unknown_payer_test?.code === 'NO_INTAKE_INSTANCE_FOR_PAYER',
                intake_only_api_response: !!results.results.availability_test?.service_instance_id,
                no_slot_level_service_instance: !results.results.availability_test?.has_slots_with_service_instance
            }
        }

        return NextResponse.json({
            success: true,
            data: results,
            message: 'Intake-only flow test completed'
        })

    } catch (error: any) {
        console.error('❌ Error in Intake flow test:', error)
        return NextResponse.json(
            {
                error: 'Intake flow test failed',
                details: error.message,
                success: false
            },
            { status: 500 }
        )
    }
}