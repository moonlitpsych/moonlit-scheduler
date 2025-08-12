'use client'

import { useState } from 'react'

export default function TestAvailabilityPage() {
    const [results, setResults] = useState<any>({})
    const [loading, setLoading] = useState(false)

    const testAvailabilityData = async () => {
        setLoading(true)
        try {
            console.log('Starting availability tests...')

            // Test 1: Test our merged availability API directly
            const testPayerId = 'test-payer-id' // We'll use a real one from your data
            const startDate = new Date().toISOString()
            const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

            console.log('Testing merged availability API...')
            const mergedResponse = await fetch('/api/patient-booking/merged-availability', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    payerId: testPayerId,
                    startDate: startDate,
                    endDate: endDate,
                    appointmentDuration: 60
                })
            })

            const mergedData = await mergedResponse.json()
            console.log('Merged API response:', mergedData)

            // Test 2: Test Travis's individual provider availability  
            const travisProviderId = '35ab086b-2894-446d-9ab5-3d41613017ad'
            
            console.log('Testing Travis provider availability...')
            const travisResponse = await fetch('/api/patient-booking/provider-availability', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    providerId: travisProviderId,
                    startDate: startDate,
                    endDate: endDate,
                    appointmentDuration: 60
                })
            })

            const travisData = await travisResponse.json()
            console.log('Travis availability response:', travisData)

            // Test 3: Test database connectivity with a simple fetch
            console.log('Testing basic database connectivity...')
            const dbTestResponse = await fetch('/api/test-db-connection', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            })

            let dbTestData = { error: 'API endpoint does not exist yet' }
            if (dbTestResponse.ok) {
                dbTestData = await dbTestResponse.json()
            }

            setResults({
                mergedAPI: {
                    status: mergedResponse.status,
                    data: mergedData,
                    url: '/api/patient-booking/merged-availability'
                },
                travisAPI: {
                    status: travisResponse.status,
                    data: travisData,
                    url: '/api/patient-booking/provider-availability'
                },
                dbTest: {
                    status: dbTestResponse.status,
                    data: dbTestData
                },
                testParameters: {
                    payerId: testPayerId,
                    providerId: travisProviderId,
                    startDate: startDate,
                    endDate: endDate
                }
            })

        } catch (error: any) {
            console.error('Test failed:', error)
            setResults({ 
                error: error.message,
                stack: error.stack 
            })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="p-8 max-w-6xl mx-auto bg-[#FEF8F1] min-h-screen">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-[#091747] mb-4 font-['Newsreader']">
                    🧪 Availability System Diagnostic
                </h1>
                <p className="text-[#091747]/70 mb-4">
                    Testing the core availability APIs to see what's working and what needs fixing.
                </p>
                <button 
                    onClick={testAvailabilityData}
                    disabled={loading}
                    className="bg-[#BF9C73] text-white px-6 py-3 rounded-lg hover:bg-[#A88660] disabled:opacity-50 transition-colors"
                >
                    {loading ? '🔍 Running Tests...' : '🚀 Start Availability Tests'}
                </button>
            </div>

            {Object.keys(results).length > 0 && (
                <div className="space-y-6">
                    {results.error ? (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                            <h2 className="text-xl font-semibold text-red-800 mb-4">❌ Test Failed</h2>
                            <div className="bg-red-100 p-4 rounded-md">
                                <p className="text-red-700 font-medium">Error: {results.error}</p>
                                {results.stack && (
                                    <pre className="text-sm text-red-600 mt-2 overflow-auto max-h-48">
                                        {results.stack}
                                    </pre>
                                )}
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Test Parameters */}
                            <div className="bg-white rounded-lg border border-[#BF9C73]/20 p-6">
                                <h2 className="text-xl font-semibold text-[#091747] mb-4">📋 Test Parameters</h2>
                                <div className="bg-stone-100 p-4 rounded-md font-mono text-sm">
                                    <p><strong>Payer ID:</strong> {results.testParameters?.payerId}</p>
                                    <p><strong>Provider ID (Travis):</strong> {results.testParameters?.providerId}</p>
                                    <p><strong>Date Range:</strong> {results.testParameters?.startDate?.split('T')[0]} to {results.testParameters?.endDate?.split('T')[0]}</p>
                                </div>
                            </div>

                            {/* Merged Availability API Test */}
                            <div className="bg-white rounded-lg border border-[#BF9C73]/20 p-6">
                                <h2 className="text-xl font-semibold text-[#091747] mb-4">🔄 Merged Availability API</h2>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-4 h-4 rounded-full ${results.mergedAPI?.status === 200 ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                        <span className="font-medium">Status: {results.mergedAPI?.status}</span>
                                        <span className="text-sm text-gray-600">({results.mergedAPI?.url})</span>
                                    </div>
                                    <div className="bg-stone-100 p-4 rounded-md">
                                        <pre className="text-sm overflow-auto max-h-64">
                                            {JSON.stringify(results.mergedAPI?.data, null, 2)}
                                        </pre>
                                    </div>
                                </div>
                            </div>

                            {/* Travis Provider API Test */}
                            <div className="bg-white rounded-lg border border-[#BF9C73]/20 p-6">
                                <h2 className="text-xl font-semibold text-[#091747] mb-4">👨‍⚕️ Travis Provider Availability API</h2>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-4 h-4 rounded-full ${results.travisAPI?.status === 200 ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                        <span className="font-medium">Status: {results.travisAPI?.status}</span>
                                        <span className="text-sm text-gray-600">({results.travisAPI?.url})</span>
                                    </div>
                                    <div className="bg-stone-100 p-4 rounded-md">
                                        <pre className="text-sm overflow-auto max-h-64">
                                            {JSON.stringify(results.travisAPI?.data, null, 2)}
                                        </pre>
                                    </div>
                                </div>
                            </div>

                            {/* Summary */}
                            <div className="bg-[#091747] text-white rounded-lg p-6">
                                <h2 className="text-xl font-semibold mb-4">🎯 Test Summary</h2>
                                <div className="space-y-2">
                                    <p>✅ <strong>Provider-Payer Data:</strong> We have {results.testParameters ? 'real provider-payer relationships' : 'no data'}</p>
                                    <p>{results.mergedAPI?.status === 200 ? '✅' : '❌'} <strong>Merged API:</strong> {results.mergedAPI?.status === 200 ? 'Working' : 'Failed'}</p>
                                    <p>{results.travisAPI?.status === 200 ? '✅' : '❌'} <strong>Provider API:</strong> {results.travisAPI?.status === 200 ? 'Working' : 'Failed'}</p>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    )
}