'use client'

import { supabase } from '@/lib/supabase'
import { Payer } from '@/types/database'
import { Calendar, Check, Clock, CreditCard, Loader2, Search, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { BookingScenario, BookingIntent } from './WelcomeView'

interface PayerSearchState {
    query: string
    results: Payer[]
    loading: boolean
    showResults: boolean
    error: string | null
}

interface PayerSearchViewProps {
    onPayerSelected: (payer: Payer, acceptanceStatus: 'not-accepted' | 'future' | 'active' | 'waitlist') => void
    bookingScenario: BookingScenario
    intent: BookingIntent
    onBack?: () => void
}

export default function PayerSearchView({ onPayerSelected, bookingScenario, intent, onBack }: PayerSearchViewProps) {
    const [state, setState] = useState<PayerSearchState>({
        query: '',
        results: [],
        loading: false,
        showResults: false,
        error: null
    })

    // Direct Supabase search function
    const searchPayers = useCallback(async (query: string) => {
        if (query.length < 2) {
            setState(prev => ({ ...prev, showResults: false, results: [] }))
            return
        }

        setState(prev => ({ ...prev, loading: true, error: null }))

        try {
            console.log('🔍 Searching payers for:', query)
            
            const { data: payers, error } = await supabase
                .from('payers')
                .select('*')
                .ilike('name', `%${query}%`)
                .order('name')
                .limit(10)

            if (error) {
                console.error('❌ Supabase error:', error)
                throw error
            }

            console.log('✅ Found payers:', payers?.length || 0)
            
            // Sort results by acceptance priority: active > future > waitlist > not-accepted
            const sortedPayers = (payers || []).sort((a, b) => {
                const getAcceptancePriority = (payer: any) => {
                    const statusCode = payer.status_code
                    const effectiveDate = payer.effective_date ? new Date(payer.effective_date) : null
                    const now = new Date()

                    // Not accepted (lowest priority)
                    if (['denied', 'blocked', 'withdrawn', 'on_pause'].includes(statusCode || '') || 
                        (!statusCode || !['approved', 'waiting_on_them', 'in_progress', 'not_started'].includes(statusCode))) {
                        return 4
                    }
                    // Active (highest priority)
                    else if (statusCode === 'approved' && effectiveDate && effectiveDate <= now) {
                        return 1
                    }
                    // Future (second priority)  
                    else if (statusCode === 'approved' && effectiveDate && effectiveDate > now && 
                             Math.ceil((effectiveDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) <= 21) {
                        return 2
                    }
                    // Waitlist (third priority)
                    else {
                        return 3
                    }
                }

                return getAcceptancePriority(a) - getAcceptancePriority(b)
            })
            
            setState(prev => ({
                ...prev,
                results: sortedPayers,
                loading: false,
                showResults: true
            }))
        } catch (error: any) {
            console.error('💥 Search error:', error)
            setState(prev => ({
                ...prev,
                loading: false,
                error: `Search failed: ${error.message}`,
                showResults: false
            }))
        }
    }, [])

    // Debounce the search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (state.query) {
                searchPayers(state.query)
            }
        }, 300)

        return () => clearTimeout(timer)
    }, [state.query, searchPayers])

    const handleInputChange = (value: string) => {
        setState(prev => ({ ...prev, query: value }))
    }

    const handlePayerSelect = (payer: Payer) => {
        console.log('🎯 Payer selected:', payer.name)
        
        // Determine acceptance status based on status_code + effective_date
        const now = new Date()
        let acceptanceStatus: 'not-accepted' | 'future' | 'active' | 'waitlist' = 'not-accepted'

        const statusCode = payer.status_code

        // Handle denied/blocked/rejected statuses
        if (['denied', 'blocked', 'withdrawn', 'on_pause'].includes(statusCode || '')) {
            acceptanceStatus = 'not-accepted'
        }
        // Handle approved status
        else if (statusCode === 'approved') {
            if (payer.effective_date) {
                const effectiveDate = new Date(payer.effective_date)
                if (effectiveDate <= now) {
                    acceptanceStatus = 'active'
                } else {
                    const daysUntilActive = Math.ceil((effectiveDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                    acceptanceStatus = daysUntilActive > 21 ? 'waitlist' : 'future'
                }
            } else {
                // Approved but no effective date - waitlist case
                acceptanceStatus = 'waitlist'
            }
        }
        // Handle in-progress statuses (waiting_on_them, in_progress, not_started)
        else if (['waiting_on_them', 'in_progress', 'not_started'].includes(statusCode || '')) {
            acceptanceStatus = 'waitlist'
        }
        // Unknown/null status - not accepted
        else {
            acceptanceStatus = 'not-accepted'
        }

        console.log('📊 Status code:', statusCode, '→ Acceptance status:', acceptanceStatus)
        onPayerSelected(payer, acceptanceStatus)
    }

    const handleCashPayment = () => {
        console.log('💳 Cash payment selected')
        
        // Create a mock payer for cash payment
        const cashPayer: Payer = {
            id: 'cash-payment',
            name: 'Cash Payment',
            payer_type: 'cash',
            state: 'UT',
            effective_date: new Date().toISOString(),
            requires_attending: false,
            status_code: 'active',
            notes: 'Self-pay patient',
            created_at: new Date().toISOString(),
            projected_effective_date: null,
            requires_individual_contract: false
        }

        onPayerSelected(cashPayer, 'active')
    }

    const getScenarioTitle = () => {
        if (intent === 'explore') {
            switch (bookingScenario) {
                case 'self':
                    return 'What insurance would you be paying with?'
                case 'case-manager':
                    return 'What insurance would the patient be paying with?'
                case 'referral':
                    return 'What insurance would your patient be paying with?'
                default:
                    return 'Insurance Information'
            }
        } else {
            switch (bookingScenario) {
                case 'self':
                    return 'What insurance do you have?'
                case 'case-manager':
                    return 'What insurance does the patient have?'
                case 'referral':
                    return 'What insurance does your patient have?'
                default:
                    return 'Insurance Information'
            }
        }
    }

    const getScenarioSubtitle = () => {
        if (intent === 'explore') {
            switch (bookingScenario) {
                case 'self':
                    return 'This helps us show you the most relevant practitioner availability'
                case 'case-manager':
                    return 'This helps us show you the most relevant practitioner availability for the patient'
                case 'referral':
                    return 'This helps us show you the most relevant practitioner availability for your patient'
                default:
                    return 'This helps us show you the most relevant practitioner availability'
            }
        } else {
            switch (bookingScenario) {
                case 'self':
                    return 'Search for your insurance provider below'
                case 'case-manager':
                    return 'Search for the patient\'s insurance provider'
                case 'referral':
                    return 'Search for the patient\'s insurance provider'
                default:
                    return 'Search for insurance provider'
            }
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-stone-50 via-orange-50/30 to-stone-100">
            <div className="max-w-4xl mx-auto px-6 py-12">
                {/* Header */}
                <div className="text-center mb-12">
                    {onBack && (
                        <button
                            onClick={onBack}
                            className="absolute top-8 left-8 p-3 hover:bg-white/50 rounded-xl transition-colors"
                        >
                            ← Back
                        </button>
                    )}
                    
                    <h1 className="text-4xl font-bold text-slate-800 mb-4 font-['Newsreader']">
                        {getScenarioTitle()}
                    </h1>
                    <p className="text-xl text-slate-600">
                        {getScenarioSubtitle()}
                    </p>
                </div>

                <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
                    {/* Search Input */}
                    <div className="relative mb-6">
                        <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                            <Search className={`h-6 w-6 transition-colors ${
                                state.query ? 'text-orange-400' : 'text-slate-400'
                            }`} />
                        </div>
                        <input
                            type="text"
                            value={state.query}
                            onChange={(e) => handleInputChange(e.target.value)}
                            placeholder="Type your insurance name (e.g., Molina, Blue Cross, Aetna, Cigna, Medicaid)"
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

                        {state.query && !state.loading && (
                            <button
                                onClick={() => setState(prev => ({ ...prev, query: '', showResults: false }))}
                                className="absolute inset-y-0 right-0 pr-6 flex items-center hover:bg-stone-100 rounded-r-xl transition-colors"
                            >
                                <X className="h-5 w-5 text-slate-400 hover:text-slate-600" />
                            </button>
                        )}
                    </div>

                    {/* Error State */}
                    {state.error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                            <p className="text-red-700">{state.error}</p>
                            <p className="text-red-600 text-sm mt-1">
                                Please try again or contact support if the issue persists.
                            </p>
                        </div>
                    )}

                    {/* Search Results */}
                    {state.showResults && (
                        <div className="space-y-3 mb-6">
                            {state.results.length > 0 ? (
                                <>
                                    <p className="text-sm text-slate-500 px-2 mb-4">
                                        Found {state.results.length} matching insurance plan{state.results.length > 1 ? 's' : ''}
                                    </p>
                                    {state.results.map((payer) => {
                                        const now = new Date()
                                        const effectiveDate = payer.effective_date ? new Date(payer.effective_date) : null
                                        const statusCode = payer.status_code

                                        // Determine display status
                                        const isActive = statusCode === 'approved' && effectiveDate && effectiveDate <= now
                                        const isFuture = statusCode === 'approved' && effectiveDate && effectiveDate > now && 
                                                        Math.ceil((effectiveDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) <= 21
                                        const isWaitlist = statusCode === 'approved' && (!effectiveDate || 
                                                          (effectiveDate > now && Math.ceil((effectiveDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) > 21)) ||
                                                          ['waiting_on_them', 'in_progress', 'not_started'].includes(statusCode || '')
                                        const isNotAccepted = ['denied', 'blocked', 'withdrawn', 'on_pause'].includes(statusCode || '') || 
                                                             (!statusCode || !['approved', 'waiting_on_them', 'in_progress', 'not_started'].includes(statusCode))

                                        return (
                                            <button
                                                key={payer.id}
                                                onClick={() => handlePayerSelect(payer)}
                                                className="
                                                    w-full p-4 border-2 border-stone-200 rounded-xl 
                                                    hover:border-orange-300 hover:bg-orange-50/50 
                                                    transition-all duration-200 text-left
                                                    group focus:outline-none focus:border-orange-400
                                                "
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center space-x-4">
                                                        {isActive ? (
                                                            <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                                                                <Check className="w-5 h-5 text-green-600" />
                                                            </div>
                                                        ) : isFuture ? (
                                                            <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                                                <Calendar className="w-5 h-5 text-blue-600" />
                                                            </div>
                                                        ) : isWaitlist ? (
                                                            <div className="flex-shrink-0 w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                                                                <Clock className="w-5 h-5 text-orange-600" />
                                                            </div>
                                                        ) : (
                                                            <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                                                                <X className="w-5 h-5 text-red-600" />
                                                            </div>
                                                        )}
                                                        
                                                        <div>
                                                            <h3 className="font-semibold text-slate-900 group-hover:text-orange-700 transition-colors">
                                                                {payer.name}
                                                            </h3>
                                                            <p className="text-sm text-slate-500">
                                                                {isActive && 'We accept this insurance'}
                                                                {isFuture && `Available starting ${effectiveDate?.toLocaleDateString()}`}
                                                                {isWaitlist && statusCode === 'approved' && !effectiveDate && 'We will be in network soon - timing uncertain'}
                                                                {isWaitlist && statusCode === 'approved' && effectiveDate && effectiveDate > now && 
                                                                    `Available starting ${effectiveDate.toLocaleDateString()}`}
                                                                {isWaitlist && ['waiting_on_them', 'in_progress', 'not_started'].includes(statusCode || '') && 
                                                                    'Credentialing in progress - join waitlist'}
                                                                {isNotAccepted && 'We cannot accept this insurance'}
                                                            </p>
                                                            {payer.payer_type && (
                                                                <p className="text-xs text-slate-400 mt-1">
                                                                    Type: {payer.payer_type}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="text-sm text-slate-400 group-hover:text-orange-500 transition-colors">
                                                        Select →
                                                    </div>
                                                </div>
                                            </button>
                                        )
                                    })}
                                </>
                            ) : (
                                <div className="text-center py-8">
                                    <div className="text-slate-400 mb-2">
                                        <Search className="w-12 h-12 mx-auto mb-4" />
                                    </div>
                                    <p className="text-slate-600">
                                        No insurance plans found matching "{state.query}"
                                    </p>
                                    <p className="text-sm text-slate-500 mt-2">
                                        Try a different search term or consider cash payment below
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Out-of-Network Message - Only show when ALL results are not-accepted */}
                    {state.showResults && state.results.length > 0 && state.results.every(payer => 
                        ['denied', 'blocked', 'withdrawn', 'on_pause'].includes(payer.status_code || '') || 
                        (!payer.status_code || !['approved', 'waiting_on_them', 'in_progress', 'not_started'].includes(payer.status_code))
                    ) && (
                        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                            <h3 className="font-semibold text-blue-800 mb-2">Out-of-Network Options</h3>
                            <p className="text-blue-700 text-sm">
                                We cannot accept this insurance, but you can still receive care by paying out-of-network rates. 
                                Many patients are able to get partial reimbursement from their insurance later.
                            </p>
                        </div>
                    )}

                    {/* Cash Payment Option */}
                    <div className="border-t border-stone-200 pt-6">
                        <h3 className="text-lg font-semibold text-slate-800 mb-3">
                            No insurance? No problem.
                        </h3>
                        <button
                            onClick={handleCashPayment}
                            className="
                                w-full p-4 border-2 border-stone-200 rounded-xl 
                                hover:border-orange-300 hover:bg-orange-50/50 
                                transition-all duration-200 text-left group
                                focus:outline-none focus:border-orange-400
                            "
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-4">
                                    <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                                        <CreditCard className="w-5 h-5 text-green-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-slate-900 group-hover:text-orange-700 transition-colors">
                                            Pay Out of Pocket
                                        </h3>
                                        <p className="text-sm text-slate-500">
                                            Self-pay rates available
                                        </p>
                                    </div>
                                </div>
                                <div className="text-sm text-slate-400 group-hover:text-orange-500 transition-colors">
                                    Select →
                                </div>
                            </div>
                        </button>
                    </div>
                </div>

                {/* Help Text */}
                <div className="text-center text-slate-500">
                    <p className="text-sm">
                        Can't find your insurance? We're always adding new providers.
                    </p>
                    <p className="text-sm mt-1">
                        Contact us at <span className="font-medium">hello@trymoonlit.com</span> for assistance.
                    </p>
                </div>
            </div>
        </div>
    )
}