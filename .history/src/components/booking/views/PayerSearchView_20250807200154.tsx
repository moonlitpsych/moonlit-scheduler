// src/components/booking/views/PayerSearchView.tsx
'use client'

import { payerService, PayerWithStatus } from '@/lib/services/PayerService'
import { AlertCircle, Check, ChevronRight, Clock, CreditCard, Loader2, Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import MedicaidManualVerificationView from './MedicaidManualVerificationView'

interface PayerSearchViewProps {
    onPayerSelected: (payer: PayerWithStatus | null) => void
    onBackToStart?: () => void
}

// Set this to true to use manual verification mode for Medicaid
const USE_MANUAL_MEDICAID_MODE = true

export default function PayerSearchView({
    onPayerSelected,
    onBackToStart
}: PayerSearchViewProps) {
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<PayerWithStatus[]>([])
    const [loading, setLoading] = useState(false)
    const [showMedicaidManual, setShowMedicaidManual] = useState(false)
    const [selectedPayer, setSelectedPayer] = useState<PayerWithStatus | null>(null)
    const [acceptedPayers, setAcceptedPayers] = useState<PayerWithStatus[]>([])
    const [patientInfo, setPatientInfo] = useState<any>({})
    const [initialLoadComplete, setInitialLoadComplete] = useState(false)

    // Load accepted payers on mount for quick selection
    useEffect(() => {
        loadAcceptedPayers()
    }, [])

    const loadAcceptedPayers = async () => {
        try {
            const accepted = await payerService.getAcceptedPayers()
            setAcceptedPayers(accepted)
            setInitialLoadComplete(true)
            console.log(`Loaded ${accepted.length} accepted payers`)
        } catch (error) {
            console.error('Error loading accepted payers:', error)
            setInitialLoadComplete(true)
        }
    }

    // Search payers using the service
    useEffect(() => {
        const searchTimeout = setTimeout(() => {
            if (searchQuery.length >= 2) {
                performSearch(searchQuery)
            } else if (searchQuery.length === 0) {
                setSearchResults([])
            }
        }, 300) // Debounce for 300ms

        return () => clearTimeout(searchTimeout)
    }, [searchQuery])

    const performSearch = async (query: string) => {
        setLoading(true)
        try {
            const results = await payerService.searchPayers(query)
            setSearchResults(results)
            console.log(`Found ${results.length} payers matching "${query}"`)
        } catch (error) {
            console.error('Search error:', error)
            setSearchResults([])
        } finally {
            setLoading(false)
        }
    }

    const handlePayerSelect = async (payer: PayerWithStatus) => {
        console.log('Selected payer:', payer.name, '- Status:', payer.acceptanceStatus)

        // Check if this is Medicaid
        const isMedicaid = payer.payer_type?.toLowerCase() === 'medicaid' ||
            payer.name?.toLowerCase().includes('medicaid')

        if (isMedicaid && USE_MANUAL_MEDICAID_MODE) {
            // Use manual verification for Medicaid
            setSelectedPayer(payer)
            setShowMedicaidManual(true)
        } else if (payer.acceptanceStatus === 'active') {
            // Active payer - proceed directly
            onPayerSelected(payer)
        } else if (payer.acceptanceStatus === 'future') {
            // Future payer - show waitlist option
            if (confirm(`${payer.name} will be accepted soon. ${payer.statusMessage}\n\nWould you like to join our waitlist?`)) {
                // TODO: Implement waitlist capture
                console.log('Add to waitlist for:', payer.name)
            }
        } else {
            // Not accepted - show message
            alert(`${payer.statusMessage}\n\nPlease choose a different insurance or select self-pay.`)
        }
    }

    const handleMedicaidManualVerification = async (result: any) => {
        console.log('Manual Medicaid verification result:', result)

        if (result.selfPay) {
            onPayerSelected(null)
        } else if (result.manualOverride && selectedPayer) {
            // Staff override - enhance payer with verification info
            const verifiedPayer: PayerWithStatus = {
                ...selectedPayer,
                acceptanceStatus: 'active',
                statusMessage: 'Manually verified by staff',
                medicaidVerified: true,
                medicaidPlan: result.currentPlan
            } as any
            onPayerSelected(verifiedPayer)
        }

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

    // Get status badge color
    const getStatusBadge = (status: 'active' | 'future' | 'not-accepted') => {
        switch (status) {
            case 'active':
                return (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                        <Check className="h-3 w-3 mr-1" />
                        Accepted
                    </span>
                )
            case 'future':
                return (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                        <Clock className="h-3 w-3 mr-1" />
                        Coming Soon
                    </span>
                )
            default:
                return (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                        <X className="h-3 w-3 mr-1" />
                        Not Accepted
                    </span>
                )
        }
    }

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
                        {loading && (
                            <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 
                                              h-5 w-5 animate-spin text-blue-500" />
                        )}
                    </div>
                </div>

                {/* Search Results */}
                {searchResults.length > 0 && (
                    <div className="mb-6">
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">
                            Search Results ({searchResults.length})
                        </h3>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            {searchResults.map((payer) => (
                                <button
                                    key={payer.id}
                                    onClick={() => handlePayerSelect(payer)}
                                    className={`w-full text-left p-3 border rounded-lg transition-all duration-200 
                                              ${payer.acceptanceStatus === 'active'
                                            ? 'border-green-200 hover:bg-green-50 hover:border-green-400'
                                            : payer.acceptanceStatus === 'future'
                                                ? 'border-yellow-200 hover:bg-yellow-50 hover:border-yellow-400'
                                                : 'border-gray-200 hover:bg-gray-50 hover:border-gray-300'}`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <p className="font-medium text-gray-800">
                                                {payer.name}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1">
                                                {getStatusBadge(payer.acceptanceStatus)}
                                                {payer.payer_type && (
                                                    <span className="text-xs text-gray-500">
                                                        {payer.payer_type}
                                                    </span>
                                                )}
                                            </div>
                                            {payer.statusMessage && (
                                                <p className="text-xs text-gray-600 mt-1">
                                                    {payer.statusMessage}
                                                </p>
                                            )}
                                        </div>
                                        <ChevronRight className="h-5 w-5 text-gray-400" />
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* No results message */}
                {searchQuery.length >= 2 && searchResults.length === 0 && !loading && (
                    <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                        <p className="text-gray-600">
                            No insurance plans found matching "{searchQuery}".
                            Try searching differently or choose self-pay below.
                        </p>
                    </div>
                )}

                {/* Currently Accepted Insurance (when not searching) */}
                {!searchQuery && acceptedPayers.length > 0 && (
                    <div className="mb-6">
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">
                            Currently Accepted Insurance
                        </h3>
                        <div className="space-y-2">
                            {acceptedPayers.slice(0, 5).map((payer) => (
                                <button
                                    key={payer.id}
                                    onClick={() => handlePayerSelect(payer)}
                                    className="w-full text-left p-3 border border-green-200 rounded-lg
                                             hover:bg-green-50 hover:border-green-400 transition-all
                                             duration-200 group"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <p className="font-medium text-gray-800">
                                                {payer.name}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1">
                                                {getStatusBadge('active')}
                                                {payer.requires_attending && (
                                                    <span className="text-xs text-purple-600">
                                                        Supervised Care
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <ChevronRight className="h-5 w-5 text-gray-400 
                                                                group-hover:text-green-600
                                                                transition-colors" />
                                    </div>
                                </button>
                            ))}
                        </div>
                        {acceptedPayers.length > 5 && (
                            <p className="text-sm text-gray-500 mt-2 text-center">
                                + {acceptedPayers.length - 5} more accepted plans (search above)
                            </p>
                        )}
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