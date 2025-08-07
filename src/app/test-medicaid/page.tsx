'use client'

import { AlertCircle, Loader2 } from 'lucide-react'
import { useState } from 'react'

export default function MedicaidTestPage() {
    const [formData, setFormData] = useState({
        first: '',
        last: '',
        dob: '',
        ssn: '',
        medicaidId: ''
    })
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<any>(null)
    const [error, setError] = useState('')
    const [testLog, setTestLog] = useState<string[]>([])
    const [mode, setMode] = useState<'unknown' | 'simulation' | 'live'>('unknown')

    const addLog = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
        const time = new Date().toLocaleTimeString()
        const entry = `[${time}] ${message}`
        setTestLog(prev => [...prev, entry])
    }

    const fillTestData = (scenario: string) => {
        const testData: any = {
            'FFS': { first: 'Test', last: 'FFS', dob: '1990-01-01', ssn: '1234', medicaidId: '' },
            'SelectHealth': { first: 'Test', last: 'SelectHealth', dob: '1990-01-01', ssn: '1234', medicaidId: '' },
            'Molina': { first: 'Test', last: 'Molina', dob: '1990-01-01', ssn: '1234', medicaidId: '' },
            'NoInsurance': { first: 'Test', last: 'None', dob: '1990-01-01', ssn: '1234', medicaidId: '' }
        }

        if (testData[scenario]) {
            setFormData(testData[scenario])
            addLog(`📝 Filled test data for ${scenario} scenario`, 'info')
        }
    }

    const handleSubmit = async () => {

        if (!formData.first || !formData.last || !formData.dob) {
            setError('Please fill in all required fields')
            return
        }

        if (!formData.ssn && !formData.medicaidId) {
            setError('Please provide either SSN (last 4 digits) or Medicaid ID')
            return
        }

        setLoading(true)
        setError('')
        setResult(null)

        addLog(`🔍 Checking eligibility for ${formData.first} ${formData.last}...`, 'info')

        try {
            const response = await fetch('/api/medicaid/check', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            })

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`)
            }

            const data = await response.json()
            setResult(data)

            // Update mode
            setMode(data.simulationMode ? 'simulation' : 'live')

            // Log result
            if (data.enrolled) {
                if (data.isAccepted) {
                    addLog(`✅ ENROLLED - ${data.currentPlan} (ACCEPTED)`, 'success')
                } else {
                    addLog(`⚠️ ENROLLED - ${data.currentPlan} (NOT ACCEPTED)`, 'warning')
                }
            } else {
                addLog(`❌ NOT ENROLLED - No active coverage`, 'error')
            }

        } catch (err: any) {
            setError(err.message || 'Failed to check eligibility')
            addLog(`❌ Error: ${err.message}`, 'error')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-2xl mx-auto">
                <div className="bg-white rounded-lg shadow-lg p-6">
                    <div className="text-center mb-6">
                        <h1 className="text-2xl font-bold text-gray-800 mb-2">
                            🏥 Moonlit Medicaid Eligibility Tester
                        </h1>
                        <p className="text-gray-600">Test real-time eligibility verification via UHIN</p>

                        {/* Mode Indicator */}
                        <div className="mt-2">
                            {mode === 'live' && (
                                <span className="inline-block px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-700">
                                    ✅ LIVE UHIN MODE
                                </span>
                            )}
                            {mode === 'simulation' && (
                                <span className="inline-block px-3 py-1 rounded-full text-sm font-semibold bg-yellow-100 text-yellow-700">
                                    ⚠️ SIMULATION MODE
                                </span>
                            )}
                            {mode === 'unknown' && (
                                <span className="inline-block px-3 py-1 rounded-full text-sm font-semibold bg-gray-100 text-gray-700">
                                    🔄 Mode will be detected on first check
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    First Name *
                                </label>
                                <input
                                    type="text"
                                    value={formData.first}
                                    onChange={(e) => setFormData({ ...formData, first: e.target.value })}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Last Name *
                                </label>
                                <input
                                    type="text"
                                    value={formData.last}
                                    onChange={(e) => setFormData({ ...formData, last: e.target.value })}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Date of Birth *
                            </label>
                            <input
                                type="date"
                                value={formData.dob}
                                onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                SSN (Last 4 digits)
                            </label>
                            <input
                                type="text"
                                value={formData.ssn}
                                onChange={(e) => setFormData({ ...formData, ssn: e.target.value })}
                                placeholder="1234"
                                maxLength={4}
                                pattern="[0-9]{4}"
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Medicaid ID
                            </label>
                            <input
                                type="text"
                                value={formData.medicaidId}
                                onChange={(e) => setFormData({ ...formData, medicaidId: e.target.value })}
                                placeholder="Optional if SSN provided"
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* Test Scenarios */}
                        <div className="bg-blue-50 p-4 rounded-lg">
                            <p className="text-sm font-semibold text-blue-900 mb-2">Quick Test Scenarios:</p>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => fillTestData('FFS')}
                                    className="px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 text-sm"
                                >
                                    Test FFS (✅ Accepted)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => fillTestData('SelectHealth')}
                                    className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
                                >
                                    Test SelectHealth (❌ Not Accepted)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => fillTestData('Molina')}
                                    className="px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 text-sm"
                                >
                                    Test Molina (✅ Accepted)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => fillTestData('NoInsurance')}
                                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
                                >
                                    Test No Coverage
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                <div className="flex items-center">
                                    <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                                    <p className="text-red-700">{error}</p>
                                </div>
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={loading}
                            className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="animate-spin h-5 w-5 mr-2" />
                                    Checking with UHIN...
                                </>
                            ) : (
                                'Check Eligibility'
                            )}
                        </button>
                    </div>

                    {/* Results */}
                    {result && (
                        <div className="mt-8 border-t pt-6">
                            <h3 className="text-lg font-semibold mb-4">Results:</h3>

                            {result.enrolled ? (
                                <div className={`${result.isAccepted ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'} border rounded-lg p-4`}>
                                    <div className="flex items-start">
                                        <span className="text-2xl mr-3">
                                            {result.isAccepted ? '✅' : '⚠️'}
                                        </span>
                                        <div className="flex-1">
                                            <h4 className={`font-semibold ${result.isAccepted ? 'text-green-900' : 'text-yellow-900'}`}>
                                                {result.isAccepted ? 'Coverage Accepted!' : 'Coverage Not Accepted'}
                                            </h4>
                                            <p className={`mt-1 ${result.isAccepted ? 'text-green-700' : 'text-yellow-700'}`}>
                                                {result.message}
                                            </p>

                                            <div className="mt-3 space-y-1 text-sm">
                                                <p><strong>Enrolled:</strong> Yes</p>
                                                <p><strong>Current Plan:</strong> {result.currentPlan}</p>
                                                {result.effectiveDate && (
                                                    <p><strong>Effective Date:</strong> {result.effectiveDate}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                    <div className="flex items-start">
                                        <span className="text-2xl mr-3">❌</span>
                                        <div className="flex-1">
                                            <h4 className="font-semibold text-red-900">No Active Coverage</h4>
                                            <p className="mt-1 text-red-700">
                                                {result.message || 'Patient does not have active Medicaid coverage'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Debug Info */}
                            <details className="mt-4">
                                <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
                                    View Raw Response (for debugging)
                                </summary>
                                <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-x-auto">
                                    {JSON.stringify(result, null, 2)}
                                </pre>
                            </details>
                        </div>
                    )}
                </div>

                {/* Test Log */}
                <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
                    <h3 className="text-lg font-semibold mb-4">📋 Test Log:</h3>
                    <div className="space-y-2 text-sm">
                        {testLog.length === 0 ? (
                            <p className="text-gray-500">No tests run yet...</p>
                        ) : (
                            testLog.map((entry, i) => (
                                <div key={i} className="text-gray-600">
                                    {entry}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}