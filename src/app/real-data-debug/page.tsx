// src/app/real-data-debug/page.tsx
'use client'

import { Suspense, useState } from 'react'
import { supabase } from '@/lib/supabase'
import dynamic from 'next/dynamic'

// Force dynamic rendering to prevent build issues
export const dynamic = 'force-dynamic'

function RealDataDebugContent() {
    const [debugResults, setDebugResults] = useState<any>({})
    const [loading, setLoading] = useState(false)

    const debugRealConnection = async () => {
        setLoading(true)
        const results: any = {}

        try {
            // 1. Test basic connection and auth
            console.log('🔍 Testing basic Supabase connection...')
            results.connection = {
                url: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) + '...',
                hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
                timestamp: new Date().toISOString()
            }

            // 2. Test if we can access any table at all
            console.log('🔍 Testing basic table access...')
            try {
                const { data: basicTest, error: basicError } = await supabase
                    .from('payers')
                    .select('count')
                    .limit(0)

                if (basicError) {
                    results.basicAccess = { error: basicError.message, code: basicError.code }
                } else {
                    results.basicAccess = { success: true }
                }
            } catch (e: any) {
                results.basicAccess = { error: e.message }
            }

            // 3. Test Row Level Security status
            console.log('🔍 Testing RLS policies...')
            try {
                // Try with explicit select that might bypass RLS
                const { data: rlsTest, error: rlsError } = await supabase
                    .from('payers')
                    .select('id')
                    .limit(1)

                results.rlsTest = rlsError ?
                    { blocked: true, error: rlsError.message, code: rlsError.code } :
                    { allowed: true, foundRecords: data?.length || 0 }
            } catch (e: any) {
                results.rlsTest = { error: e.message }
            }

            // 4. Test different table access patterns
            console.log('🔍 Testing different query patterns...')
            const tables = ['payers', 'providers', 'services', 'appointments']

            for (const table of tables) {
                try {
                    // Try count first (often allowed even with RLS)
                    const { count, error: countError } = await supabase
                        .from(table)
                        .select('*', { count: 'exact', head: true })

                    if (!countError && count !== null) {
                        results[`${table}_count`] = count
                    } else if (countError) {
                        results[`${table}_error`] = countError.message
                    }

                    // Try basic select
                    const { data, error } = await supabase
                        .from(table)
                        .select('*')
                        .limit(3)

                    if (!error && data) {
                        results[`${table}_sample`] = {
                            records: data.length,
                            columns: data.length > 0 ? Object.keys(data[0]) : [],
                            firstRecord: data[0] || null
                        }
                    } else if (error) {
                        results[`${table}_select_error`] = error.message
                    }
                } catch (e: any) {
                    results[`${table}_exception`] = e.message
                }
            }

            // 5. Test your actual CSV schema columns
            console.log('🔍 Testing known CSV schema columns...')
            try {
                // Based on your CSV, test these exact column names
                const { data: csvTest, error: csvError } = await supabase
                    .from('payers')
                    .select('id, name, payer_type, state, effective_date, requires_attending, credentialing_status')
                    .limit(2)

                if (csvError) {
                    results.csvSchemaTest = { error: csvError.message }
                } else {
                    results.csvSchemaTest = {
                        success: true,
                        records: csvTest?.length || 0,
                        data: csvTest
                    }
                }
            } catch (e: any) {
                results.csvSchemaTest = { error: e.message }
            }

            // 6. Test providers with your known 38-column structure
            console.log('🔍 Testing providers table (38-column structure)...')
            try {
                const { data: providerTest, error: providerError } = await supabase
                    .from('providers')
                    .select('id, first_name, last_name, accepts_new_patients, telehealth_enabled, languages_spoken')
                    .limit(2)

                if (providerError) {
                    results.providerSchemaTest = { error: providerError.message }
                } else {
                    results.providerSchemaTest = {
                        success: true,
                        records: providerTest?.length || 0,
                        data: providerTest
                    }
                }
            } catch (e: any) {
                results.providerSchemaTest = { error: e.message }
            }

            // 7. Check if RLS is enabled on tables
            console.log('🔍 Checking RLS status...')
            try {
                const { data: rlsStatus, error: rlsError } = await supabase
                    .from('pg_tables')
                    .select('tablename, rowsecurity')
                    .in('tablename', ['payers', 'providers', 'services', 'appointments'])

                if (!rlsError) {
                    results.rlsStatus = rlsStatus
                }
            } catch (e) {
                // This query might not be allowed, which is fine
                results.rlsStatus = { note: 'Cannot check RLS status - might need elevated permissions' }
            }

        } catch (error) {
            console.error('Debug error:', error)
            results.generalError = error
        } finally {
            setLoading(false)
            setDebugResults(results)
        }
    }

    return (
        <div className="min-h-screen bg-stone-50 p-8">
            <div className="max-w-6xl mx-auto">
                <h1 className="text-3xl font-bold text-slate-800 mb-8">
                    🔍 Real Data Connection Debugger
                </h1>

                <div className="mb-6">
                    <button
                        onClick={debugRealConnection}
                        disabled={loading}
                        className="btn-primary"
                    >
                        {loading ? '🔍 Debugging Connection...' : '🔍 Debug Real Data Connection'}
                    </button>
                </div>

                {Object.keys(debugResults).length > 0 && (
                    <div className="space-y-6">
                        {/* Connection Status */}
                        {debugResults.connection && (
                            <div className="bg-white rounded-lg border border-stone-200 p-6">
                                <h2 className="text-xl font-semibold mb-4">🔌 Connection Status</h2>
                                <div className="bg-stone-100 p-4 rounded-md">
                                    <pre className="text-sm overflow-auto">
                                        {JSON.stringify(debugResults.connection, null, 2)}
                                    </pre>
                                </div>
                            </div>
                        )}

                        {/* Access Issues */}
                        {(debugResults.basicAccess || debugResults.rlsTest) && (
                            <div className="bg-white rounded-lg border border-stone-200 p-6">
                                <h2 className="text-xl font-semibold mb-4">🔐 Access & Permissions</h2>
                                <div className="space-y-4">
                                    {debugResults.basicAccess && (
                                        <div>
                                            <h3 className="font-medium">Basic Access Test:</h3>
                                            <div className="bg-stone-100 p-3 rounded-md">
                                                <pre className="text-sm">
                                                    {JSON.stringify(debugResults.basicAccess, null, 2)}
                                                </pre>
                                            </div>
                                        </div>
                                    )}
                                    {debugResults.rlsTest && (
                                        <div>
                                            <h3 className="font-medium">RLS Test:</h3>
                                            <div className="bg-stone-100 p-3 rounded-md">
                                                <pre className="text-sm">
                                                    {JSON.stringify(debugResults.rlsTest, null, 2)}
                                                </pre>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Schema Tests */}
                        {(debugResults.csvSchemaTest || debugResults.providerSchemaTest) && (
                            <div className="bg-white rounded-lg border border-stone-200 p-6">
                                <h2 className="text-xl font-semibold mb-4">📋 Schema & Real Data Tests</h2>
                                <div className="space-y-4">
                                    {debugResults.csvSchemaTest && (
                                        <div>
                                            <h3 className="font-medium">Payers Table (CSV Schema):</h3>
                                            <div className={`p-3 rounded-md ${debugResults.csvSchemaTest.success ? 'bg-green-50' : 'bg-red-50'}`}>
                                                <pre className="text-sm overflow-auto">
                                                    {JSON.stringify(debugResults.csvSchemaTest, null, 2)}
                                                </pre>
                                            </div>
                                        </div>
                                    )}
                                    {debugResults.providerSchemaTest && (
                                        <div>
                                            <h3 className="font-medium">Providers Table (38-Column Schema):</h3>
                                            <div className={`p-3 rounded-md ${debugResults.providerSchemaTest.success ? 'bg-green-50' : 'bg-red-50'}`}>
                                                <pre className="text-sm overflow-auto">
                                                    {JSON.stringify(debugResults.providerSchemaTest, null, 2)}
                                                </pre>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Table Counts & Errors */}
                        <div className="bg-white rounded-lg border border-stone-200 p-6">
                            <h2 className="text-xl font-semibold mb-4">📊 Table Access Results</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {['payers', 'providers', 'services', 'appointments'].map(table => (
                                    <div key={table} className="border border-stone-200 rounded-md p-4">
                                        <h3 className="font-medium capitalize mb-2">{table} Table:</h3>
                                        <div className="space-y-2 text-sm">
                                            {debugResults[`${table}_count`] !== undefined && (
                                                <div className="text-green-700">✅ Count: {debugResults[`${table}_count`]} records</div>
                                            )}
                                            {debugResults[`${table}_sample`] && (
                                                <div className="text-green-700">
                                                    ✅ Sample: {debugResults[`${table}_sample`].records} records found
                                                    <br />Columns: {debugResults[`${table}_sample`].columns.length}
                                                </div>
                                            )}
                                            {debugResults[`${table}_error`] && (
                                                <div className="text-red-700">❌ Error: {debugResults[`${table}_error`]}</div>
                                            )}
                                            {debugResults[`${table}_select_error`] && (
                                                <div className="text-red-700">❌ Select Error: {debugResults[`${table}_select_error`]}</div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Full Debug Output */}
                        <div className="bg-white rounded-lg border border-stone-200 p-6">
                            <h2 className="text-xl font-semibold mb-4">🔧 Full Debug Output</h2>
                            <div className="bg-stone-100 p-4 rounded-md">
                                <pre className="text-xs overflow-auto max-h-96">
                                    {JSON.stringify(debugResults, null, 2)}
                                </pre>
                            </div>
                        </div>
                    </div>
                )}

                <div className="mt-8">
                    <a href="/" className="btn-secondary mr-4">
                        ← Back to Booking Flow
                    </a>
                    <a href="/database-test" className="btn-secondary">
                        Previous Debug Test
                    </a>
                </div>
            </div>
        </div>
    )
}

// Dynamically import with SSR disabled to prevent build issues
const RealDataDebugPage = dynamic(() => Promise.resolve(RealDataDebugContent), {
    ssr: false,
    loading: () => (
        <div className="min-h-screen bg-stone-50 p-8 flex items-center justify-center">
            <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800 mx-auto mb-4"></div>
                <p className="text-slate-600">Loading debug interface...</p>
            </div>
        </div>
    )
})

export default function Page() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-stone-50 p-8 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800 mx-auto mb-4"></div>
                    <p className="text-slate-600">Loading debug interface...</p>
                </div>
            </div>
        }>
            <RealDataDebugPage />
        </Suspense>
    )
}