'use client'

import { useState } from 'react'

export default function TestBookingIntegration() {
    const [results, setResults] = useState<any>(null)
    const [loading, setLoading] = useState(false)

    const testMergedAvailability = async () => {
        setLoading(true)
        try {
            // Get all providers first
            const providersResponse = await fetch('/api/patient-booking/providers-for-payer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ payerId: 'test-payer-id' })
            })
            const providersData = await providersResponse.json()
            
            if (providersData.success && providersData.data.providers.length > 0) {
                // Test merged availability with actual provider
                const response = await fetch('/api/patient-booking/merged-availability', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        payerId: 'test-payer-id',
                        startDate: new Date().toISOString(),
                        endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
                    })
                })
                const data = await response.json()
                setResults(data)
            } else {
                setResults({ error: 'No providers found. Please create a provider first.' })
            }
        } catch (error) {
            setResults({ error: error.toString() })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold mb-4">Test Patient Booking Integration</h1>
            
            <button 
                onClick={testMergedAvailability}
                disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
                {loading ? 'Testing...' : 'Test Merged Availability'}
            </button>

            {results && (
                <div className="mt-6 p-4 bg-gray-100 rounded">
                    <h3 className="font-bold mb-2">Results:</h3>
                    <pre className="text-sm overflow-auto">
                        {JSON.stringify(results, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    )
}