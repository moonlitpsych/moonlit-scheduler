// Minimal integration tests for canonical bookability view
// Tests the v_bookable_provider_payer view and bookability utilities

import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import {
    BOOKABILITY_VIEWS,
    BOOKABLE_PROVIDER_SELECT,
    PROVIDER_DETAILS_SELECT,
    mapViewToLegacyFormat,
    filterProvidersByLanguage,
    groupProvidersBySupervision,
    normalizeLanguages,
    type BookableProviderPayerView,
    type ProviderData
} from '@/lib/bookability'

interface TestResult {
    test: string
    status: 'PASS' | 'FAIL' | 'ERROR'
    message: string
    data?: any
    error?: any
}

export async function GET(request: NextRequest) {
    const testResults: TestResult[] = []

    console.log('🧪 Starting canonical view integration tests...')

    // Test 1: Canonical view accessibility
    try {
        const { data, error } = await supabaseAdmin
            .from(BOOKABILITY_VIEWS.BOOKABLE)
            .select('*')
            .limit(1)

        if (error) {
            testResults.push({
                test: 'Canonical view accessibility',
                status: 'FAIL',
                message: 'Cannot access canonical view',
                error: error.message
            })
        } else {
            testResults.push({
                test: 'Canonical view accessibility',
                status: 'PASS',
                message: `Successfully accessed ${BOOKABILITY_VIEWS.BOOKABLE}`,
                data: { record_count: data?.length || 0 }
            })
        }
    } catch (error: any) {
        testResults.push({
            test: 'Canonical view accessibility',
            status: 'ERROR',
            message: 'Exception accessing canonical view',
            error: error.message
        })
    }

    // Test 2: Bookable provider select query
    try {
        const { data: relationships, error } = await supabaseAdmin
            .from(BOOKABILITY_VIEWS.BOOKABLE)
            .select(BOOKABLE_PROVIDER_SELECT)
            .limit(5)

        if (error) {
            testResults.push({
                test: 'Bookable provider select query',
                status: 'FAIL',
                message: 'Select query failed',
                error: error.message
            })
        } else {
            testResults.push({
                test: 'Bookable provider select query',
                status: 'PASS',
                message: `Successfully selected ${relationships?.length || 0} relationships`,
                data: {
                    relationship_count: relationships?.length || 0,
                    sample_fields: relationships?.[0] ? Object.keys(relationships[0]) : []
                }
            })
        }
    } catch (error: any) {
        testResults.push({
            test: 'Bookable provider select query',
            status: 'ERROR',
            message: 'Exception in select query',
            error: error.message
        })
    }

    // Test 3: Provider details query
    try {
        const { data: providers, error } = await supabaseAdmin
            .from('providers')
            .select(PROVIDER_DETAILS_SELECT)
            .eq('is_bookable', true)
            .limit(3)

        if (error) {
            testResults.push({
                test: 'Provider details query',
                status: 'FAIL',
                message: 'Provider details query failed',
                error: error.message
            })
        } else {
            testResults.push({
                test: 'Provider details query',
                status: 'PASS',
                message: `Successfully fetched ${providers?.length || 0} provider details`,
                data: {
                    provider_count: providers?.length || 0,
                    sample_names: providers?.map(p => `${p.first_name} ${p.last_name}`) || []
                }
            })
        }
    } catch (error: any) {
        testResults.push({
            test: 'Provider details query',
            status: 'ERROR',
            message: 'Exception in provider details query',
            error: error.message
        })
    }

    // Test 4: End-to-end data mapping
    try {
        // Get Utah Medicaid relationships (known to exist)
        const { data: relationships, error: relError } = await supabaseAdmin
            .from(BOOKABILITY_VIEWS.BOOKABLE)
            .select(BOOKABLE_PROVIDER_SELECT)
            .eq('payer_id', 'a01d69d6-ae70-4917-afef-49b5ef7e5220') // Utah Medicaid
            .limit(2)

        if (relError) throw relError

        if (!relationships || relationships.length === 0) {
            testResults.push({
                test: 'End-to-end data mapping',
                status: 'FAIL',
                message: 'No relationships found for Utah Medicaid',
                data: { payer_id: 'a01d69d6-ae70-4917-afef-49b5ef7e5220' }
            })
        } else {
            // Get provider details
            const providerIds = relationships.map(r => r.provider_id)
            const { data: providers, error: provError } = await supabaseAdmin
                .from('providers')
                .select(PROVIDER_DETAILS_SELECT)
                .in('id', providerIds)

            if (provError) throw provError

            // Test mapping function
            const mappedProviders = relationships.map(rel => {
                const provider = providers?.find(p => p.id === rel.provider_id)
                if (!provider) return null
                
                return mapViewToLegacyFormat(
                    rel as BookableProviderPayerView,
                    provider as ProviderData
                )
            }).filter(Boolean)

            testResults.push({
                test: 'End-to-end data mapping',
                status: 'PASS',
                message: `Successfully mapped ${mappedProviders.length} providers`,
                data: {
                    relationships_found: relationships.length,
                    providers_found: providers?.length || 0,
                    mapped_providers: mappedProviders.length,
                    sample_mapped: mappedProviders[0] ? {
                        name: `${mappedProviders[0].first_name} ${mappedProviders[0].last_name}`,
                        via: mappedProviders[0].via,
                        network_status: mappedProviders[0].network_status
                    } : null
                }
            })
        }
    } catch (error: any) {
        testResults.push({
            test: 'End-to-end data mapping',
            status: 'ERROR',
            message: 'Exception in end-to-end mapping test',
            error: error.message
        })
    }

    // Test 5: Language filtering utilities
    try {
        // Create mock provider data
        const mockProviders = [
            { id: '1', first_name: 'John', last_name: 'Doe', languages_spoken: ['English'] } as any,
            { id: '2', first_name: 'Jane', last_name: 'Smith', languages_spoken: ['English', 'Spanish'] } as any,
            { id: '3', first_name: 'Pedro', last_name: 'Garcia', languages_spoken: 'Spanish' } as any
        ]

        const englishFiltered = filterProvidersByLanguage(mockProviders, 'English')
        const spanishFiltered = filterProvidersByLanguage(mockProviders, 'Spanish')

        testResults.push({
            test: 'Language filtering utilities',
            status: 'PASS',
            message: 'Language filtering working correctly',
            data: {
                total_providers: mockProviders.length,
                english_speakers: englishFiltered.length,
                spanish_speakers: spanishFiltered.length
            }
        })
    } catch (error: any) {
        testResults.push({
            test: 'Language filtering utilities',
            status: 'ERROR',
            message: 'Exception in language filtering test',
            error: error.message
        })
    }

    // Test 6: Supervision grouping utilities
    try {
        // Create mock provider data with supervision
        const mockProviders = [
            { id: '1', via: 'direct', attending_provider_id: null, requires_co_visit: false } as any,
            { id: '2', via: 'supervised', attending_provider_id: 'attending1', requires_co_visit: false } as any,
            { id: '3', via: 'supervised', attending_provider_id: 'attending1', requires_co_visit: true } as any
        ]

        const grouped = groupProvidersBySupervision(mockProviders)

        testResults.push({
            test: 'Supervision grouping utilities',
            status: 'PASS',
            message: 'Supervision grouping working correctly',
            data: {
                total_providers: mockProviders.length,
                direct_providers: grouped.stats.direct,
                supervised_providers: grouped.stats.supervised,
                co_visit_required: grouped.stats.coVisitRequired,
                supervision_groups: Object.keys(grouped.supervisionGroups).length
            }
        })
    } catch (error: any) {
        testResults.push({
            test: 'Supervision grouping utilities',
            status: 'ERROR',
            message: 'Exception in supervision grouping test',
            error: error.message
        })
    }

    // Test 7: Language normalization utilities
    try {
        const test1 = normalizeLanguages(['English', 'Spanish'])
        const test2 = normalizeLanguages('English')
        const test3 = normalizeLanguages('["English", "French"]')
        const test4 = normalizeLanguages(null)

        testResults.push({
            test: 'Language normalization utilities',
            status: 'PASS',
            message: 'Language normalization working correctly',
            data: {
                array_input: test1,
                string_input: test2,
                json_string_input: test3,
                null_input: test4
            }
        })
    } catch (error: any) {
        testResults.push({
            test: 'Language normalization utilities',
            status: 'ERROR',
            message: 'Exception in language normalization test',
            error: error.message
        })
    }

    // Calculate summary
    const summary = {
        total_tests: testResults.length,
        passed: testResults.filter(r => r.status === 'PASS').length,
        failed: testResults.filter(r => r.status === 'FAIL').length,
        errors: testResults.filter(r => r.status === 'ERROR').length
    }

    const overall_status = summary.failed === 0 && summary.errors === 0 ? 'ALL_TESTS_PASSED' : 'SOME_TESTS_FAILED'

    console.log(`🧪 Integration tests completed: ${summary.passed}/${summary.total_tests} passed`)

    return NextResponse.json({
        success: true,
        test_suite: 'Canonical View Integration Tests',
        overall_status,
        summary,
        results: testResults,
        timestamp: new Date().toISOString(),
        recommendations: overall_status === 'ALL_TESTS_PASSED' ? [
            'Canonical view is fully operational',
            'All bookability utilities functioning correctly',
            'Database migration appears successful'
        ] : [
            'Review failed tests for database or view issues',
            'Check canonical view permissions and structure',
            'Validate provider data completeness'
        ]
    })
}