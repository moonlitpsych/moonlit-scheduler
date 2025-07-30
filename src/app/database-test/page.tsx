// src/app/database-test/page.tsx (CREATE THIS FILE TO TEST)
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function DatabaseTestPage() {
    const [payersData, setPayersData] = useState<any[]>([])
    const [providersData, setProvidersData] = useState<any[]>([])
    const [servicesData, setServicesData] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [errors, setErrors] = useState<string[]>([])

    useEffect(() => {
        testDatabaseConnection()
    }, [])

    const testDatabaseConnection = async () => {
        const errorList: string[] = []

        try {
            // Test 1: Fetch payers
            console.log('🔍 Testing payers table...')
            const { data: payers, error: payersError } = await supabase
                .from('payers')
                .select('id, name, payer_type, effective_date, requires_attending')
                .limit(5)

            if (payersError) {
                console.error('❌ Payers error:', payersError)
                errorList.push(`Payers table error: ${payersError.message}`)
            } else {
                console.log('✅ Payers data:', payers)
                setPayersData(payers || [])
            }

            // Test 2: Fetch providers
            console.log('🔍 Testing providers table...')
            const { data: providers, error: providersError } = await supabase
                .from('providers')
                .select('id, first_name, last_name, accepts_new_patients, telehealth_enabled')
                .limit(5)

            if (providersError) {
                console.error('❌ Providers error:', providersError)
                errorList.push(`Providers table error: ${providersError.message}`)
            } else {
                console.log('✅ Providers data:', providers)
                setProvidersData(providers || [])
            }

            // Test 3: Fetch services
            console.log('🔍 Testing services table...')
            const { data: services, error: servicesError } = await supabase
                .from('services')
                .select('id, name, description, default_duration_minutes')
                .limit(5)

            if (servicesError) {
                console.error('❌ Services error:', servicesError)
                errorList.push(`Services table error: ${servicesError.message}`)
            } else {
                console.log('✅ Services data:', services)
                setServicesData(services || [])
            }

            setErrors(errorList)
        } catch (error) {
            console.error('💥 General error:', error)
            errorList.push(`General connection error: ${error}`)
            setErrors(errorList)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-stone-50 flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-2xl font-bold mb-4">🔍 Testing Database Connection...</h1>
                    <div className="animate-spin w-8 h-8 border-4 border-orange-300 border-t-transparent rounded-full mx-auto"></div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-stone-50 p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold text-slate-800 mb-8">
                    🏥 Supabase Database Connection Test
                </h1>

                {/* Connection Status */}
                <div className="mb-8">
                    <div className={`p-4 rounded-md ${errors.length === 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                        <h2 className="font-semibold mb-2">
                            {errors.length === 0 ? '✅ Database Connection: SUCCESS' : '❌ Database Connection: ISSUES FOUND'}
                        </h2>
                        {errors.length > 0 && (
                            <ul className="text-red-700 text-sm space-y-1">
                                {errors.map((error, index) => (
                                    <li key={index}>• {error}</li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                {/* Payers Data */}
                <div className="mb-8">
                    <h2 className="text-xl font-semibold text-slate-800 mb-4">
                        📋 Payers Table ({payersData.length} records found)
                    </h2>
                    {payersData.length > 0 ? (
                        <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-stone-50">
                                    <tr>
                                        <th className="px-4 py-2 text-left">Name</th>
                                        <th className="px-4 py-2 text-left">Type</th>
                                        <th className="px-4 py-2 text-left">Effective Date</th>
                                        <th className="px-4 py-2 text-left">Requires Attending</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payersData.map((payer, index) => (
                                        <tr key={payer.id} className={index % 2 === 0 ? 'bg-white' : 'bg-stone-50'}>
                                            <td className="px-4 py-2 font-medium">{payer.name}</td>
                                            <td className="px-4 py-2">{payer.payer_type}</td>
                                            <td className="px-4 py-2">{payer.effective_date || 'Not set'}</td>
                                            <td className="px-4 py-2">{payer.requires_attending ? '✅ Yes' : '❌ No'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-md">
                            <p className="text-yellow-800">⚠️ No payers found in database. You need to add insurance payers to test the search functionality.</p>
                        </div>
                    )}
                </div>

                {/* Providers Data */}
                <div className="mb-8">
                    <h2 className="text-xl font-semibold text-slate-800 mb-4">
                        👨‍⚕️ Providers Table ({providersData.length} records found)
                    </h2>
                    {providersData.length > 0 ? (
                        <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-stone-50">
                                    <tr>
                                        <th className="px-4 py-2 text-left">Name</th>
                                        <th className="px-4 py-2 text-left">Accepts New Patients</th>
                                        <th className="px-4 py-2 text-left">Telehealth Enabled</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {providersData.map((provider, index) => (
                                        <tr key={provider.id} className={index % 2 === 0 ? 'bg-white' : 'bg-stone-50'}>
                                            <td className="px-4 py-2 font-medium">
                                                {provider.first_name} {provider.last_name}
                                            </td>
                                            <td className="px-4 py-2">{provider.accepts_new_patients ? '✅ Yes' : '❌ No'}</td>
                                            <td className="px-4 py-2">{provider.telehealth_enabled ? '✅ Yes' : '❌ No'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-md">
                            <p className="text-yellow-800">⚠️ No providers found in database. You need to add providers to test availability.</p>
                        </div>
                    )}
                </div>

                {/* Services Data */}
                <div className="mb-8">
                    <h2 className="text-xl font-semibold text-slate-800 mb-4">
                        🏥 Services Table ({servicesData.length} records found)
                    </h2>
                    {servicesData.length > 0 ? (
                        <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-stone-50">
                                    <tr>
                                        <th className="px-4 py-2 text-left">Name</th>
                                        <th className="px-4 py-2 text-left">Description</th>
                                        <th className="px-4 py-2 text-left">Duration (min)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {servicesData.map((service, index) => (
                                        <tr key={service.id} className={index % 2 === 0 ? 'bg-white' : 'bg-stone-50'}>
                                            <td className="px-4 py-2 font-medium">{service.name}</td>
                                            <td className="px-4 py-2">{service.description}</td>
                                            <td className="px-4 py-2">{service.default_duration_minutes}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-md">
                            <p className="text-yellow-800">⚠️ No services found in database. You need to add services for appointment booking.</p>
                        </div>
                    )}
                </div>

                {/* Navigation */}
                <div className="text-center">
                    <a href="/" className="btn-primary mr-4">
                        ← Back to Booking Flow
                    </a>
                    <button onClick={testDatabaseConnection} className="btn-secondary">
                        🔄 Re-test Connection
                    </button>
                </div>
            </div>
        </div>
    )
}