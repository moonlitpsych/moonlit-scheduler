// src/components/booking/views/PayerSearchView.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, Check, Loader2, Calendar, Clock } from 'lucide-react'
import { Payer } from '@/types/database'
import { PayerService } from '@/services/payerService'

interface PayerSearchViewProps {
    onPayerSelected: (payer: Payer, acceptanceStatus: 'not-accepted' | 'future' | 'active') => void
    onCashPayment: () => void
}

interface SearchState {
    query: string
    results: Payer[]
    loading: boolean
    showResults: boolean
    selectedPayer: Payer | null
    processingState: 'idle' | 'accepting' | 'searching' | 'transitioning'
}

export default function PayerSearchView({ onPayerSelected, onCashPayment }: PayerSearchViewProps) {
    const [state, setState] = useState<SearchState>({
        query: '',
        results: [],
        loading: false,
        showResults: false,
        selectedPayer: null,
        processingState: 'idle'
    })

    const searchTimeout = useRef<NodeJS.Timeout>()
    const processingTimeout = useRef<NodeJS.Timeout>()

    const searchPayers = async (query: string) => {
        if (query.length < 2) {
            setState(prev => ({ ...prev, results: [], showResults: false }))
            return
        }

        setState(prev => ({ ...prev, loading: true }))

        try {
            const results = await PayerService.searchPayers(query)
            setState(prev => ({
                ...prev,
                results,
                loading: false,
                showResults: true
            }))
        } catch (error) {
            console.error('Error searching payers:', error)
            setState(prev => ({ ...prev, loading: false, showResults: false }))
        }
    }

    const handleInputChange = (value: string) => {
        setState(prev => ({ ...prev, query: value }))

        // Clear existing timeout
        if (searchTimeout.current) {
            clearTimeout(searchTimeout.current)
        }

        // Debounce search
        searchTimeout.current = setTimeout(() => {
            searchPayers(value)
        }, 300)
    }

    const handlePayerSelect = (payer: Payer) => {
        setState(prev => ({
            ...prev,
            selectedPayer: payer,
            showResults: false,
            processingState: 'accepting'
        }))

        // Start the enhanced animation sequence
        processPayerAcceptance(payer)
    }

    const processPayerAcceptance = async (payer: Payer) => {
        // Phase 1: Show "We accept your insurance!" for 2 seconds
        setState(prev => ({ ...prev, processingState: 'accepting' }))

        await new Promise(resolve => {
            processingTimeout.current = setTimeout(resolve, 2000)
        })

        // Phase 2: Show "Searching for time slots..." with animation
        setState(prev => ({ ...prev, processingState: 'searching' }))

        await new Promise(resolve => {
            processingTimeout.current = setTimeout(resolve, 2500)
        })

        // Phase 3: Transition to calendar
        setState(prev => ({ ...prev, processingState: 'transitioning' }))

        await new Promise(resolve => {
            processingTimeout.current = setTimeout(resolve, 500)
        })

        // Determine acceptance status (this would normally be from PayerService.checkAcceptanceStatus)
        const acceptanceStatus = PayerService.checkAcceptanceStatus(payer)
        onPayerSelected(payer, acceptanceStatus.status)
    }

    const resetSearch = () => {
        setState({
            query: '',
            results: [],
            loading: false,
            showResults: false,
            selectedPayer: null,
            processingState: 'idle'
        })

        if (processingTimeout.current) {
            clearTimeout(processingTimeout.current)
        }
    }

    useEffect(() => {
        return () => {
            if (searchTimeout.current) clearTimeout(searchTimeout.current)
            if (processingTimeout.current) clearTimeout(processingTimeout.current)
        }
    }, [])

    // Processing states rendering
    if (state.processingState === 'accepting') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-green-50/30 to-emerald-100 flex items-center justify-center">
                <div className="max-w-2xl mx-auto text-center px-4">
                    <div className="bg-white rounded-3xl shadow-xl p-12 transform animate-pulse">
                        <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
                            <Check className="w-10 h-10 text-white" />
                        </div>
                        <h1 className="text-4xl font-light text-slate-800 mb-4">
                            Great news!
                        </h1>
                        <p className="text-xl text-emerald-600 font-medium">
                            We accept your {state.selectedPayer?.name} insurance
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    if (state.processingState === 'searching') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50/30 to-blue-100 flex items-center justify-center">
                <div className="max-w-2xl mx-auto text-center px-4">
                    <div className="bg-white rounded-3xl shadow-xl p-12">
                        <div className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Loader2 className="w-10 h-10 text-white animate-spin" />
                        </div>
                        <h1 className="text-4xl font-light text-slate-800 mb-4">
                            Searching for time slots...
                        </h1>
                        <p className="text-lg text-slate-600 mb-8">
                            Finding the best available appointments with our providers
                        </p>

                        {/* Animated progress indicators */}
                        <div className="flex justify-center space-x-8 text-sm text-slate-500">
                            <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                                <span>Checking availability</span>
                            </div>
                            <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse delay-150"></div>
                                <span>Matching providers</span>
                            </div>
                            <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse delay-300"></div>
                                <span>Preparing calendar</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    if (state.processingState === 'transitioning') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50/30 to-orange-100 flex items-center justify-center">
                <div className="max-w-2xl mx-auto text-center px-4">
                    <div className="bg-white rounded-3xl shadow-xl p-12 transform scale-105">
                        <div className="w-20 h-20 bg-orange-300 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Calendar className="w-10 h-10 text-slate-800" />
                        </div>
                        <h1 className="text-4xl font-light text-slate-800 mb-4">
                            Perfect!
                        </h1>
                        <p className="text-lg text-slate-600">
                            Here are your available appointment times
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    // Main search interface
    return (
        <div className="min-h-screen bg-gradient-to-br from-stone-50 via-orange-50/30 to-stone-100">
            <div className="max-w-3xl mx-auto py-16 px-4">
                <div className="text-center mb-12">
                    <h1 className="text-5xl font-light text-slate-800 mb-6">
                        What insurance do you have?
                    </h1>
                    <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
                        Tell us about your insurance and we'll check if we're in-network with your plan.
                    </p>
                </div>

                <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
                    {/* Search Input */}
                    <div className="relative mb-6">
                        <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                            <Search className={`h-6 w-6 transition-colors ${state.query ? 'text-orange-400' : 'text-slate-400'
                                }`} />
                        </div>
                        <input
                            type="text"
                            value={state.query}
                            onChange={(e) => handleInputChange(e.target.value)}
                            placeholder="Type your insurance name (e.g., Blue Cross, Aetna, Cigna)"
                            className="
                                w-full bg-stone-50 border-2 border-stone-200 rounded-xl 
                                py-4 pl-16 pr-6 text-lg text-slate-800 placeholder-slate-500 
                                focus:outline-none focus:border-orange-300 focus:bg-white
                                transition-all duration-200
                            "
                            autoFocus
                        />

                        {state.loading && (
                            <div className="absolute inset-y-0 right-0 pr-6 flex items-center">
                                <Loader2 className="h-5 w-5 text-orange-400 animate-spin" />
                            </div>
                        )}
                    </div>

                    {/* Search Results */}
                    {state.showResults && (
                        <div className="space-y-3 mb-6">
                            {state.results.length > 0 ? (
                                <>
                                    <p className="text-sm text-slate-500 px-2 mb-4">
                                        Found {state.results.length} matching insurance plan{state.results.length > 1 ? 's' : ''}
                                    </p>
                                    {state.results.map((payer) => (
                                        <button
                                            key={payer.id}
                                            onClick={() => handlePayerSelect(payer)}
                                            className="
                                                w-full text-left p-4 rounded-xl border-2 border-stone-200 
                                                hover:border-orange-300 hover:bg-orange-50 
                                                transition-all duration-200 hover:shadow-md
                                                group
                                            "
                                        >
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="font-medium text-slate-800 group-hover:text-slate-900">
                                                        {payer.name}
                                                    </p>
                                                    {payer.effective_date && (
                                                        <p className="text-sm text-slate-500 mt-1">
                                                            Effective: {new Date(payer.effective_date).toLocaleDateString()}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="text-orange-400 group-hover:text-orange-500 transition-colors">
                                                    →
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </>
                            ) : (
                                <div className="text-center py-8">
                                    <p className="text-slate-500 mb-4">
                                        We couldn't find "{state.query}" in our system.
                                    </p>
                                    <p className="text-sm text-slate-400">
                                        Try searching with a different name or contact us directly.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Cash Payment Option */}
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-stone-200" />
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-4 bg-white text-slate-500">or</span>
                        </div>
                    </div>

                    <button
                        onClick={onCashPayment}
                        className="
                            w-full mt-6 py-4 px-6 border-2 border-stone-300 hover:border-orange-300 
                            text-slate-700 font-medium rounded-xl transition-all duration-200 
                            bg-white hover:bg-orange-50 hover:shadow-md
                        "
                    >
                        I plan to pay out of pocket
                    </button>
                </div>

                {/* Help Text */}
                <div className="text-center">
                    <p className="text-slate-500">
                        Don't see your insurance? <button className="text-orange-500 hover:text-orange-600 underline">Contact us</button> and we'll help you out.
                    </p>
                </div>
            </div>
        </div>
    )
}