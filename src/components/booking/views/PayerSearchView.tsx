// src/components/booking/views/PayerSearchView.tsx
// COMPLETE REPLACEMENT - Uses Real Supabase Data

'use client'

import { payerService, PayerWithStatus } from '@/lib/services/PayerService'
import { ArrowRight, CheckCircle, Clock, Loader2, Search, XCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

// Define BookingScenario locally to avoid import issues
export type BookingScenario = 'self' | 'referral' | 'case-manager'

interface SearchState {
    query: string
    results: PayerWithStatus[]
    loading: boolean
    showResults: boolean
    processingState: 'idle' | 'celebrating' | 'transitioning'
}

interface PayerSearchViewProps {
    bookingScenario: BookingScenario
    onPayerSelected: (payer: PayerWithStatus, acceptanceStatus: PayerWithStatus['acceptanceStatus']) => void
    onBack: () => void
}

export default function PayerSearchView({ 
    bookingScenario, 
    onPayerSelected, 
    onBack 
}: PayerSearchViewProps) {
    const [state, setState] = useState<SearchState>({
        query: '',
        results: [],
        loading: false,
        showResults: false,
        processingState: 'idle'
    })

    const searchTimeoutRef = useRef<NodeJS.Timeout>()
    const inputRef = useRef<HTMLInputElement>(null)

    // Focus input on mount
    useEffect(() => {
        inputRef.current?.focus()
    }, [])

    // Real Supabase search function - replaces mock data!
    const performSearch = async (query: string) => {
        if (!query || query.length < 2) {
            setState(prev => ({ ...prev, results: [], showResults: false, loading: false }))
            return
        }

        setState(prev => ({ ...prev, loading: true }))

        try {
            // Use real PayerService instead of mock data
            const results = await payerService.searchPayers(query)
            
            setState(prev => ({
                ...prev,
                results,
                loading: false,
                showResults: results.length > 0
            }))
        } catch (error) {
            console.error('Search error:', error)
            setState(prev => ({
                ...prev,
                results: [],
                loading: false,
                showResults: false
            }))
        }
    }

    // Debounced search
    const handleSearchChange = (value: string) => {
        setState(prev => ({ ...prev, query: value }))

        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current)
        }

        searchTimeoutRef.current = setTimeout(() => {
            performSearch(value)
        }, 300)
    }

    // Handle payer selection with real status
    const handlePayerClick = (payer: PayerWithStatus) => {
        setState(prev => ({ ...prev, processingState: 'celebrating' }))
        
        // Use the real acceptance status from PayerService
        setTimeout(() => {
            setState(prev => ({ ...prev, processingState: 'transitioning' }))
            setTimeout(() => {
                onPayerSelected(payer, payer.acceptanceStatus)
            }, 500)
        }, 1500)
    }

    // Handle cash payment option
    const handleCashPayment = () => {
        const cashPayer: PayerWithStatus = {
            id: 'cash',
            name: 'Self-Pay / Cash',
            payer_type: 'Cash',
            state: null,
            effective_date: null,
            requires_attending: false,
            credentialing_status: 'N/A',
            notes: null,
            created_at: null,
            projected_effective_date: null,
            requires_individual_contract: false,
            acceptanceStatus: 'active',
            statusMessage: 'Self-pay appointment - no insurance needed.'
        }
        
        handlePayerClick(cashPayer)
    }

    // Get status icon for payer
    const getStatusIcon = (payer: PayerWithStatus) => {
        switch (payer.acceptanceStatus) {
            case 'active':
                return <CheckCircle className="w-5 h-5 text-green-500" />
            case 'future':
                return <Clock className="w-5 h-5 text-orange-500" />
            case 'not-accepted':
                return <XCircle className="w-5 h-5 text-red-500" />
        }
    }

    // Get status color for styling
    const getStatusColor = (payer: PayerWithStatus) => {
        switch (payer.acceptanceStatus) {
            case 'active':
                return 'border-green-200 bg-green-50 hover:bg-green-100'
            case 'future':
                return 'border-orange-200 bg-orange-50 hover:bg-orange-100'
            case 'not-accepted':
                return 'border-red-200 bg-red-50 hover:bg-red-100'
        }
    }

    const getTitle = () => {
        switch (bookingScenario) {
            case 'self':
                return 'What insurance do you have?'
            case 'referral':
                return 'What insurance does the patient have?'
            case 'case-manager':
                return 'What insurance does your client have?'
            default:
                return 'What insurance do you have?'
        }
    }

    const getDescription = () => {
        switch (bookingScenario) {
            case 'self':
                return 'Search for your insurance provider to see if we\'re in network and book an appointment.'
            case 'referral':
                return 'Search for the patient\'s insurance to check network status and availability.'
            case 'case-manager':
                return 'Search for your client\'s insurance to check coverage and schedule their appointment.'
            default:
                return 'Search for your insurance provider below.'
        }
    }

    if (state.processingState === 'celebrating') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle className="w-12 h-12 text-white" />
                    </div>
                    <h2 className="text-2xl font-semibold text-green-800 mb-2">Great choice!</h2>
                    <p className="text-green-600">Processing your selection...</p>
                </div>
            </div>
        )
    }

    if (state.processingState === 'transitioning') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
                    <p className="text-blue-600">Loading calendar...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-stone-50 via-orange-50/30 to-stone-100" style={{ fontFamily: 'Newsreader, serif' }}>
            <div className="max-w-4xl mx-auto py-16 px-4">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-light text-slate-800 mb-6">
                        {getTitle()}
                    </h1>
                    <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                        {getDescription()}
                    </p>
                </div>

                {/* Search Input */}
                <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder="Type your insurance provider name..."
                            value={state.query}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            className="w-full pl-12 pr-4 py-4 text-lg border-2 border-slate-200 rounded-xl focus:border-orange-300 focus:outline-none transition-colors"
                            style={{ fontFamily: 'Newsreader, serif' }}
                        />
                        {state.loading && (
                            <Loader2 className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 animate-spin text-slate-400" />
                        )}
                    </div>
                </div>

                {/* Search Results */}
                {state.showResults && (
                    <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
                        <h3 className="text-xl font-semibold text-slate-800 mb-6">Search Results</h3>
                        <div className="space-y-3">
                            {state.results.map((payer) => (
                                <button
                                    key={payer.id}
                                    onClick={() => handlePayerClick(payer)}
                                    className={`
                                        w-full p-4 rounded-xl border-2 text-left transition-all duration-200
                                        ${getStatusColor(payer)}
                                        hover:scale-[1.02] hover:shadow-md
                                    `}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-3">
                                            {getStatusIcon(payer)}
                                            <div>
                                                <h4 className="font-medium text-slate-800">
                                                    {payer.name}
                                                </h4>
                                                <p className="text-sm text-slate-600">
                                                    {payer.statusMessage}
                                                </p>
                                                {payer.payer_type && (
                                                    <span className="inline-block mt-1 px-2 py-1 bg-slate-100 text-xs text-slate-600 rounded">
                                                        {payerService.getPayerTypeDescription(payer)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <ArrowRight className="w-5 h-5 text-slate-400" />
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* No Results */}
                {state.query.length >= 2 && !state.loading && state.results.length === 0 && (
                    <div className="bg-white rounded-2xl shadow-xl p-8 mb-8 text-center">
                        <h3 className="text-xl font-semibold text-slate-800 mb-4">No results found</h3>
                        <p className="text-slate-600 mb-6">
                            We couldn't find "{state.query}" in our database. You can still book as self-pay 
                            or submit a request for us to consider this insurance.
                        </p>
                        <button
                            onClick={handleCashPayment}
                            className="bg-orange-300 hover:bg-orange-400 text-slate-800 font-medium py-3 px-6 rounded-xl transition-colors"
                        >
                            Continue as Self-Pay
                        </button>
                    </div>
                )}

                {/* Cash Payment Option */}
                <div className="bg-white rounded-2xl shadow-xl p-8">
                    <div className="text-center">
                        <h3 className="text-xl font-semibold text-slate-800 mb-4">
                            Don't have insurance or prefer to pay directly?
                        </h3>
                        <p className="text-slate-600 mb-6">
                            You can book a self-pay appointment without insurance verification.
                        </p>
                        <button
                            onClick={handleCashPayment}
                            className="border-2 border-orange-300 hover:bg-orange-50 text-slate-800 font-medium py-3 px-8 rounded-xl transition-colors"
                        >
                            I plan to pay out of pocket
                        </button>
                    </div>
                </div>

                {/* Back Button */}
                <div className="text-center mt-8">
                    <button
                        onClick={onBack}
                        className="text-slate-600 hover:text-slate-800 underline transition-colors"
                    >
                        ← Go back
                    </button>
                </div>
            </div>
        </div>
    )
}