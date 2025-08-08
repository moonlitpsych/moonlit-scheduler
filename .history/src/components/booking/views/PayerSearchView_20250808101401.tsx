// src/components/booking/views/PayerSearchView.tsx
'use client'

import { payerService, PayerWithStatus } from '@/lib/services/PayerService'
import { AlertCircle, Check, ChevronRight, Clock, CreditCard, Loader2, Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'

interface PayerSearchViewProps {
    onPayerSelected: (payer: PayerWithStatus | null) => void
    onBackToStart?: () => void
}

export default function PayerSearchView({
    onPayerSelected,
    onBackToStart
}: PayerSearchViewProps) {
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<PayerWithStatus[]>([])
    const [loading, setLoading] = useState(false)
    const [acceptedPayers, setAcceptedPayers] = useState<PayerWithStatus[]>([])
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

        // SIMPLIFIED: Treat Medicaid like any other insurance
        if (payer.acceptanceStatus === 'active') {
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

    const handleSelfPay = () => {
        onPayerSelected(null) // null indicates self-pay
    }

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
                {/* Header */}
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">
                        How will you pay for your visit?
                    </h2>
                    <p className="text-gray-600">
                        Search for your insurance provider or choose to pay out of pocket
                    </p>
                </div>

                {/* Search Box */}
                <div className="relative mb-6">
                    <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search for your insurance (e.g., Medicaid, SelectHealth, PEHP)"
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        autoFocus
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-3"
                        >
                            <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                        </button>
                    )}
                </div>

                {/* Search Results */}
                {loading && (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                    </div>
                )}

                {!loading && searchResults.length > 0 && (
                    <div className="space-y-2 mb-6">
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">
                            Search Results ({searchResults.length})
                        </h3>
                        {searchResults.map((payer) => (
                            <button
                                key={payer.id}
                                onClick={() => handlePayerSelect(payer)}
                                className="w-full text-left p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                        {payer.acceptanceStatus === 'active' ? (
                                            <Check className="h-5 w-5 text-green-500" />
                                        ) : payer.acceptanceStatus === 'future' ? (
                                            <Clock className="h-5 w-5 text-yellow-500" />
                                        ) : (
                                            <X className="h-5 w-5 text-red-500" />
                                        )}
                                        <div>
                                            <p className="font-medium text-gray-800">{payer.name}</p>
                                            <p className="text-sm text-gray-600">{payer.statusMessage}</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="h-5 w-5 text-gray-400" />
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {/* Quick Select for Common Payers */}
                {!searchQuery && initialLoadComplete && acceptedPayers.length > 0 && (
                    <div className="mb-6">
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">
                            Common Insurance Providers
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {acceptedPayers.slice(0, 6).map((payer) => (
                                <button
                                    key={payer.id}
                                    onClick={() => handlePayerSelect(payer)}
                                    className="p-3 border rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors text-sm font-medium text-gray-700"
                                >
                                    {payer.name}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Self-Pay Option */}
                <div className="border-t pt-6">
                    <button
                        onClick={handleSelfPay}
                        className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        <div className="flex items-center space-x-3">
                            <CreditCard className="h-5 w-5 text-gray-600" />
                            <div className="text-left">
                                <p className="font-medium text-gray-800">
                                    I'll pay out of pocket
                                </p>
                                <p className="text-sm text-gray-600">
                                    No insurance needed - pay directly for your visit
                                </p>
                            </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-gray-400" />
                    </button>
                </div>

                {/* Back Button */}
                {onBackToStart && (
                    <div className="mt-6">
                        <button
                            onClick={onBackToStart}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                            ← Back to start
                        </button>
                    </div>
                )}
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                    <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div className="text-sm text-blue-800">
                        <p className="font-semibold mb-1">Insurance Verification</p>
                        <p>
                            We'll verify your insurance coverage before confirming your appointment.
                            If you have questions about coverage, please contact us at (801) 555-0123.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}