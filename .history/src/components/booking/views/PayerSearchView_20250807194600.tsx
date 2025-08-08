// src/components/booking/views/PayerSearchView.tsx
'use client'

import { supabase } from '@/lib/supabase'; // Use the existing singleton!
import type { Payer } from '@/types/database'
import { AlertCircle, ChevronRight, CreditCard, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import MedicaidManualVerificationView from './MedicaidManualVerificationView'

interface PayerSearchViewProps {
    onPayerSelected: (payer: Payer | null) => void
    onBackToStart?: () => void
}

// Set this to true to use manual verification mode for Medicaid
// Change to false when UHIN credentials are working
const USE_MANUAL_MEDICAID_MODE = true

// Mock payers for development/testing when database is empty
const MOCK_PAYERS = [
    { id: '1', name: 'Utah Medicaid', payer_type: 'medicaid', state: 'UT', requires_attending: false },
    { id: '2', name: 'Blue Cross Blue Shield of Utah', payer_type: 'commercial', state: 'UT', requires_attending: false },
    { id: '3', name: 'Aetna', payer_type: 'commercial', state: 'UT', requires_attending: false },
    { id: '4', name: 'United Healthcare', payer_type: 'commercial', state: 'UT', requires_attending: false },
    { id: '5', name: 'Cigna', payer_type: 'commercial', state: 'UT', requires_attending: false },
    { id: '6', name: 'SelectHealth', payer_type: 'commercial', state: 'UT', requires_attending: false },
    { id: '7', name: 'Molina Healthcare', payer_type: 'medicaid_mco', state: 'UT', requires_attending: false },
    { id: '8', name: 'University of Utah Health Plans', payer_type: 'medicaid_mco', state: 'UT', requires_attending: false },
    { id: '9', name: 'Optum', payer_type: 'medicaid_mco', state: 'UT', requires_attending: false },
    { id: '10', name: 'PEHP (Public Employees Health Program)', payer_type: 'commercial', state: 'UT', requires_attending: false }
]

export default function PayerSearchView({
    onPayerSelected,
    onBackToStart
}: PayerSearchViewProps) {
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<Payer[]>([])
    const [loading, setLoading] = useState(false)
    const [showMedicaidManual, setShowMedicaidManual] = useState(false)
    const [selectedPayer, setSelectedPayer] = useState<Payer | null>(null)
    const [allPayers, setAllPayers] = useState<Payer[]>([])
    const [popularPayers, setPopularPayers] = useState<Payer[]>([])
    const [patientInfo, setPatientInfo] = useState<any>({})
    const [useMockData, setUseMockData] = useState(false)

    // Fetch all payers on mount
    useEffect(() => {
        fetchPayers()
    }, [])

    const fetchPayers = async () => {
        console.log('Fetching payers from Supabase...')
        setLoading(true)

        try {
            const { data, error } = await supabase
                .from('payers')
                .select('*')
                .order('name')

            if (error) {
                console.error('Supabase error:', error)
                throw error
            }

            if (data && data.length > 0) {
                console.log(`✅ Loaded ${data.length} payers from database`)
                setAllPayers(data)

                // Set popular payers - prioritize certain names
                const popularNames = ['Blue Cross Blue Shield', 'Aetna', 'United Healthcare', 'Utah Medicaid', 'SelectHealth']
                const popularList = data.filter(p =>
                    popularNames.some(name => p.name?.toLowerCase().includes(name.toLowerCase()))
                )

                // If we found popular ones, use them, otherwise just take first 5
                setPopularPayers(popularList.length > 0 ? popularList.slice(0, 5) : data.slice(0, 5))
                setUseMockData(false)
            } else {
                console.log('⚠️ No payers in database, using mock data')
                setAllPayers(MOCK_PAYERS as any)
                setPopularPayers(MOCK_PAYERS.slice(0, 5) as any)
                setUseMockData(true)
            }
        } catch (error) {
            console.error('❌ Error fetching payers, falling back to mock data:', error)
            // Use mock data as fallback
            setAllPayers(MOCK_PAYERS as any)
            setPopularPayers(MOCK_PAYERS.slice(0, 5) as any)
            setUseMockData(true)
        } finally {
            setLoading(false)
        }
    }

    // Search functionality - immediate search as user types
    useEffect(() => {
        if (searchQuery.length > 0) {
            performSearch(searchQuery)
        } else {
            setSearchResults([])
        }
    }, [searchQuery, allPayers])

    const performSearch = (query: string) => {
        const searchLower = query.toLowerCase()

        const filtered = allPayers.filter(payer => {
            const payerName = payer.name?.toLowerCase() || ''
            const payerType = payer.payer_type?.toLowerCase() || ''

            // Search in both name and type fields
            return payerName.includes(searchLower) || payerType.includes(searchLower)
        })

        console.log(`Search "${query}": found ${filtered.length} results`)
        setSearchResults(filtered)
    }

    const handlePayerSelect = async (payer: Payer) => {
        console.log('Selected payer:', payer)

        // Check if this is Utah Medicaid or any Medicaid plan
        const isMedicaid = payer.name?.toLowerCase().includes('medicaid') ||
            payer.payer_type?.toLowerCase() === 'medicaid' ||
            payer.payer_type?.toLowerCase() === 'medicaid_mco'

        if (isMedicaid && USE_MANUAL_MEDICAID_MODE) {
            // Use manual verification mode
            setSelectedPayer(payer)
            setShowMedicaidManual(true)
        } else if (isMedicaid) {
            // When UHIN credentials are working, show automatic verification
            alert('Automatic Medicaid verification will be enabled once UHIN credentials are active')
        } else {
            // For non-Medicaid, proceed directly
            onPayerSelected(payer)
        }
    }

    const handleMedicaidManualVerification = async (result: any) => {
        console.log('Manual Medicaid verification result:', result)

        if (result.selfPay) {
            // User chose self-pay
            onPayerSelected(null)
        } else if (result.manualOverride) {
            // Staff override - proceed with booking
            const enhancedPayer = {
                ...selectedPayer!,
                medicaidPlan: result.currentPlan,
                medicaidVerified: true,
                medicaidAccepted: true,
                manuallyVerified: true
            }
            onPayerSelected(enhancedPayer as any)
        }

        // Reset states
        setShowMedicaidManual(false)
        setSelectedPayer(null)
    }

    // Show manual Medicaid verification view
    if (showMedicaidManual && selectedPayer) {
        return (
            <MedicaidManualVerificationView
                patientInfo={patientInfo}
                onVerificationComplete={handleMedicaidManualVerification}
                onBack={() => {
                    setShowMedicaidManual(false)
                    setSelectedPayer(null)
                }}
            />
        )
    }

    // Main search view
    return (
        <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-lg shadow-lg p-6">
                {/* Header */}
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">
                        How will you pay for your visit?
                    </h2>
                    <p className="text-gray-600">
                        We accept many insurance plans and offer self-pay options.
                    </p>
                    {useMockData && (
                        <p className="text-xs text-orange-600 mt-1">
                            (Using sample data - database connection pending)
                        </p>
                    )}
                </div>

                {/* Search Box */}
                <div className="mb-6">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 
                                        text-gray-400 h-5 w-5" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search for your insurance (e.g., Aetna, Blue Cross, Medicaid)..."
                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg 
                                     focus:ring-2 focus:ring-blue-500 focus:border-transparent
                                     transition-all duration-200"
                        />
                    </div>
                </div>

                {/* Search Results */}
                {searchQuery && searchResults.length > 0 && (
                    <div className="mb-6">
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">
                            Search Results ({searchResults.length})
                        </h3>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            {searchResults.map((payer) => (
                                <button
                                    key={payer.id}
                                    onClick={() => handlePayerSelect(payer)}
                                    className="w-full text-left p-3 border border-gray-200 rounded-lg
                                             hover:bg-gray-50 hover:border-blue-500 transition-all
                                             duration-200 group"
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-medium text-gray-800">
                                                {payer.name}
                                            </p>
                                            {payer.payer_type && (
                                                <p className="text-xs text-gray-500">
                                                    Type: {payer.payer_type}
                                                </p>
                                            )}
                                        </div>
                                        <ChevronRight className="h-5 w-5 text-gray-400 
                                                                group-hover:text-blue-500
                                                                transition-colors" />
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* No results message */}
                {searchQuery && searchResults.length === 0 && (
                    <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                        <p className="text-gray-600">
                            No insurance plans found matching "{searchQuery}".
                            Try searching differently or choose self-pay below.
                        </p>
                    </div>
                )}

                {/* Popular Insurance Options (when not searching) */}
                {!searchQuery && popularPayers.length > 0 && (
                    <div className="mb-6">
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">
                            Popular Insurance Plans
                        </h3>
                        <div className="space-y-2">
                            {popularPayers.map((payer) => (
                                <button
                                    key={payer.id}
                                    onClick={() => handlePayerSelect(payer)}
                                    className="w-full text-left p-3 border border-gray-200 rounded-lg
                                             hover:bg-gray-50 hover:border-blue-500 transition-all
                                             duration-200 group"
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-medium text-gray-800">
                                                {payer.name}
                                            </p>
                                        </div>
                                        <ChevronRight className="h-5 w-5 text-gray-400 
                                                                group-hover:text-blue-500
                                                                transition-colors" />
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Self-Pay Option */}
                <div className="border-t pt-6">
                    <button
                        onClick={() => onPayerSelected(null)}
                        className="w-full p-4 bg-gray-50 rounded-lg hover:bg-gray-100
                                 transition-colors group"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <CreditCard className="h-6 w-6 text-gray-600 mr-3" />
                                <div className="text-left">
                                    <p className="font-semibold text-gray-800">
                                        Self-Pay
                                    </p>
                                    <p className="text-sm text-gray-600">
                                        Pay out-of-pocket for your visit
                                    </p>
                                </div>
                            </div>
                            <ChevronRight className="h-5 w-5 text-gray-400 
                                                    group-hover:text-blue-500
                                                    transition-colors" />
                        </div>
                    </button>
                </div>

                {/* Note about Medicaid */}
                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-start">
                        <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
                        <div className="text-sm text-blue-800">
                            <p className="font-semibold">Utah Medicaid Patients</p>
                            <p className="mt-1">
                                If you have Utah Medicaid, we'll need to verify your specific plan.
                                {USE_MANUAL_MEDICAID_MODE
                                    ? " You'll be asked to call our office for verification."
                                    : " We'll check which specific plan you have to ensure we can accept it."}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Back Button */}
                {onBackToStart && (
                    <button
                        onClick={onBackToStart}
                        className="w-full mt-4 text-gray-600 hover:text-gray-800 
                                 transition-colors text-center text-sm"
                    >
                        ← Start over
                    </button>
                )}
            </div>
        </div>
    )
}