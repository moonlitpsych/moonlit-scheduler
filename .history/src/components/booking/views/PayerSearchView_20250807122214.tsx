// src/components/booking/views/PayerSearchView.tsx
'use client'

import type { Payer } from '@/types/database'
import { createClient } from '@supabase/supabase-js'
import { AlertCircle, Check, ChevronRight, CreditCard, Loader2, Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import MedicaidChecker from '../MedicaidChecker'

// Initialize Supabase client
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface PayerSearchViewProps {
    onPayerSelected: (payer: Payer | null) => void
    onBackToStart?: () => void
}

export default function PayerSearchView({
    onPayerSelected,
    onBackToStart
}: PayerSearchViewProps) {
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<Payer[]>([])
    const [loading, setLoading] = useState(false)
    const [showMedicaidChecker, setShowMedicaidChecker] = useState(false)
    const [showVerificationResult, setShowVerificationResult] = useState(false)
    const [selectedPayer, setSelectedPayer] = useState<Payer | null>(null)
    const [allPayers, setAllPayers] = useState<Payer[]>([])
    const [popularPayers, setPopularPayers] = useState<Payer[]>([])
    const [medicaidVerificationResult, setMedicaidVerificationResult] = useState<any>(null)

    // Fetch all payers on mount
    useEffect(() => {
        fetchPayers()
    }, [])

    const fetchPayers = async () => {
        try {
            const { data, error } = await supabase
                .from('payers')
                .select('*')
                .order('name')

            if (error) throw error

            if (data) {
                setAllPayers(data)
                // Set popular payers (first 5 or specific ones)
                setPopularPayers(data.slice(0, 5))
            }
        } catch (error) {
            console.error('Error fetching payers:', error)
            // Fall back to mock data if database is not available
            const mockPayers = [
                { id: '1', name: 'Utah Medicaid', payer_type: 'medicaid', requires_attending: false },
                { id: '2', name: 'Blue Cross Blue Shield', payer_type: 'commercial', requires_attending: false },
                { id: '3', name: 'Aetna', payer_type: 'commercial', requires_attending: false },
                { id: '4', name: 'United Healthcare', payer_type: 'commercial', requires_attending: false },
                { id: '5', name: 'Cigna', payer_type: 'commercial', requires_attending: false },
            ]
            setAllPayers(mockPayers as any)
            setPopularPayers(mockPayers.slice(0, 3) as any)
        }
    }

    // Search functionality with debouncing
    useEffect(() => {
        const delayDebounce = setTimeout(() => {
            if (searchQuery.length > 1) {
                performSearch(searchQuery)
            } else if (searchQuery.length === 0) {
                setSearchResults([])
            }
        }, 300)

        return () => clearTimeout(delayDebounce)
    }, [searchQuery])

    const performSearch = async (query: string) => {
        setLoading(true)
        try {
            const filtered = allPayers.filter(payer =>
                payer.name?.toLowerCase().includes(query.toLowerCase())
            )
            setSearchResults(filtered)
        } catch (error) {
            console.error('Search error:', error)
        } finally {
            setLoading(false)
        }
    }

    const handlePayerSelect = async (payer: Payer) => {
        console.log('Selected payer:', payer)

        // Check if this is Utah Medicaid or any Medicaid plan
        const isMedicaid = payer.name?.toLowerCase().includes('medicaid') ||
            payer.payer_type?.toLowerCase() === 'medicaid'

        if (isMedicaid) {
            // Show Medicaid eligibility checker
            setSelectedPayer(payer)
            setShowMedicaidChecker(true)
            // Don't call onPayerSelected yet - wait for verification
        } else {
            // For non-Medicaid, proceed directly
            onPayerSelected(payer)
        }
    }

    const handleMedicaidVerification = async (result: any) => {
        console.log('Medicaid verification result:', result)
        setMedicaidVerificationResult(result)

        // Hide the checker, show the result
        setShowMedicaidChecker(false)
        setShowVerificationResult(true)
    }

    const handleContinueAfterVerification = () => {
        if (medicaidVerificationResult?.isAccepted) {
            // Medicaid plan is accepted, continue with booking
            const enhancedPayer = {
                ...selectedPayer,
                medicaidPlan: medicaidVerificationResult.currentPlan,
                medicaidVerified: true,
                medicaidAccepted: true
            }
            onPayerSelected(enhancedPayer as any)
        } else {
            // Handle not accepted - could show lead capture or self-pay options
            setShowVerificationResult(false)
            // Reset to search
            setSelectedPayer(null)
            setMedicaidVerificationResult(null)
        }
    }

    const handleSelfPay = () => {
        onPayerSelected(null) // null indicates self-pay
    }

    // Show Medicaid checker if needed
    if (showMedicaidChecker && selectedPayer) {
        return (
            <div className="max-w-2xl mx-auto">
                <MedicaidChecker
                    onVerificationComplete={handleMedicaidVerification}
                    patientInfo={{}} // Could pass in patient info if available
                />
                <button
                    onClick={() => {
                        setShowMedicaidChecker(false)
                        setSelectedPayer(null)
                    }}
                    className="w-full mt-4 text-gray-600 hover:text-gray-800 transition-colors text-center"
                >
                    ← Back to insurance search
                </button>
            </div>
        )
    }

    // Show verification result
    if (showVerificationResult && medicaidVerificationResult) {
        return (
            <div className="max-w-2xl mx-auto">
                <div className="bg-white rounded-lg shadow-lg p-6">
                    <div className="text-center mb-6">
                        <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${medicaidVerificationResult.isAccepted
                                ? 'bg-green-100'
                                : medicaidVerificationResult.enrolled
                                    ? 'bg-yellow-100'
                                    : 'bg-red-100'
                            }`}>
                            {medicaidVerificationResult.isAccepted ? (
                                <Check className="h-8 w-8 text-green-600" />
                            ) : medicaidVerificationResult.enrolled ? (
                                <AlertCircle className="h-8 w-8 text-yellow-600" />
                            ) : (
                                <X className="h-8 w-8 text-red-600" />
                            )}
                        </div>

                        <h2 className="text-2xl font-bold text-gray-800 mb-2">
                            {medicaidVerificationResult.isAccepted
                                ? 'Great News! We Accept Your Plan'
                                : medicaidVerificationResult.enrolled
                                    ? `We Don't Accept ${medicaidVerificationResult.currentPlan} Yet`
                                    : 'No Active Medicaid Coverage Found'}
                        </h2>

                        {medicaidVerificationResult.currentPlan && (
                            <p className="text-lg text-gray-600 mb-4">
                                Your Plan: <strong>{medicaidVerificationResult.currentPlan}</strong>
                            </p>
                        )}

                        <p className="text-gray-600">
                            {medicaidVerificationResult.message}
                        </p>
                    </div>

                    {medicaidVerificationResult.isAccepted ? (
                        // Accepted - continue to booking
                        <div className="space-y-3">
                            <button
                                onClick={handleContinueAfterVerification}
                                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold 
                         hover:bg-blue-700 transition-colors flex items-center justify-center"
                            >
                                Continue to Schedule Appointment
                                <ChevronRight className="ml-2 h-5 w-5" />
                            </button>

                            <button
                                onClick={() => {
                                    setShowVerificationResult(false)
                                    setSelectedPayer(null)
                                    setMedicaidVerificationResult(null)
                                }}
                                className="w-full text-gray-600 hover:text-gray-800 transition-colors"
                            >
                                ← Choose different insurance
                            </button>
                        </div>
                    ) : (
                        // Not accepted or not enrolled - show options
                        <div className="space-y-3">
                            {medicaidVerificationResult.enrolled && (
                                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                                    <h3 className="font-semibold text-gray-800 mb-2">Your Options:</h3>
                                    <ul className="space-y-2 text-gray-600">
                                        <li className="flex items-start">
                                            <span className="text-blue-600 mr-2">•</span>
                                            Pay out of pocket (we offer competitive self-pay rates)
                                        </li>
                                        <li className="flex items-start">
                                            <span className="text-blue-600 mr-2">•</span>
                                            Check if you can switch to an accepted plan (Fee-for-Service, UUHP, Optum, or Molina)
                                        </li>
                                        <li className="flex items-start">
                                            <span className="text-blue-600 mr-2">•</span>
                                            Join our waitlist for when we accept {medicaidVerificationResult.currentPlan}
                                        </li>
                                    </ul>
                                </div>
                            )}

                            <button
                                onClick={handleSelfPay}
                                className="w-full bg-gray-100 text-gray-700 py-3 px-6 rounded-lg font-semibold 
                         hover:bg-gray-200 transition-colors"
                            >
                                <CreditCard className="mr-2 h-5 w-5 inline" />
                                Continue with Self-Pay
                            </button>

                            <button
                                onClick={() => {
                                    // TODO: Implement lead capture
                                    alert('Lead capture form would go here - collect email/phone for waitlist')
                                }}
                                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold 
                         hover:bg-blue-700 transition-colors"
                            >
                                Join Waitlist
                            </button>

                            <button
                                onClick={() => {
                                    setShowVerificationResult(false)
                                    setSelectedPayer(null)
                                    setMedicaidVerificationResult(null)
                                }}
                                className="w-full text-gray-600 hover:text-gray-800 transition-colors"
                            >
                                ← Try different insurance
                            </button>
                        </div>
                    )}

                    {/* Show simulation mode notice if applicable */}
                    {medicaidVerificationResult.simulationMode && (
                        <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-start">
                                <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
                                <div className="text-sm text-blue-800">
                                    <p className="font-semibold">Test Mode</p>
                                    <p className="mt-1">
                                        This is a simulated response. In production, this will check real-time
                                        eligibility with Utah Medicaid via UHIN.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    // Default search view
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
                </div>

                {/* Search Input */}
                <div className="relative mb-6">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search for your insurance..."
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg 
                     focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     placeholder-gray-400"
                        autoFocus
                    />
                    {loading && (
                        <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 
                              text-gray-400 h-5 w-5 animate-spin" />
                    )}
                </div>

                {/* Search Results */}
                {searchResults.length > 0 && (
                    <div className="mb-6">
                        <p className="text-sm text-gray-600 mb-3">
                            {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
                        </p>
                        <div className="border border-gray-200 rounded-lg divide-y">
                            {searchResults.map(payer => (
                                <button
                                    key={payer.id}
                                    onClick={() => handlePayerSelect(payer)}
                                    className="w-full px-4 py-3 text-left hover:bg-gray-50 
                           transition-colors flex items-center justify-between group"
                                >
                                    <div>
                                        <span className="font-medium text-gray-800">
                                            {payer.name}
                                        </span>
                                        {payer.payer_type && (
                                            <span className="ml-2 text-xs text-gray-500 uppercase">
                                                {payer.payer_type}
                                            </span>
                                        )}
                                    </div>
                                    <ChevronRight className="text-gray-400 h-5 w-5 
                                         group-hover:text-gray-600 transition-colors" />
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Popular Insurance Options */}
                {!searchQuery && popularPayers.length > 0 && (
                    <div className="mb-6">
                        <p className="text-sm text-gray-600 mb-3 font-medium">
                            Popular insurance plans
                        </p>
                        <div className="space-y-2">
                            {popularPayers.map(payer => (
                                <button
                                    key={payer.id}
                                    onClick={() => handlePayerSelect(payer)}
                                    className="w-full px-4 py-3 text-left border border-gray-200 
                           rounded-lg hover:bg-gray-50 hover:border-gray-300 
                           transition-all flex items-center justify-between group"
                                >
                                    <span className="text-gray-800">{payer.name}</span>
                                    <ChevronRight className="text-gray-400 h-4 w-4 
                                         group-hover:text-gray-600 transition-colors" />
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Self-Pay Option */}
                <div className="pt-6 border-t">
                    <button
                        onClick={handleSelfPay}
                        className="w-full py-3 px-4 bg-gray-100 text-gray-700 rounded-lg 
                     hover:bg-gray-200 transition-colors flex items-center justify-center
                     font-medium"
                    >
                        <CreditCard className="mr-2 h-5 w-5" />
                        I plan to pay out of pocket
                    </button>
                </div>

                {/* Information Box */}
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start">
                        <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
                        <div className="text-sm text-blue-800">
                            <p className="font-semibold mb-1">Insurance Verification</p>
                            <p>
                                We'll verify your coverage before your appointment. If you have Utah Medicaid,
                                we'll check which specific plan you have to ensure we can accept it.
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